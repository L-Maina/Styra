import { db } from './db';

/**
 * Check for orphaned records that reference non-existent parents.
 * Run periodically or on admin request.
 */
export async function checkDataIntegrity() {
  const issues: string[] = [];

  // Check bookings with non-existent services
  const bookings = await db.booking.findMany({ select: { id: true, serviceId: true } });
  for (const booking of bookings) {
    const service = await db.service.findUnique({ where: { id: booking.serviceId ?? undefined }, select: { id: true } });
    if (!service) issues.push(`Booking ${booking.id} references non-existent service ${booking.serviceId}`);
  }

  // Check payments with non-existent bookings
  const payments = await db.payment.findMany({ select: { id: true, bookingId: true } });
  for (const payment of payments) {
    const booking = await db.booking.findUnique({ where: { id: payment.bookingId }, select: { id: true } });
    if (!booking) issues.push(`Payment ${payment.id} references non-existent booking ${payment.bookingId}`);
  }

  return { issues, totalChecks: bookings.length + payments.length };
}
