import { NextRequest } from 'next/server';
import { requireAuth, blockRole, canManageBusiness } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

/** Verification deadline in milliseconds (24 hours) */
const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/bookings/[id]/complete
 *
 * Provider marks a service as completed.
 * Transitions booking: IN_PROGRESS → COMPLETED
 * Sets a verification deadline (24 hours from now).
 * Creates notification for the customer.
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
      include: {
        business: { select: { id: true, ownerId: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    // Verify the caller is the business owner (or admin)
    if (!canManageBusiness(user, booking.business.ownerId)) {
      return errorResponse('Only the business owner can mark a booking as completed', 403);
    }

    // Only IN_PROGRESS bookings can be marked as completed
    if (booking.status !== 'IN_PROGRESS') {
      if (booking.status === 'COMPLETED') {
        return successResponse({ message: 'Booking already completed', booking });
      }
      if (booking.status === 'VERIFIED') {
        return successResponse({ message: 'Booking already verified', booking });
      }
      return errorResponse(
        `Cannot complete booking with status: ${booking.status}. Only IN_PROGRESS bookings can be completed.`,
        400,
      );
    }

    // Calculate verification deadline (24 hours from now)
    const verificationDeadline = new Date(Date.now() + VERIFICATION_WINDOW_MS);

    // Transition: IN_PROGRESS → COMPLETED
    const updatedBooking = await db.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        notes: booking.notes
          ? `${booking.notes}\n\n[Completed by provider at ${new Date().toISOString()}]`
          : `Completed by provider at ${new Date().toISOString()}`,
      },
    });

    // Notify customer about completion (fire-and-forget)
    try {
      await db.notification.create({
        data: {
          userId: booking.customerId,
          title: 'Service Completed',
          message: `Your ${booking.service?.name || 'service'} at ${booking.business.name} has been marked as completed. Please verify the service within 24 hours to release payment to the provider.`,
          type: 'VERIFICATION_UPDATE',
          link: JSON.stringify({
            bookingId: id,
            businessName: booking.business.name,
            serviceName: booking.service?.name,
            verificationDeadline: verificationDeadline.toISOString(),
          }),
        },
      });
    } catch {
      // Notification failure never blocks the operation
    }

    return successResponse({
      message: 'Booking marked as completed. Customer has 24 hours to verify.',
      booking: updatedBooking,
      verificationDeadline,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
