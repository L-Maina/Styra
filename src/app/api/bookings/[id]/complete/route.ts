import { NextRequest } from 'next/server';
import { blockRole, canManageBusiness } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { BookingStatus, isStatus } from '@/lib/booking-status';
import { markBookingCompleted } from '@/lib/verification';
import { db } from '@/lib/db';

/**
 * POST /api/bookings/[id]/complete
 *
 * Provider marks a service as completed.
 * Transitions booking: IN_PROGRESS → COMPLETED and starts the customer's 24 hour
 * verification window (Booking.completedAt).
 * Creates a notification for the customer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Block admin from marking bookings as completed
    const user = await blockRole('admin');
    const { id } = await params;
    const booking = await db.booking.findUnique({
      where: { id },
      select: { id: true, business: { select: { ownerId: true } } },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    // Verify the caller is the business owner (or admin)
    if (!canManageBusiness(user, booking.business.ownerId)) {
      return errorResponse('Only the business owner can mark a booking as completed', 403);
    }

    // IN_PROGRESS → COMPLETED. Already completed or verified bookings come back unchanged.
    const result = await markBookingCompleted(id);

    if (!result.changed) {
      return successResponse({
        message: isStatus(result.booking.status, BookingStatus.VERIFIED)
          ? 'Booking already verified'
          : 'Booking already completed',
        booking: result.booking,
      });
    }

    // The customer was notified by markBookingCompleted.
    return successResponse({
      message: 'Booking marked as completed. Customer has 24 hours to verify.',
      booking: result.booking,
      verificationDeadline: result.deadline,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
