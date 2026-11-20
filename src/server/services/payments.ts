import type { SessionUser } from '../auth';
import { createEngine } from '../booking-engine';
import type { Db } from '../db';
import { assertMethodAvailable, type PayMethod } from '../payments/provider';
import { getBooking } from './bookings';
import { AppError } from '../../core/errors';

export async function payForBooking(db: Db, user: SessionUser, code: string, input: { method: PayMethod; phone?: string }, idempotencyKey: string | null, now: Date) {
  const booking = await getBooking(db, user, code);
  if (booking.customer.id !== user.id) throw new AppError('NOT_FOUND', 'booking not found', 404);
  assertMethodAvailable(input.method);
  const engine = createEngine(db);
  const key = `pay:${booking.id}:${idempotencyKey ?? crypto.randomUUID()}`;
  const payment = await engine.startPayment({ bookingId: booking.id, provider: input.method, idempotencyKey: key, payerPhone: input.phone }, now);
  if (input.method === 'FAKE') {
    await engine.capturePayment({ paymentId: payment.id, providerRef: `FAKE-${payment.id}`, amountMinor: BigInt(booking.priceMinor), currency: booking.currency }, now);
  }
  return getBooking(db, user, code);
}
