import { createEngine } from '@/server/booking-engine';
import { getDb } from '@/server/db-pool';
import { fail, ok, route } from '@/server/http';
import { parsePaystackWebhook, verifyPaystackSignature } from '@/server/payments/paystack';
import { handleOnce } from '@/server/services/webhooks';

/** Paystack webhook, signed with HMAC-SHA512 over the raw body. */
export const POST = route(async (req) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  if (!secret || !verifyPaystackSignature(signature, raw, secret)) return fail('UNAUTHENTICATED', 'bad signature', 401);
  const evt = parsePaystackWebhook({ 'x-paystack-signature': signature }, raw, secret);
  if (!evt) return ok({ ignored: true });
  const db = getDb();
  const [payment] = await db.query<{ id: string }>(`select id from styra.payments where id::text = $1 and provider = 'PAYSTACK'`, [evt.reference]);
  if (!payment) return ok({ ignored: true });
  const engine = createEngine(db);
  const now = new Date();
  await handleOnce(db, 'PAYSTACK', evt.eventId, JSON.parse(raw), async () => {
    if (evt.status === 'SUCCEEDED') await engine.capturePayment({ paymentId: payment.id, providerRef: evt.providerRef, amountMinor: evt.amountMinor, currency: evt.currency }, now);
    else await engine.failPayment(payment.id, 'Card payment failed', now);
  });
  return ok({ received: true });
});
