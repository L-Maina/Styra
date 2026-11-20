import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { bunDb, dbReachable, fixtures, freshDb, type TestDb } from '../db/harness';
import { createEngine } from '../../src/server/booking-engine';
import { callbackToken } from '../../src/server/payments/mpesa';

const reachable = await dbReachable();
const MPESA_SECRET = 'cb-secret';
const PAYSTACK_SECRET = 'sk_test_example';

describe.skipIf(!reachable)('payment webhooks (real Postgres)', () => {
  let db: TestDb;
  let mpesa: any;
  let paystack: any;
  let f: ReturnType<typeof fixtures>;
  let ctx: { customer: string; service: string; staffId: string };
  let hour = 0;

  beforeAll(async () => {
    db = await freshDb();
    process.env.DATABASE_URL = db.url;
    process.env.MPESA_CALLBACK_SECRET = MPESA_SECRET;
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
    mpesa = await import('../../src/app/api/v2/webhooks/mpesa/route');
    paystack = await import('../../src/app/api/v2/webhooks/paystack/route');
    f = fixtures(db.sql);
    const owner = await f.user('PROVIDER');
    const biz = await f.business(owner);
    ctx = { customer: await f.user(), service: await f.service(biz.id, 60000n), staffId: biz.staffId };
  }, 30_000);
  afterAll(async () => {
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  }, 30_000);

  /** A PENDING booking with a payment that has been sent to the provider. */
  async function pending(provider: 'MPESA' | 'PAYSTACK', ref: string) {
    const engine = createEngine(bunDb(db.sql));
    const now = new Date();
    const b = await engine.createBooking({ customerId: ctx.customer, serviceId: ctx.service, staffId: ctx.staffId, startAt: new Date(Date.now() + (48 + hour++) * 3600_000) }, now);
    const p = await engine.startPayment({ bookingId: b.id, provider, idempotencyKey: `k-${ref}` }, now);
    await db.sql`update styra.payments set provider_ref = ${ref} where id = ${p.id}`;
    return { booking: b, paymentId: p.id as string };
  }
  const status = async (id: string) => (await db.sql`select status, escrow_state from styra.bookings where id = ${id}`)[0];
  const journals = async () => (await db.sql`select count(*)::int as n from styra.journals`)[0].n as number;

  const stkBody = (checkoutId: string, amount = 600, resultCode = 0) => ({
    Body: {
      stkCallback: {
        MerchantRequestID: 'm-1',
        CheckoutRequestID: checkoutId,
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? 'The service request is processed successfully.' : 'Request cancelled by user',
        ...(resultCode === 0 ? { CallbackMetadata: { Item: [{ Name: 'Amount', Value: amount }, { Name: 'MpesaReceiptNumber', Value: `R${checkoutId.slice(-6)}` }, { Name: 'PhoneNumber', Value: 254712345678 }] } } : {}),
      },
    },
  });
  const mpesaCall = (paymentId: string, body: unknown, token = callbackToken(paymentId, MPESA_SECRET)) =>
    mpesa.POST(new Request(`http://localhost/api/v2/webhooks/mpesa?payment=${paymentId}&token=${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({}) });

  test('M-Pesa success confirms the booking and holds the money', async () => {
    const { booking, paymentId } = await pending('MPESA', 'ws_CO_ok1');
    const res = await mpesaCall(paymentId, stkBody('ws_CO_ok1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    expect(await status(booking.id)).toEqual({ status: 'CONFIRMED', escrow_state: 'HELD' });
  });

  test('a replayed M-Pesa callback changes nothing', async () => {
    const { booking, paymentId } = await pending('MPESA', 'ws_CO_ok2');
    await mpesaCall(paymentId, stkBody('ws_CO_ok2'));
    const before = await journals();
    const res = await mpesaCall(paymentId, stkBody('ws_CO_ok2'));
    expect(res.status).toBe(200);
    expect(await journals()).toBe(before);
    expect((await status(booking.id)).status).toBe('CONFIRMED');
    const [{ n }] = await db.sql`select count(*)::int as n from styra.webhook_events where provider = 'MPESA' and event_id = 'ws_CO_ok2'`;
    expect(n).toBe(1);
  });

  test('a wrong token is refused and nothing is stored', async () => {
    const { booking, paymentId } = await pending('MPESA', 'ws_CO_bad');
    const res = await mpesaCall(paymentId, stkBody('ws_CO_bad'), 'f'.repeat(64));
    expect(res.status).toBe(401);
    expect((await status(booking.id)).status).toBe('PENDING');
  });

  test('a callback for another payment\'s CheckoutRequestID is refused', async () => {
    const a = await pending('MPESA', 'ws_CO_a');
    await pending('MPESA', 'ws_CO_b');
    const res = await mpesaCall(a.paymentId, stkBody('ws_CO_b'));
    expect(res.status).toBe(401);
    expect((await status(a.booking.id)).status).toBe('PENDING');
  });

  test('a cancelled prompt marks the payment failed; the slot stays held for a retry', async () => {
    const { booking, paymentId } = await pending('MPESA', 'ws_CO_cancel');
    const res = await mpesaCall(paymentId, stkBody('ws_CO_cancel', 600, 1032));
    expect(res.status).toBe(200);
    const [p] = await db.sql`select status, failure_reason from styra.payments where id = ${paymentId}`;
    expect(p).toEqual({ status: 'FAILED', failure_reason: 'Request cancelled by user' });
    expect((await status(booking.id)).status).toBe('PENDING');
  });

  test('an amount that does not match is parked, not applied', async () => {
    const { booking, paymentId } = await pending('MPESA', 'ws_CO_short');
    const res = await mpesaCall(paymentId, stkBody('ws_CO_short', 100));
    expect(res.status).toBe(200);
    expect((await status(booking.id)).status).toBe('PENDING');
    const [e] = await db.sql`select error from styra.webhook_events where event_id = 'ws_CO_short'`;
    expect(e.error).toMatch(/PAYMENT_MISMATCH/);
  });

  const paystackCall = (body: object, key = PAYSTACK_SECRET) => {
    const raw = JSON.stringify(body);
    return paystack.POST(
      new Request('http://localhost/api/v2/webhooks/paystack', { method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': createHmac('sha512', key).update(raw).digest('hex') }, body: raw }),
      { params: Promise.resolve({}) },
    );
  };

  test('a signed Paystack charge.success confirms the booking', async () => {
    const { booking, paymentId } = await pending('PAYSTACK', 'ps-1');
    const res = await paystackCall({ event: 'charge.success', data: { id: 9001, reference: paymentId, amount: 60000, currency: 'KES', status: 'success' } });
    expect(res.status).toBe(200);
    expect(await status(booking.id)).toEqual({ status: 'CONFIRMED', escrow_state: 'HELD' });
  });

  test('a Paystack event with a bad signature is refused', async () => {
    const { booking, paymentId } = await pending('PAYSTACK', 'ps-2');
    const res = await paystackCall({ event: 'charge.success', data: { id: 9002, reference: paymentId, amount: 60000, currency: 'KES' } }, 'wrong-key');
    expect(res.status).toBe(401);
    expect((await status(booking.id)).status).toBe('PENDING');
  });
});
