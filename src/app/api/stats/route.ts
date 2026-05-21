import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch real counts from the database
    const [
      totalBusinesses,
      totalUsers,
      totalBookings,
      totalReviews,
      avgRatingResult,
    ] = await Promise.all([
      db.business.count({ where: { isActive: true } }),
      db.user.count({ where: { role: 'CUSTOMER' } }),
      db.booking.count(),
      db.review.count(),
      db.review.aggregate({
        _avg: { rating: true },
      }),
    ]);

    const avgRating = avgRatingResult._avg.rating
      ? Number(avgRatingResult._avg.rating.toFixed(1))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        total_providers: totalBusinesses,
        total_customers: totalUsers,
        total_bookings: totalBookings,
        total_reviews: totalReviews,
        average_rating: avgRating,
      },
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json(
      {
        success: true,
        data: {
          total_providers: 0,
          total_customers: 0,
          total_bookings: 0,
          total_reviews: 0,
          average_rating: 0,
        },
      },
      { status: 200 } // Return zeros rather than erroring — stats are non-critical
    );
  }
}
