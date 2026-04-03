import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

// Get platform stats
export async function GET() {
  try {
    await requireAdmin();

    const [
      totalUsers,
      totalBusinesses,
      totalBookings,
      totalRevenue,
      pendingVerifications,
      activeBookingsToday,
    ] = await Promise.all([
      db.user.count(),
      db.business.count(),
      db.booking.count(),
      db.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      db.business.count({
        where: { verificationStatus: 'PENDING' },
      }),
      db.booking.count({
        where: {
          date: new Date().toISOString().split('T')[0],
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        },
      }),
    ]);

    // Monthly stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyBookings = await db.booking.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const monthlyRevenue = await db.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
    });

    const newUsersThisMonth = await db.user.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return successResponse({
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
      },
      businesses: {
        total: totalBusinesses,
        pendingVerification: pendingVerifications,
      },
      bookings: {
        total: totalBookings,
        monthly: monthlyBookings,
        activeToday: activeBookingsToday,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
        monthly: monthlyRevenue._sum.amount || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
