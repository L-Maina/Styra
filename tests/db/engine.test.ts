import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { SQL } from 'bun';
import { bunDb, dbReachable, fixtures, freshDb, type TestDb } from './harness';
import { createEngine, type Engine } from '../../src/server/booking-engine';
import { AppError } from '../../src/core/errors';

const reachable = await dbReachable();
const HOUR = 3_600_000;

describe.skipIf(!reachable)('booking engine (real Postgres)', () => {
  let db: TestDb;
  let sql: SQL;
  let f: ReturnType<typeof fixtures>;
  let engine: Engine;
  let ctx: { customer: string; owner: string; admin: string; biz: { id: string; staffId: string }; service: string };
  const now = new Date('2027-01-10T06:00:00Z');
  let slot = 0;
  /** A start time well in the future, unique per call so bookings never overlap. */
  const futureStart = (hoursAhead = 72) => new Date(now.getTime() + hoursAhead * HOUR + slot++ * 2 * HOUR);

  beforeAll(async () => {
    db = await freshDb();
    sql = db.sql;
    f = fixtures(sql);
    engine = createEngine(bunDb(sql));
    const owner = await f.user('PROVIDER');
    const biz = await f.business(owner);
    ctx = { customer: await f.user(), owner, admin: await f.user('ADMIN'), biz, service: await f.service(biz.id, 150000n) };
  }, 30_000);
  afterAll(async () => db && (await db.drop()), 30_000);

  const book = (startAt = futureStart(), at = now) =>
    engine.createBooking({ customerId: ctx.customer, serviceId: ctx.service, staffId: ctx.biz.staffId, startAt }, at);

  async function pay(bookingId: string, amount = 150000n, at = now) {
    const p = await engine.startPayment({ bookingId, provider: 'FAKE', idempotencyKey: `pay-${bookingId}-${amount}` }, at);
    return engine.capturePayment({ paymentId: p.id, providerRef: `ref-${p.id}`, amountMinor: amount, currency: 'KES' }, at);
  }
  const row = async (id: string) => (await sql`select status, escrow_state from styra.bookings where id = ${id}`)[0];
  const balance = async (kind: string, businessId: string | null = null) => {
    const [r] = await sql`select coalesce(-sum(e.amount_minor), 0)::text as b from styra.ledger_entries e join styra.ledger_accounts a on a.id = e.account_id
      where a.kind = ${kind} and a.business_id is not distinct from ${businessId}`;
    return BigInt(r.b);
  };
  const bookBalanced = async () => {
    const [r] = await sql`select coalesce(sum(amount_minor), 0)::text as t from styra.ledger_entries`;
    expect(r.t).toBe('0');
  };

  test('create: PENDING with a 15-minute hold, price from the service', async () => {
    const b = await book();
    expect(b.status).toBe('PENDING');
    expect(b.priceMinor).toBe(150000n);
    expect(b.expiresAt.getTime() - now.getTime()).toBe(15 * 60_000);
    expect(b.code).toMatch(/^STY-[A-Z0-9]{6}$/);
  });

  test('create: a taken slot answers SLOT_TAKEN', async () => {
    const start = futureStart();
    await book(start);
    await expect(book(start)).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
  });

  test('create: an expired hold frees the slot for the next customer', async () => {
    const start = futureStart();
    await book(start);
    const later = new Date(now.getTime() + 16 * 60_000);
    const b = await book(start, later);
    expect(b.status).toBe('PENDING');
  });

  test('happy path: pay, complete, confirm; provider paid minus the fee', async () => {
    const before = await balance('PROVIDER_BALANCE', ctx.biz.id);
    const revBefore = await balance('PLATFORM_REVENUE');
    const b = await book();
    await pay(b.id);
    expect(await row(b.id)).toEqual({ status: 'CONFIRMED', escrow_state: 'HELD' });
    await engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, b.startAt);
    expect((await row(b.id)).status).toBe('COMPLETED');
    await engine.act(b.id, { type: 'CUSTOMER_CONFIRMED' }, now);
    expect(await row(b.id)).toEqual({ status: 'VERIFIED', escrow_state: 'SETTLED' });
    expect((await balance('PROVIDER_BALANCE', ctx.biz.id)) - before).toBe(135000n);
    expect((await balance('PLATFORM_REVENUE')) - revBefore).toBe(15000n);
    await bookBalanced();
  });

  test('done and no-show are refused before the appointment starts', async () => {
    const b = await book();
    await pay(b.id);
    await expect(engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, now)).rejects.toMatchObject({ code: 'TOO_EARLY' });
    await expect(engine.act(b.id, { type: 'PROVIDER_NO_SHOW' }, now)).rejects.toMatchObject({ code: 'TOO_EARLY' });
    await engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, b.startAt);
    expect((await row(b.id)).status).toBe('COMPLETED');
  });

  test('auto-release: the tick verifies bookings after the 24 h window', async () => {
    const b = await book();
    await pay(b.id);
    await engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, b.startAt);
    expect((await engine.tick(new Date(b.startAt.getTime() + 23 * HOUR))).verified).not.toContain(b.id);
    const r = await engine.tick(new Date(b.startAt.getTime() + 24 * HOUR + 1));
    expect(r.verified).toContain(b.id);
    expect((await row(b.id)).status).toBe('VERIFIED');
  });

  test('no-show also auto-verifies after the window', async () => {
    const b = await book();
    await pay(b.id);
    await engine.act(b.id, { type: 'PROVIDER_NO_SHOW' }, b.startAt);
    await engine.tick(new Date(b.startAt.getTime() + 25 * HOUR));
    expect((await row(b.id)).status).toBe('VERIFIED');
  });

  test('hold expiry: unpaid bookings expire after 15 minutes', async () => {
    const b = await book();
    const r = await engine.tick(new Date(now.getTime() + 16 * 60_000));
    expect(r.expired).toContain(b.id);
    expect(await row(b.id)).toEqual({ status: 'EXPIRED', escrow_state: 'NONE' });
  });

  test('late payment on an expired booking is captured and queued for a full refund', async () => {
    const b = await book();
    // The customer starts paying in time, but the confirmation arrives after the hold expired.
    const p = await engine.startPayment({ bookingId: b.id, provider: 'FAKE', idempotencyKey: `late-${b.id}` }, now);
    await engine.tick(new Date(now.getTime() + 16 * 60_000));
    const refBefore = await balance('REFUND_PENDING');
    await engine.capturePayment({ paymentId: p.id, providerRef: `ref-${p.id}`, amountMinor: 150000n, currency: 'KES' }, new Date(now.getTime() + 20 * 60_000));
    expect(await row(b.id)).toEqual({ status: 'CANCELLED', escrow_state: 'SETTLED' });
    expect((await balance('REFUND_PENDING')) - refBefore).toBe(150000n);
    const refunds = await sql`select amount_minor::text as a, status from styra.refunds where booking_id = ${b.id}`;
    expect(refunds).toEqual([{ a: '150000', status: 'PENDING' }]);
    await bookBalanced();
  });

  test('provider decline refunds in full', async () => {
    const b = await book();
    await pay(b.id);
    const refBefore = await balance('REFUND_PENDING');
    await engine.act(b.id, { type: 'PROVIDER_DECLINED' }, now);
    expect(await row(b.id)).toEqual({ status: 'CANCELLED', escrow_state: 'SETTLED' });
    expect((await balance('REFUND_PENDING')) - refBefore).toBe(150000n);
  });

  for (const [hours, refundBps] of [[48, 10000], [10, 5000], [2, 0]] as const) {
    test(`customer cancel ${hours} h before start refunds ${refundBps / 100}%`, async () => {
      const b = await book(futureStart(hours) );
      await pay(b.id);
      const refBefore = await balance('REFUND_PENDING');
      const provBefore = await balance('PROVIDER_BALANCE', ctx.biz.id);
      // cancel just now; start is `hours` (+ slot offset) ahead, so pick the tier by the real gap
      const start = (await sql`select start_at from styra.bookings where id = ${b.id}`)[0].start_at as Date;
      const at = new Date(start.getTime() - hours * HOUR + 60_000);
      await engine.act(b.id, { type: 'CUSTOMER_CANCELLED' }, at);
      const refund = (await balance('REFUND_PENDING')) - refBefore;
      expect(refund).toBe((150000n * BigInt(refundBps)) / 10000n);
      const rest = 150000n - refund;
      const fee = (rest * 1000n + 5000n) / 10000n;
      expect((await balance('PROVIDER_BALANCE', ctx.biz.id)) - provBefore).toBe(rest - fee);
      await bookBalanced();
    });
  }

  test('customer cancel before paying moves no money', async () => {
    const b = await book();
    await engine.act(b.id, { type: 'CUSTOMER_CANCELLED' }, now);
    expect(await row(b.id)).toEqual({ status: 'CANCELLED', escrow_state: 'NONE' });
  });

  for (const [outcome, refundBps, status] of [['RELEASE', undefined, 'VERIFIED'], ['REFUND', undefined, 'CANCELLED'], ['SPLIT', 4000, 'VERIFIED']] as const) {
    test(`dispute resolved with ${outcome}`, async () => {
      const b = await book();
      await pay(b.id);
      await engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, b.startAt);
      await engine.openDispute(b.id, { openedBy: ctx.customer, reason: 'The cut was uneven on one side.' }, now);
      expect((await row(b.id)).status).toBe('DISPUTED');
      // the window does not release a disputed booking
      await engine.tick(new Date(b.startAt.getTime() + 48 * HOUR));
      expect((await row(b.id)).status).toBe('DISPUTED');
      const refBefore = await balance('REFUND_PENDING');
      await engine.resolveDispute(b.id, { outcome, refundBps, adminId: ctx.admin, note: 'Reviewed photos from both sides.' }, now);
      expect(await row(b.id)).toEqual({ status, escrow_state: 'SETTLED' });
      const expected = outcome === 'REFUND' ? 150000n : outcome === 'SPLIT' ? 60000n : 0n;
      expect((await balance('REFUND_PENDING')) - refBefore).toBe(expected);
      const [d] = await sql`select status, outcome from styra.disputes where booking_id = ${b.id}`;
      expect(d).toEqual({ status: 'RESOLVED', outcome });
      await bookBalanced();
    });
  }

  test('replayed capture does nothing', async () => {
    const b = await book();
    const p = await engine.startPayment({ bookingId: b.id, provider: 'FAKE', idempotencyKey: `replay-${b.id}` }, now);
    const ev = { paymentId: p.id, providerRef: `r-${p.id}`, amountMinor: 150000n, currency: 'KES' };
    await engine.capturePayment(ev, now);
    const [{ n: before }] = await sql`select count(*)::int as n from styra.journals`;
    await engine.capturePayment(ev, now);
    const [{ n: after }] = await sql`select count(*)::int as n from styra.journals`;
    expect(after).toBe(before);
    expect((await row(b.id)).status).toBe('CONFIRMED');
  });

  test('a captured amount that differs from the price is parked, not applied', async () => {
    const b = await book();
    await expect(pay(b.id, 100000n)).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(await row(b.id)).toEqual({ status: 'PENDING', escrow_state: 'NONE' });
  });

  test('replayed settlement does nothing; invalid repeats are refused', async () => {
    const b = await book();
    await pay(b.id);
    await engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, b.startAt);
    await engine.act(b.id, { type: 'CUSTOMER_CONFIRMED' }, now);
    const [{ n: before }] = await sql`select count(*)::int as n from styra.journals`;
    await expect(engine.act(b.id, { type: 'CUSTOMER_CONFIRMED' }, now)).rejects.toBeInstanceOf(AppError);
    const [{ n: after }] = await sql`select count(*)::int as n from styra.journals`;
    expect(after).toBe(before);
  });

  test('two racing settlements post once', async () => {
    const b = await book();
    await pay(b.id);
    await engine.act(b.id, { type: 'PROVIDER_COMPLETED' }, b.startAt);
    const results = await Promise.allSettled([
      engine.act(b.id, { type: 'CUSTOMER_CONFIRMED' }, now),
      engine.act(b.id, { type: 'CUSTOMER_CONFIRMED' }, now),
      engine.tick(new Date(b.startAt.getTime() + 30 * HOUR)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const [{ n }] = await sql`select count(*)::int as n from styra.journals where idempotency_key = ${`settle:${b.id}`}`;
    expect(n).toBe(1);
    await bookBalanced();
  });

  test('payouts: over the balance is refused; paid and failed move the reserve', async () => {
    const available = await balance('PROVIDER_BALANCE', ctx.biz.id);
    expect(available > 0n).toBe(true);
    await expect(engine.requestPayout({ businessId: ctx.biz.id, amountMinor: available + 1n, method: 'MPESA', destination: '0712 *** 678', idempotencyKey: 'po-over' }, now))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    await expect(engine.requestPayout({ businessId: ctx.biz.id, amountMinor: 5000n, method: 'MPESA', destination: '0712 *** 678', idempotencyKey: 'po-small' }, now))
      .rejects.toMatchObject({ code: 'BELOW_MINIMUM' });

    const p1 = await engine.requestPayout({ businessId: ctx.biz.id, amountMinor: 20000n, method: 'MPESA', destination: '0712 *** 678', idempotencyKey: 'po-1' }, now);
    expect(await balance('PROVIDER_BALANCE', ctx.biz.id)).toBe(available - 20000n); // R10: reserved on request
    expect(await balance('PAYOUT_PENDING')).toBeGreaterThanOrEqual(20000n);
    await engine.markPayoutPaid(p1.id, { providerRef: 'MP-1' }, now);
    expect(await balance('PROVIDER_BALANCE', ctx.biz.id)).toBe(available - 20000n);

    const p2 = await engine.requestPayout({ businessId: ctx.biz.id, amountMinor: 10000n, method: 'MPESA', destination: '0712 *** 678', idempotencyKey: 'po-2' }, now);
    await engine.markPayoutFailed(p2.id, { reason: 'M-Pesa number not registered' }, now);
    expect(await balance('PROVIDER_BALANCE', ctx.biz.id)).toBe(available - 20000n);

    const again = await engine.requestPayout({ businessId: ctx.biz.id, amountMinor: 20000n, method: 'MPESA', destination: '0712 *** 678', idempotencyKey: 'po-1' }, now);
    expect(again.id).toBe(p1.id); // same key, same payout
    await bookBalanced();
  });

  test('refund paid clears the refund queue', async () => {
    const [r] = await sql`select id, amount_minor::text as a from styra.refunds where status = 'PENDING' limit 1`;
    const before = await balance('REFUND_PENDING');
    await engine.markRefundPaid(r.id, { providerRef: 'MP-R1' }, now);
    expect(before - (await balance('REFUND_PENDING'))).toBe(BigInt(r.a));
    const [after] = await sql`select status from styra.refunds where id = ${r.id}`;
    expect(after.status).toBe('PAID');
    await engine.markRefundPaid(r.id, { providerRef: 'MP-R1' }, now); // replay is a no-op
    expect(before - (await balance('REFUND_PENDING'))).toBe(BigInt(r.a));
    await bookBalanced();
  });
});
