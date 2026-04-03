import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, blockRole } from '@/lib/auth';
import { customerConfirm } from '@/lib/verification';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

const confirmBookingSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5').optional(),
  comment: z.string().max(2000, 'Comment must be less than 2000 characters').optional(),
});

/**
 * POST /api/bookings/[id]/confirm
 *
 * Customer confirms that a service was completed.
 * Optionally includes a rating and comment (creates/updates a Review).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Block admin from confirming bookings
    const user = await blockRole('admin');
    const { id } = await params;

    const body = await request.json();
    const { rating, comment } = confirmBookingSchema.parse(body);

    // Confirm the booking (validates ownership and status internally)
    const result = await customerConfirm(id, user.id);

    // If rating provided, create or update a review
    if (rating !== undefined) {
      const booking = result.booking;

      // Upsert review for this booking
      await db.review.upsert({
        where: { bookingId: id },
        create: {
          customerId: user.id,
          businessId: booking.businessId,
          bookingId: id,
          rating,
          comment: comment || null,
          isVerified: true,
        },
        update: {
          rating,
          comment: comment || undefined,
          isVerified: true,
          updatedAt: new Date(),
        },
      });

      // Update business average rating
      await updateBusinessRating(booking.businessId);
    }

    return successResponse({
      booking: result.booking,
      message: result.message || 'Booking confirmed successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Recalculate and update a business's average rating.
 */
async function updateBusinessRating(businessId: string): Promise<void> {
  const stats = await db.review.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { id: true },
  });

  await db.business.update({
    where: { id: businessId },
    data: {
      rating: Math.round((stats._avg.rating || 0) * 100) / 100,
      reviewCount: stats._count.id,
    },
  });
}
