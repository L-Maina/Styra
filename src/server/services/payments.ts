import { AppError } from '../../core/errors';
import type { SessionUser } from '../auth';
import { createEngine } from '../booking-engine';
import type { Db } from '../db';
import { mpesaPhone, startStkPush } from '../payments/mpesa';
import { initializePaystack } from '../payments/paystack';
import { assertMethodAvailable, type PayMethod } from '../payments/provider';
import { getBooking } from './bookings';

export type PayNext = { kind: 'DONE' } | { kind: 'WAIT_FOR_PHONE'; paymentId: string } | { kind: 'REDIRECT'; url: string };

export async function payForBooking(db: Db, user: SessionUser, code: string, input: { method: PayMethod; phone?: string }, idempotencyKey: string | null, now: Date) {
  const booking = await getBooking(db, user, code);
  if (booking.customer.id !== user.id) throw new AppError('NOT_FOUND', 'booking not found', 404);
  assertMethodAvailable(input.method);
  const phone = input.method === 'MPESA' ? mpesaPhone(input.phone ?? '') : null;
  if (input.method === 'MPESA' && !phone) throw new AppError('PHONE_INVALID', 'enter a Kenyan M-Pesa number', 422);

  const engine = createEngine(db);
  const key = `pay:${booking.id}:${input.method}:${idempotencyKey ?? crypto.randomUUID()}`;
  const payment = await engine.startPayment({ bookingId: booking.id, provider: input.method, idempotencyKey: key, payerPhone: phone ?? undefined }, now);
  let next: PayNext = { kind: 'DONE' };

  if (input.method === 'FAKE') {
    await engine.capturePayment({ paymentId: payment.id, providerRef: `FAKE-${payment.id}`, amountMinor: BigInt(booking.priceMinor), currency: booking.currency }, now);
  } else if (input.method === 'MPESA') {
    try {
      const { checkoutRequestId } = await startStkPush({ paymentId: payment.id, amountMinor: BigInt(booking.priceMinor), phone: phone!, reference: booking.code, now });
      await db.query('update styra.payments set provider_ref = $2 where id = $1', [payment.id, checkoutRequestId]);
      next = { kind: 'WAIT_FOR_PHONE', paymentId: payment.id };
    } catch (e) {
      await engine.failPayment(payment.id, String((e as Error).message), now);
      throw new AppError('PROVIDER_UNAVAILABLE', 'M-Pesa did not accept the request', 503);
    }
  } else {
    if (!user.email) throw new AppError('VALIDATION', 'card payments need an email on the account', 422);
    const appUrl = process.env.APP_URL ?? '';
    try {
      const { authorizationUrl } = await initializePaystack({ paymentId: payment.id, amountMinor: BigInt(booking.priceMinor), email: user.email, currency: booking.currency, callbackUrl: `${appUrl}/bookings/${booking.code}` });
      await db.query('update styra.payments set provider_ref = $2 where id = $1', [payment.id, payment.id]);
      next = { kind: 'REDIRECT', url: authorizationUrl };
    } catch (e) {
      await engine.failPayment(payment.id, String((e as Error).message), now);
      throw new AppError('PROVIDER_UNAVAILABLE', 'card payments are not responding', 503);
    }
  }
  return { booking: await getBooking(db, user, code), next };
}
