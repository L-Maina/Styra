import { NextRequest } from 'next/server';
import { requireAuth, blockRole } from '@/lib/auth';
import { releaseFromEscrow } from '@/lib/escrow';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

/**
 * POST /api/bookings/[id]/verify
 *
 * Customer confirms that a service was completed satisfactorily.
 * Transitions booking: COMPLETED → VERIFIED
 * Releases escrow funds to the provider's available wallet balance.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Block admin from verifying bookings
    const user = await blockRole('admin');
    const { id } = await params;
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, ownerId: true, name: true } },
        customer: { select: { id: true, name: true } },
        payment: { select: { id: true, status: true, amount: true } },
      },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    // Verify the caller is the booking customer
    if (booking.customerId !== user.id) {
      return errorResponse('Only the customer who made this booking can verify it', 403);
    }

    // Only COMPLETED bookings can be verified
    if (booking.status !== 'COMPLETED') {
      if (booking.status === 'VERIFIED') {
        return successResponse({ message: 'Booking already verified', booking });
      }
      return errorResponse(
        `Cannot verify booking with status: ${booking.status}. Only COMPLETED bookings can be verified.`,
        400,
      );
    }

    // Transition: COMPLETED → VERIFIED
    const updatedBooking = await db.booking.update({
      where: { id },
      data: { status: 'VERIFIED' },
    });

    // Release escrow funds to provider (fire-and-forget)
    try {
      await releaseFromEscrow(id, 'Customer confirmed service completion');
    } catch (escrowError) {
      if (process.env.NODE_ENV === 'development') {
        console.error(
          `[Verify] Escrow release failed for ${id.slice(0, 8)}:`,
          escrowError instanceof Error ? escrowError.message : 'unknown',
        );
      }
    }

    // Notify provider about verification (fire-and-forget)
    try {
      await db.notification.create({
        data: {
          userId: booking.business.ownerId,
          title: 'Service Verified',
          message: `Customer has verified service completion for booking ${id.slice(0, 8)}. Payment has been released to your wallet.`,
          type: 'VERIFICATION_UPDATE',
          data: JSON.stringify({ bookingId: id, customerName: booking.customer?.name }),
        },
      });
    } catch {
      // Notification failure never blocks the operation
    }

    // Notify customer (fire-and-forget)
    try {
      await db.notification.create({
        data: {
          userId: user.id,
          title: 'Verification Recorded',
          message: `Your verification for booking ${id.slice(0, 8)} has been recorded. Thank you for confirming!`,
          type: 'VERIFICATION_UPDATE',
          data: JSON.stringify({ bookingId: id }),
        },
      });
    } catch {
      // Notification failure never blocks the operation
    }

    return successResponse({
      message: 'Booking verified successfully. Funds released to provider.',
      booking: updatedBooking,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
