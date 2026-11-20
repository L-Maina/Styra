import { AppError } from '../../core/errors';
import { toE164 } from '../../core/format';
import type { SessionUser } from '../auth';
import { createEngine } from '../booking-engine';
import type { Db } from '../db';
import { getBooking } from './bookings';
import { iso, n, ownedBusiness } from './common';

const payoutDto = (p: Record<string, unknown>) => ({
  id: String(p.id),
  amountMinor: n(p.amount_minor),
  method: String(p.method),
  destination: String(p.destination),
  status: String(p.status),
  createdAt: iso(p.created_at),
  paidAt: iso(p.paid_at),
  failureReason: p.failure_reason == null ? null : String(p.failure_reason),
  businessName: p.business_name == null ? undefined : String(p.business_name),
  businessPhone: p.business_phone == null ? undefined : String(p.business_phone),
});

/** "0712 *** 678" for M-Pesa numbers, "•••• 1234" for bank accounts. Full numbers are never stored on the payout. */
export function maskDestination(method: 'MPESA' | 'BANK', destination: string): string {
  if (method === 'MPESA') {
    const e164 = toE164(destination);
    if (!e164) throw new AppError('PHONE_INVALID', 'enter a Kenyan M-Pesa number', 422);
    const local = `0${e164.slice(4)}`;
    return `${local.slice(0, 4)} *** ${local.slice(7)}`;
  }
  const digits = destination.replace(/\D/g, '');
  if (digits.length < 6) throw new AppError('VALIDATION', 'enter the full account number', 422);
  return `•••• ${digits.slice(-4)}`;
}

export async function earnings(db: Db, user: SessionUser) {
  const biz = await ownedBusiness(db, user);
  const [[bal], [held], payouts] = await Promise.all([
    db.query<{ v: unknown }>(
      `select coalesce(-sum(e.amount_minor), 0) as v from styra.ledger_entries e join styra.ledger_accounts a on a.id = e.account_id
        where a.kind = 'PROVIDER_BALANCE' and a.business_id = $1`,
      [biz.id],
    ),
    db.query<{ v: unknown }>(`select coalesce(sum(price_minor), 0) as v from styra.bookings where business_id = $1 and escrow_state = 'HELD'`, [biz.id]),
    db.query<Record<string, unknown>>('select * from styra.payouts where business_id = $1 order by created_at desc limit 50', [biz.id]),
  ]);
  return { availableMinor: n(bal.v), heldMinor: n(held.v), payouts: payouts.map(payoutDto) };
}

export async function requestPayout(db: Db, user: SessionUser, input: { amountMinor: number; method: 'MPESA' | 'BANK'; destination: string }, key: string | null, now: Date) {
  const biz = await ownedBusiness(db, user);
  const destination = maskDestination(input.method, input.destination);
  const p = await createEngine(db).requestPayout(
    { businessId: biz.id, amountMinor: BigInt(input.amountMinor), method: input.method, destination, idempotencyKey: `payout:${biz.id}:${key ?? crypto.randomUUID()}` },
    now,
  );
  const [row] = await db.query<Record<string, unknown>>('select * from styra.payouts where id = $1', [p.id]);
  return payoutDto(row);
}

export async function adminPayouts(db: Db) {
  const rows = await db.query<Record<string, unknown>>(
    `select p.*, b.name as business_name, b.phone as business_phone from styra.payouts p join styra.businesses b on b.id = p.business_id
      order by (p.status in ('REQUESTED', 'PROCESSING')) desc, p.created_at desc limit 100`,
  );
  return rows.map(payoutDto);
}

export async function adminPayoutAction(db: Db, id: string, action: string, body: { providerRef?: string; reason?: string }, now: Date) {
  const engine = createEngine(db);
  if (action === 'paid') {
    if (!body.providerRef) throw new AppError('VALIDATION', 'add the M-Pesa or bank reference', 422);
    await engine.markPayoutPaid(id, { providerRef: body.providerRef }, now);
  } else if (action === 'failed') {
    await engine.markPayoutFailed(id, { reason: body.reason ?? 'Failed' }, now);
  } else throw new AppError('NOT_FOUND', 'unknown action', 404);
  const [row] = await db.query<Record<string, unknown>>('select * from styra.payouts where id = $1', [id]);
  return payoutDto(row);
}

export async function adminRefunds(db: Db) {
  const rows = await db.query<Record<string, unknown>>(
    `select r.id, r.amount_minor, r.status, r.reason, r.created_at, r.paid_at, b.code, u.name as customer_name, u.phone as customer_phone,
            (select p.provider || ' ' || coalesce(p.provider_ref, '') from styra.payments p where p.booking_id = b.id and p.status = 'SUCCEEDED' order by p.confirmed_at desc limit 1) as paid_with
       from styra.refunds r join styra.bookings b on b.id = r.booking_id join styra.users u on u.id = b.customer_id
      order by (r.status in ('PENDING', 'SUBMITTED')) desc, r.created_at desc limit 100`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    bookingCode: String(r.code),
    amountMinor: n(r.amount_minor),
    status: String(r.status),
    customerName: String(r.customer_name),
    customerPhone: r.customer_phone == null ? null : String(r.customer_phone),
    paidWith: r.paid_with == null ? null : String(r.paid_with).trim(),
    createdAt: iso(r.created_at),
    paidAt: iso(r.paid_at),
  }));
}

export async function adminRefundPaid(db: Db, id: string, providerRef: string, now: Date) {
  await createEngine(db).markRefundPaid(id, { providerRef }, now);
}

export async function adminDisputes(db: Db) {
  const rows = await db.query<Record<string, unknown>>(
    `select d.id, d.status, d.reason, d.details, d.outcome, d.created_at, b.code, b.price_minor, biz.name as business_name, u.name as customer_name
       from styra.disputes d join styra.bookings b on b.id = d.booking_id join styra.businesses biz on biz.id = b.business_id join styra.users u on u.id = d.opened_by
      order by (d.status = 'OPEN') desc, d.created_at desc limit 100`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    status: String(r.status),
    reason: String(r.reason),
    details: r.details == null ? null : String(r.details),
    outcome: r.outcome == null ? null : String(r.outcome),
    bookingCode: String(r.code),
    priceMinor: n(r.price_minor),
    businessName: String(r.business_name),
    customerName: String(r.customer_name),
    createdAt: iso(r.created_at),
  }));
}

export async function adminResolveDispute(db: Db, admin: SessionUser, id: string, input: { outcome: 'RELEASE' | 'REFUND' | 'SPLIT'; refundBps?: number; note: string }, now: Date) {
  const [d] = await db.query<{ booking_id: string; code: string; status: string }>(
    `select d.booking_id, b.code, d.status from styra.disputes d join styra.bookings b on b.id = d.booking_id where d.id = $1`,
    [id],
  );
  if (!d) throw new AppError('NOT_FOUND', 'dispute not found', 404);
  if (d.status !== 'OPEN') throw new AppError('INVALID_STATE', 'this dispute is already resolved', 409);
  if (input.outcome === 'SPLIT' && input.refundBps === undefined) throw new AppError('VALIDATION', 'a split needs a refund share', 422);
  await createEngine(db).resolveDispute(d.booking_id, { outcome: input.outcome, refundBps: input.refundBps, adminId: admin.id, note: input.note }, now);
  return getBooking(db, admin, d.code);
}
