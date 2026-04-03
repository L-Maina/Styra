import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, blockRole } from '@/lib/auth';
import { raiseDispute } from '@/lib/verification';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

const disputeBookingSchema = z.object({
  reason: z
    .string()
    .min(10, 'Dispute reason must be at least 10 characters')
    .max(2000, 'Dispute reason must be less than 2000 characters'),
});

/**
 * POST /api/bookings/[id]/dispute
 *
 * Customer raises a dispute for a booking.
 * - Validates the customer owns the booking
 * - Creates a Dispute record
 * - Holds escrow funds
 * - Notifies the admin and business owner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Block admin from raising disputes
    const user = await blockRole('admin');
    const { id } = await params;

    const body = await request.json();
    const { reason } = disputeBookingSchema.parse(body);

    // Raise dispute (validates ownership and booking status internally)
    const result = await raiseDispute(id, user.id, reason);

    // Notify admin about the new dispute
    try {
      const admins = await db.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      const notificationPromises = admins.map((admin) =>
        db.notification.create({
          data: {
            userId: admin.id,
            title: 'New Dispute Filed',
            message: `A new dispute has been filed for booking ${id.slice(0, 8)} by customer ${user.name || user.email}. Amount: $${result.dispute.amount.toFixed(2)}`,
            type: 'SYSTEM_ALERT',
            data: JSON.stringify({
              disputeId: result.dispute.id,
              bookingId: id,
              customerId: user.id,
            }),
          },
        }),
      );

      await Promise.all(notificationPromises);
    } catch {
      // Notification failure should never block dispute creation
    }

    return successResponse({
      dispute: result.dispute,
      booking: result.booking,
      message: 'Dispute filed successfully. Our team will review it within 48 hours.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
