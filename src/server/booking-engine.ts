/**
 * The booking engine: the only code that changes a booking's status together with money (blueprint R7).
 * Every change runs in one transaction with the booking row locked; the database re-checks the money rules
 * at commit.
 */
import { transition, InvalidTransition, type BookingEvent } from '../core/booking-machine';
import { AppError } from '../core/errors';
import {
  captureJournal,
  payoutFailedJournal,
  payoutPaidJournal,
  payoutRequestJournal,
  refundPaidJournal,
  settlementJournal,
  type Journal,
} from '../core/ledger';
import { settlementShares, type SettlementShape } from '../core/money';
import { customerRefundBps, DEFAULT_SETTINGS, holdExpiresAt, type Settings } from '../core/policy';
import { escrowStateFor, type BookingStatus } from '../core/statuses';
import { param, sqlState, toBig, type Db, type Tx } from './db';

interface BookingRow {
  id: string;
  code: string;
  status: BookingStatus;
  escrow_state: string;
  price_minor: unknown;
  currency: string;
  business_id: string;
  customer_id: string;
  start_at: Date;
  expires_at: Date | null;
  commission_bps: number | null;
}

export interface CreatedBooking {
  id: string;
  code: string;
  status: BookingStatus;
  priceMinor: bigint;
  currency: string;
  startAt: Date;
  endAt: Date;
  expiresAt: Date;
}

