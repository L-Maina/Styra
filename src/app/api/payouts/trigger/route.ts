import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/lib/auth';
import { triggerPayout } from '@/lib/payout';
import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';

const triggerPayoutSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
});

/**
 * POST /api/payouts/trigger
 *
 * Trigger a payout for a verified booking.
 * - Business owners can trigger payouts for their own businesses.
 * - Admins can trigger payouts for any business.
 * - Validates the user owns the business associated with the booking.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('business_owner', 'admin');
    const body = await request.json();
    const { bookingId } = triggerPayoutSchema.parse(body);

    // Fetch booking to verify business ownership
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { businessId: true, business: { select: { ownerId: true } } },
    });

    if (!booking) {
      return handleApiError(new Error('Booking not found'));
    }

    // Non-admin users must own the business
    const normalizedRole = (user.role || '').toUpperCase();
    if (normalizedRole !== 'ADMIN' && booking.business.ownerId !== user.userId) {
      return handleApiError(new Error('You do not own this business'));
    }

    // Trigger payout (validates booking status, payment, idempotency internally)
    const result = await triggerPayout(bookingId, user.userId);

    return successResponse({
      payout: result.payout,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
