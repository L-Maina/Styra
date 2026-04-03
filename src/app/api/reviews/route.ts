import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { createReviewSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';

// List reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const { page, limit, skip } = parsePagination(searchParams);

    const where: Record<string, unknown> = {};
    if (businessId) {
      where.businessId = businessId;
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            select: { id: true, name: true, avatar: true },
          },
          booking: {
            select: { serviceName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.review.count({ where }),
    ]);

    return paginatedResponse(reviews, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}

// Create review — uses DB transaction for atomicity
export async function POST(request: NextRequest) {
  try {
    // Block admin from creating reviews
    const session = await blockRole('admin');
    const body = await request.json();
    const validated = createReviewSchema.parse(body);

    // Use transaction for atomic review creation + business rating update
    const result = await db.$transaction(async (tx) => {
      // Verify booking exists and is completed (within transaction)
      const booking = await tx.booking.findUnique({
        where: { id: validated.bookingId },
        include: { reviews: true },
      });

      if (!booking) {
        throw new Error('BOOKING_NOT_FOUND');
      }

      if (booking.customerId !== session.userId) {
        throw new Error('NOT_OWNER');
      }

      if (booking.status !== 'completed') {
        throw new Error('BOOKING_NOT_COMPLETED');
      }

      if (booking.reviews.length > 0) {
        throw new Error('ALREADY_REVIEWED');
      }

      const review = await tx.review.create({
        data: {
          customerId: session.userId,
          businessId: validated.businessId,
          bookingId: validated.bookingId,
          rating: validated.rating,
          comment: validated.comment || null,
        },
      });

      // Update business rating atomically
      const stats = await tx.review.aggregate({
        where: { businessId: validated.businessId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.business.update({
        where: { id: validated.businessId },
        data: {
          rating: Math.round((stats._avg.rating || 0) * 100) / 100,
          reviewCount: stats._count,
        },
      });

      // Get business owner for notification
      const business = await tx.business.findUnique({
        where: { id: validated.businessId },
        select: { ownerId: true },
      });

      if (business) {
        await tx.notification.create({
          data: {
            userId: business.ownerId,
            title: 'New Review',
            message: `You received a ${validated.rating}-star review`,
            type: 'review',
            link: `/business/${validated.businessId}/reviews`,
          },
        });
      }

      return review;
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    if (error instanceof Error) {
      switch (error.message) {
        case 'BOOKING_NOT_FOUND':
          return errorResponse('Booking not found', 404);
        case 'NOT_OWNER':
          return errorResponse('This booking does not belong to you', 403);
        case 'BOOKING_NOT_COMPLETED':
          return errorResponse('You can only review completed bookings', 400);
        case 'ALREADY_REVIEWED':
          return errorResponse('You have already reviewed this booking', 409);
      }
    }
    return handleApiError(error);
  }
}