/** Events callers may send through `act`. The engine fills in the refund share for customer cancellations. */
export type ActEvent =
  | { type: 'CUSTOMER_CANCELLED' }
  | { type: 'CUSTOMER_CONFIRMED' }
  | { type: 'PROVIDER_COMPLETED' }
  | { type: 'PROVIDER_NO_SHOW' }
  | { type: 'PROVIDER_DECLINED' }
  | { type: 'PROVIDER_CANCELLED' }
  | { type: 'ADMIN_CANCELLED' };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function bookingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `STY-${[...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
}

const CANCELLED_BY: Partial<Record<BookingEvent['type'], string>> = {
  CUSTOMER_CANCELLED: 'CUSTOMER',
  PROVIDER_DECLINED: 'PROVIDER',
  PROVIDER_CANCELLED: 'PROVIDER',
  ADMIN_CANCELLED: 'ADMIN',
  DISPUTE_RESOLVED_REFUND: 'ADMIN',
  HOLD_EXPIRED: 'SYSTEM',
  PAYMENT_CAPTURED: 'SYSTEM',
};

export function createEngine(db: Db) {
  async function loadSettings(tx: Tx): Promise<Settings> {
    const rows = await tx.query<{ key: string; value: unknown }>('select key, value from styra.settings');
    const m = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string, d: number) => (m.has(k) ? Number(m.get(k)) : d);
    return {
      commissionBps: num('commission_bps', DEFAULT_SETTINGS.commissionBps),
      verificationWindowHours: num('verification_window_hours', DEFAULT_SETTINGS.verificationWindowHours),
      holdMinutes: num('hold_minutes', DEFAULT_SETTINGS.holdMinutes),
      cancellationPolicy: (m.get('cancellation_policy') as Settings['cancellationPolicy']) ?? DEFAULT_SETTINGS.cancellationPolicy,
      payoutMinMinor: m.has('payout_min_minor') ? toBig(m.get('payout_min_minor')) : DEFAULT_SETTINGS.payoutMinMinor,
    };
  }

  async function lockBooking(tx: Tx, id: string): Promise<BookingRow> {
    const [b] = await tx.query<BookingRow>(
      `select b.id, b.code, b.status, b.escrow_state, b.price_minor, b.currency, b.business_id, b.customer_id, b.start_at, b.expires_at,
              biz.commission_bps
         from styra.bookings b join styra.businesses biz on biz.id = b.business_id
        where b.id = $1 for update of b`,
      [id],
    );
    if (!b) throw new AppError('NOT_FOUND', `booking ${id} not found`, 404);
    return b;
  }

  async function ensureAccount(tx: Tx, kind: string, businessId: string | null, currency: string): Promise<string> {
    const [a] = await tx.query<{ id: string }>(
      `insert into styra.ledger_accounts (kind, business_id, currency) values ($1, $2, $3)
       on conflict (kind, business_id, currency) do update set kind = excluded.kind returning id`,
      [kind, businessId, currency],
    );
    return a.id;
  }

  /** Posts a journal once. Returns false when its idempotency key already posted (a replay). */
  async function post(
    tx: Tx,
    j: Journal,
    currency: string,
    links: { bookingId?: string; paymentId?: string; refundId?: string; payoutId?: string; memo?: string; createdBy?: string } = {},
  ): Promise<boolean> {
    const existing = await tx.query('select 1 from styra.journals where idempotency_key = $1', [j.idempotencyKey]);
    if (existing.length) return false;
    const [row] = await tx.query<{ id: string }>(
      `insert into styra.journals (kind, idempotency_key, booking_id, payment_id, refund_id, payout_id, memo, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [j.kind, j.idempotencyKey, links.bookingId ?? null, links.paymentId ?? null, links.refundId ?? null, links.payoutId ?? null, links.memo ?? null, links.createdBy ?? null],
    );
    for (const line of j.lines) {
      const accountId = await ensureAccount(tx, line.account.kind, line.account.businessId ?? null, currency);
      await tx.query('insert into styra.ledger_entries (journal_id, account_id, booking_id, amount_minor) values ($1, $2, $3, $4)', [
        row.id,
        accountId,
        line.bookingId ?? null,
        param(line.amount),
      ]);
    }
    return true;
  }

  async function settle(tx: Tx, b: BookingRow, shape: SettlementShape, key: string, settings: Settings) {
    const price = toBig(b.price_minor);
    const shares = settlementShares(price, shape, b.commission_bps ?? settings.commissionBps);
    let refundId: string | undefined;
    if (shares.refund > 0n) {
      const [r] = await tx.query<{ id: string }>(
        `insert into styra.refunds (booking_id, amount_minor, currency, reason) values ($1, $2, $3, $4) returning id`,
        [b.id, param(shares.refund), b.currency, shape.kind],
      );
      refundId = r.id;
    }
    const j = { ...settlementJournal({ bookingId: b.id, businessId: b.business_id, shares }), idempotencyKey: key };
    await post(tx, j, b.currency, { bookingId: b.id, refundId });
  }

  /** Applies one event to a locked booking: money first, then the status, all in the caller's transaction. */
  async function apply(
    tx: Tx,
    b: BookingRow,
    event: BookingEvent,
    now: Date,
    extra: { payment?: { id: string; amount: bigint }; actorId?: string; reason?: string } = {},
  ): Promise<BookingStatus> {
    let result;
    try {
      result = transition(b.status, event);
    } catch (e) {
      if (e instanceof InvalidTransition) throw new AppError('INVALID_STATE', e.message, 409, { status: b.status, event: event.type });
      throw e;
    }
    const settings = await loadSettings(tx);
    const effect = result.effect;
    if (effect.kind === 'CAPTURE' || effect.kind === 'CAPTURE_THEN_SETTLE') {
      if (!extra.payment) throw new Error('capture needs a payment');
      await post(tx, captureJournal({ paymentId: extra.payment.id, bookingId: b.id, amount: extra.payment.amount }), b.currency, {
        bookingId: b.id,
        paymentId: extra.payment.id,
      });
    }
    if (effect.kind === 'SETTLE') await settle(tx, b, effect.shape, `settle:${b.id}`, settings);
    if (effect.kind === 'CAPTURE_THEN_SETTLE') await settle(tx, b, effect.shape, `settle:${b.id}:${extra.payment!.id}`, settings);

    const to = result.to;
    const escrow = escrowStateFor(result);
    await tx.query(
      `update styra.bookings set
         status = $2, escrow_state = $3,
         expires_at = case when $2 = 'PENDING' then expires_at else null end,
         confirmed_at = case when $2 = 'CONFIRMED' then $4 else confirmed_at end,
         completed_at = case when $2 in ('COMPLETED', 'NO_SHOW') then $4 else completed_at end,
         verified_at = case when $2 = 'VERIFIED' then $4 else verified_at end,
         cancelled_at = case when $2 in ('CANCELLED', 'EXPIRED') and cancelled_at is null then $4 else cancelled_at end,
         cancelled_by = case when $2 in ('CANCELLED', 'EXPIRED') and cancelled_by is null then $5 else cancelled_by end,
         cancel_reason = coalesce($6, cancel_reason)
       where id = $1`,
      [b.id, to, escrow, now, CANCELLED_BY[event.type] ?? null, extra.reason ?? null],
    );
    await tx.query(`insert into styra.outbox (topic, payload) values ($1, $2)`, [
      `booking.${to.toLowerCase()}`,
      JSON.stringify({ bookingId: b.id, code: b.code, from: b.status, event: event.type }),
    ]);
    await tx.query(`insert into styra.audit_log (actor_id, action, entity, entity_id, data) values ($1, $2, 'booking', $3, $4)`, [
      extra.actorId ?? null,
      event.type,
      b.id,
      JSON.stringify({ from: b.status, to }),
    ]);
    b.status = to;
    return to;
  }

  return {
    async createBooking(
      input: { customerId: string; serviceId: string; staffId?: string; startAt: Date; notes?: string },
      now: Date,
    ): Promise<CreatedBooking> {
      return db.transaction(async (tx) => {
        const [svc] = await tx.query<{ id: string; business_id: string; duration_min: number; price_minor: unknown; currency: string }>(
          `select s.id, s.business_id, s.duration_min, s.price_minor, s.currency
             from styra.services s join styra.businesses b on b.id = s.business_id
            where s.id = $1 and s.active and b.status = 'ACTIVE'`,
          [input.serviceId],
        );
        if (!svc) throw new AppError('NOT_FOUND', 'service not found or not bookable', 404);
        if (input.startAt.getTime() <= now.getTime()) throw new AppError('SLOT_IN_PAST', 'start time has passed', 422);

        const [staff] = await tx.query<{ id: string }>(
          `select id from styra.staff where business_id = $1 and active and ($2::uuid is null or id = $2::uuid) order by created_at limit 1`,
          [svc.business_id, input.staffId ?? null],
        );
        if (!staff) throw new AppError('NOT_FOUND', 'staff member not found', 404);

        // Free stale holds on this chair first (no money is held on a PENDING booking).
        await tx.query(
          `update styra.bookings set status = 'EXPIRED', expires_at = null, cancelled_at = $2, cancelled_by = 'SYSTEM'
            where staff_id = $1 and status = 'PENDING' and expires_at < $2`,
          [staff.id, now],
        );

        const settings = await loadSettings(tx);
        const endAt = new Date(input.startAt.getTime() + svc.duration_min * 60_000);
        const expiresAt = holdExpiresAt(now, settings.holdMinutes);
        try {
          const [row] = await tx.query<{ id: string; code: string }>(
            `insert into styra.bookings (code, customer_id, business_id, staff_id, service_id, start_at, end_at, price_minor, currency, expires_at, notes)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id, code`,
            [bookingCode(), input.customerId, svc.business_id, staff.id, svc.id, input.startAt, endAt, param(svc.price_minor), svc.currency, expiresAt, input.notes ?? null],
          );
          return {
            id: row.id,
            code: row.code,
            status: 'PENDING',
            priceMinor: toBig(svc.price_minor),
            currency: svc.currency.trim(),
            startAt: input.startAt,
            endAt,
            expiresAt,
          };
        } catch (e) {
          if (sqlState(e) === '23P01' || /bookings_no_overlap/.test(String((e as Error).message))) {
            throw new AppError('SLOT_TAKEN', 'that time was just booked', 409);
          }
          throw e;
        }
      });
    },

    /** Creates (or returns) the payment row for a booking that is still on hold. */
    async startPayment(input: { bookingId: string; provider: string; idempotencyKey: string; payerPhone?: string }, now: Date) {
      return db.transaction(async (tx) => {
        const [existing] = await tx.query<{ id: string; status: string }>(
          'select id, status from styra.payments where idempotency_key = $1',
          [input.idempotencyKey],
        );
        if (existing) return existing;
        const b = await lockBooking(tx, input.bookingId);
        if (b.status !== 'PENDING') throw new AppError('INVALID_STATE', `booking is ${b.status}`, 409);
        if (b.expires_at && b.expires_at.getTime() <= now.getTime()) throw new AppError('HOLD_EXPIRED', 'the slot hold has expired', 409);
        const [p] = await tx.query<{ id: string; status: string }>(
          `insert into styra.payments (booking_id, provider, idempotency_key, amount_minor, currency, payer_phone, status)
           values ($1, $2, $3, $4, $5, $6, 'PENDING') returning id, status`,
          [b.id, input.provider, input.idempotencyKey, param(b.price_minor), b.currency, input.payerPhone ?? null],
        );
        return p;
      });
    },

    /**
     * Applies a confirmed payment. Replays do nothing. An amount or currency that differs from the booking is
     * parked on the payment for an admin and answered with PAYMENT_MISMATCH.
     */
    async capturePayment(input: { paymentId: string; providerRef: string; amountMinor: bigint; currency: string }, now: Date) {
      const parked = await db.transaction(async (tx) => {
        const [p] = await tx.query<{ id: string; booking_id: string; status: string; amount_minor: unknown; currency: string }>(
          'select id, booking_id, status, amount_minor, currency from styra.payments where id = $1 for update',
          [input.paymentId],
        );
        if (!p) throw new AppError('NOT_FOUND', 'payment not found', 404);
        if (p.status === 'SUCCEEDED') return false;
        const b = await lockBooking(tx, p.booking_id);
        const price = toBig(b.price_minor);
        if (input.amountMinor !== price || input.currency !== b.currency.trim() || toBig(p.amount_minor) !== price) {
          await tx.query(`update styra.payments set failure_reason = $2, provider_ref = coalesce(provider_ref, $3) where id = $1`, [
            p.id,
            `AMOUNT_MISMATCH: got ${input.amountMinor} ${input.currency}, expected ${price} ${b.currency}`,
            input.providerRef,
          ]);
          await tx.query(`insert into styra.audit_log (action, entity, entity_id, data) values ('PAYMENT_PARKED', 'payment', $1, $2)`, [
            p.id,
            JSON.stringify({ amount: input.amountMinor.toString(), currency: input.currency }),
          ]);
          return true;
        }
        await tx.query(`update styra.payments set status = 'SUCCEEDED', provider_ref = $2, confirmed_at = $3, failure_reason = null where id = $1`, [
          p.id,
          input.providerRef,
          now,
        ]);
        await apply(tx, b, { type: 'PAYMENT_CAPTURED' }, now, { payment: { id: p.id, amount: price } });
        return false;
      });
      if (parked) throw new AppError('PAYMENT_MISMATCH', 'captured amount does not match the booking', 409);
    },

    async act(bookingId: string, event: ActEvent, now: Date, opts: { actorId?: string; reason?: string } = {}) {
      return db.transaction(async (tx) => {
        const b = await lockBooking(tx, bookingId);
        let full: BookingEvent = event as BookingEvent;
        if (event.type === 'CUSTOMER_CANCELLED') {
          const settings = await loadSettings(tx);
          full = { type: 'CUSTOMER_CANCELLED', refundBps: customerRefundBps(settings.cancellationPolicy, b.start_at, now) };
        }
        return apply(tx, b, full, now, opts);
      });
    },

    async openDispute(bookingId: string, input: { openedBy: string; reason: string; details?: string }, now: Date) {
      return db.transaction(async (tx) => {
        const b = await lockBooking(tx, bookingId);
        await apply(tx, b, { type: 'DISPUTE_OPENED' }, now, { actorId: input.openedBy });
        const [d] = await tx.query<{ id: string }>(
          `insert into styra.disputes (booking_id, opened_by, reason, details) values ($1, $2, $3, $4) returning id`,
          [b.id, input.openedBy, input.reason, input.details ?? null],
        );
        return d;
      });
    },

    async resolveDispute(
      bookingId: string,
      input: { outcome: 'RELEASE' | 'REFUND' | 'SPLIT'; refundBps?: number; adminId: string; note: string },
      now: Date,
    ) {
      return db.transaction(async (tx) => {
        const b = await lockBooking(tx, bookingId);
        const event: BookingEvent =
          input.outcome === 'RELEASE'
            ? { type: 'DISPUTE_RESOLVED_RELEASE' }
            : input.outcome === 'REFUND'
              ? { type: 'DISPUTE_RESOLVED_REFUND' }
              : { type: 'DISPUTE_RESOLVED_SPLIT', refundBps: input.refundBps ?? -1 };
        await apply(tx, b, event, now, { actorId: input.adminId });
        await tx.query(
          `update styra.disputes set status = 'RESOLVED', outcome = $2, refund_bps = $3, resolved_by = $4, resolution_note = $5, resolved_at = $6
            where booking_id = $1`,
          [b.id, input.outcome, input.outcome === 'SPLIT' ? input.refundBps : null, input.adminId, input.note, now],
        );
      });
    },

    /** Expires unpaid holds and verifies bookings whose window has passed. Each booking in its own transaction. */
    async tick(now: Date): Promise<{ expired: string[]; verified: string[] }> {
      const settings = await db.transaction(loadSettings);
      const out = { expired: [] as string[], verified: [] as string[] };
      const due = await db.query<{ id: string; kind: 'EXPIRE' | 'VERIFY' }>(
        `select id, 'EXPIRE' as kind from styra.bookings where status = 'PENDING' and expires_at < $1
         union all
         select id, 'VERIFY' as kind from styra.bookings
          where status in ('COMPLETED', 'NO_SHOW') and completed_at + make_interval(hours => $2) <= $1`,
        [now, settings.verificationWindowHours],
      );
      for (const d of due) {
        try {
          await db.transaction(async (tx) => {
            const b = await lockBooking(tx, d.id);
            await apply(tx, b, { type: d.kind === 'EXPIRE' ? 'HOLD_EXPIRED' : 'WINDOW_ELAPSED' }, now);
          });
          (d.kind === 'EXPIRE' ? out.expired : out.verified).push(d.id);
        } catch (e) {
          // Someone else moved this booking first (a confirm racing the tick): nothing to do.
          if (!(e instanceof AppError && e.code === 'INVALID_STATE')) throw e;
        }
      }
      return out;
    },

    async requestPayout(
      input: { businessId: string; amountMinor: bigint; method: 'MPESA' | 'BANK'; destination: string; idempotencyKey: string },
      _now: Date,
    ): Promise<{ id: string; status: string }> {
      return db.transaction(async (tx) => {
        const [existing] = await tx.query<{ id: string; status: string }>('select id, status from styra.payouts where idempotency_key = $1', [input.idempotencyKey]);
        if (existing) return existing;
        const settings = await loadSettings(tx);
        if (input.amountMinor < settings.payoutMinMinor) throw new AppError('BELOW_MINIMUM', 'payout is below the minimum', 422);
        const accountId = await ensureAccount(tx, 'PROVIDER_BALANCE', input.businessId, 'KES');
        await tx.query('select id from styra.ledger_accounts where id = $1 for update', [accountId]);
        const [{ available }] = await tx.query<{ available: unknown }>(
          'select coalesce(-sum(amount_minor), 0) as available from styra.ledger_entries where account_id = $1',
          [accountId],
        );
        if (input.amountMinor > toBig(available)) throw new AppError('INSUFFICIENT_BALANCE', 'payout exceeds the available balance', 422);
        const [p] = await tx.query<{ id: string; status: string }>(
          `insert into styra.payouts (business_id, amount_minor, method, destination, idempotency_key) values ($1, $2, $3, $4, $5) returning id, status`,
          [input.businessId, param(input.amountMinor), input.method, input.destination, input.idempotencyKey],
        );
        await post(tx, payoutRequestJournal({ payoutId: p.id, businessId: input.businessId, amount: input.amountMinor }), 'KES', { payoutId: p.id });
        return p;
      });
    },

    async markPayoutPaid(payoutId: string, input: { providerRef: string }, now: Date) {
      return db.transaction(async (tx) => {
        const [p] = await tx.query<{ id: string; status: string; amount_minor: unknown; currency: string }>(
          'select id, status, amount_minor, currency from styra.payouts where id = $1 for update',
          [payoutId],
        );
        if (!p) throw new AppError('NOT_FOUND', 'payout not found', 404);
        if (p.status === 'PAID') return;
        if (p.status === 'FAILED') throw new AppError('INVALID_STATE', 'payout already failed', 409);
        await post(tx, payoutPaidJournal({ payoutId: p.id, amount: toBig(p.amount_minor) }), p.currency, { payoutId: p.id });
        await tx.query(`update styra.payouts set status = 'PAID', provider_ref = $2, paid_at = $3 where id = $1`, [p.id, input.providerRef, now]);
      });
    },

    async markPayoutFailed(payoutId: string, input: { reason: string }, _now: Date) {
      return db.transaction(async (tx) => {
        const [p] = await tx.query<{ id: string; status: string; amount_minor: unknown; currency: string; business_id: string }>(
          'select id, status, amount_minor, currency, business_id from styra.payouts where id = $1 for update',
          [payoutId],
        );
        if (!p) throw new AppError('NOT_FOUND', 'payout not found', 404);
        if (p.status === 'FAILED') return;
        if (p.status === 'PAID') throw new AppError('INVALID_STATE', 'payout already paid', 409);
        await post(tx, payoutFailedJournal({ payoutId: p.id, businessId: p.business_id, amount: toBig(p.amount_minor) }), p.currency, { payoutId: p.id });
        await tx.query(`update styra.payouts set status = 'FAILED', failure_reason = $2 where id = $1`, [p.id, input.reason]);
      });
    },

    async markRefundPaid(refundId: string, input: { providerRef: string }, now: Date) {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string; status: string; amount_minor: unknown; currency: string }>(
          'select id, status, amount_minor, currency from styra.refunds where id = $1 for update',
          [refundId],
        );
        if (!r) throw new AppError('NOT_FOUND', 'refund not found', 404);
        if (r.status === 'PAID') return;
        await post(tx, refundPaidJournal({ refundId: r.id, amount: toBig(r.amount_minor) }), r.currency, { refundId: r.id });
        await tx.query(`update styra.refunds set status = 'PAID', provider_ref = $2, paid_at = $3 where id = $1`, [r.id, input.providerRef, now]);
      });
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
