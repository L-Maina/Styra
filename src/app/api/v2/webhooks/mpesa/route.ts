import { createEngine } from '@/server/booking-engine';
import { getDb } from '@/server/db-pool';
import { fail, route } from '@/server/http';
import { parseMpesaCallback, verifyCallbackToken } from '@/server/payments/mpesa';
import { handleOnce } from '@/server/services/webhooks';

/** Safaricom STK push callback. Authenticated by the per-payment HMAC token in the URL. */
export const POST = route(async (req) => {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('payment') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret || !/^[0-9a-f-]{36}$/.test(paymentId) || !verifyCallbackToken(paymentId, token, secret)) return fail('UNAUTHENTICATED', 'bad callback token', 401);
  const body = await req.json().catch(() => null);
  const cb = parseMpesaCallback(body);
  if (!cb) return fail('VALIDATION', 'not an STK callback', 400);
  const db = getDb();
  const [payment] = await db.query<{ id: string }>(`select id from styra.payments where id = $1 and provider = 'MPESA' and provider_ref = $2`, [paymentId, cb.checkoutRequestId]);
  if (!payment) return fail('UNAUTHENTICATED', 'callback does not match this payment', 401);
  const engine = createEngine(db);
  const now = new Date();
  await handleOnce(db, 'MPESA', cb.eventId, body, async () => {
    if (cb.status === 'SUCCEEDED') {
      await db.query(`update styra.payments set raw = $2 where id = $1`, [payment.id, JSON.stringify({ receipt: cb.receipt })]);
      await engine.capturePayment({ paymentId: payment.id, providerRef: cb.checkoutRequestId, amountMinor: cb.amountMinor, currency: cb.currency }, now);
    } else {
      await engine.failPayment(payment.id, cb.reason, now);
    }
  });
  // Safaricom expects this acknowledgement shape.
  return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
