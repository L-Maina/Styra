import { NextRequest } from 'next/server';
import { blockRole } from '@/lib/auth';
import { customerConfirm } from '@/lib/verification';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/bookings/[id]/verify
 *
 * Customer confirms that a service was completed satisfactorily.
 * Same flow as POST /api/bookings/[id]/confirm (without the review): the booking moves
 * COMPLETED → VERIFIED and the escrow is released to the provider in one transaction.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Block admin from verifying bookings
    const user = await blockRole('admin');
    const { id } = await params;

    const result = await customerConfirm(id, user.id);

    return successResponse({
      message:
        result.message ||
        (result.releasedAmount > 0
          ? 'Booking verified successfully. Funds released to provider.'
          : 'Booking verified successfully.'),
      booking: result.booking,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
