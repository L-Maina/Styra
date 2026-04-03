import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// Default platform settings
const DEFAULT_SETTINGS = {
  platformFee: 15,
  minWithdrawal: 50,
  featuredListingPrice: 99,
  premiumListingPrice: 49,
  maintenanceMode: false,
  emailNotifications: true,
  smsNotifications: false,
  autoApproveBusinesses: false,
  requireIdVerification: true,
};

// Parse settings from key-value PlatformSetting rows
async function getPlatformSettings(): Promise<Record<string, any>> {
  try {
    const rows = await db.platformSetting.findMany();
    const settings: Record<string, any> = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        // Try plain value for booleans and numbers
        if (row.value === 'true') settings[row.key] = true;
        else if (row.value === 'false') settings[row.key] = false;
        else if (!isNaN(Number(row.value))) settings[row.key] = Number(row.value);
        else settings[row.key] = row.value;
      }
    }

    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// GET - Fetch admin dashboard overview
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel fetch all stats
    const [
      totalUsers,
      totalBusinesses,
      totalBookings,
      totalRevenue,
      monthlyRevenue,
      lastMonthRevenue,
      monthlyBookings,
      unverifiedBusinesses,
      pendingReports,
      openDisputes,
      activeListings,
      pendingPremiumListings,
      pendingTickets,
      pendingClaims,
      pendingAds,
      recentPayments,
      settings,
    ] = await Promise.all([
      db.user.count(),
      db.business.count(),
      db.booking.count(),
      db.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      db.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
      // Business model uses isVerified (boolean), not verificationStatus
      db.business.count({ where: { isVerified: false } }),
      db.adminReport.count({ where: { status: 'PENDING' } }),
      db.dispute.count({ where: { status: 'OPEN' } }),
      db.premiumListing.count({ where: { status: 'ACTIVE' } }),
      db.premiumListing.count({ where: { status: 'PENDING' } }),
      db.supportTicket.count({ where: { status: 'OPEN' } }),
      db.insuranceClaim.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      db.advertisement.count({ where: { status: 'PENDING' } }),
      db.payment.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { name: true, email: true },
          },
          booking: {
            select: {
              business: { select: { name: true } },
            },
          },
        },
      }),
      getPlatformSettings(),
    ]);

    const currentRevenue = monthlyRevenue._sum.amount || 0;
    const previousRevenue = lastMonthRevenue._sum.amount || 0;
    const revenueGrowth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    // Monthly revenue chart for last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyTxns = await db.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true },
    });
    const monthlyDataMap = new Map<string, number>();
    for (const txn of monthlyTxns) {
      const monthKey = `${txn.createdAt.getFullYear()}-${String(txn.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyDataMap.set(monthKey, (monthlyDataMap.get(monthKey) || 0) + txn.amount);
    }
    const monthlyData: { month: string; revenue: number; commissions: number }[] = [];
    const platformFee = Number(settings.platformFee) || 15;
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      const rev = monthlyDataMap.get(monthKey) || 0;
      monthlyData.push({
        month: monthStart.toLocaleDateString('en-KE', { month: 'short' }),
        revenue: rev,
        commissions: Math.round(rev * (platformFee / 100)),
      });
    }

    const totalCommissions = Math.round((totalRevenue._sum.amount || 0) * (platformFee / 100));

    return successResponse({
      overview: {
        totalUsers,
        totalBusinesses,
        totalBookings,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalCommissions,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      },
      monthly: {
        revenue: currentRevenue,
        commissions: Math.round(currentRevenue * (platformFee / 100)),
        bookings: monthlyBookings,
      },
      pending: {
        applications: unverifiedBusinesses,
        reports: pendingReports,
        disputes: openDisputes,
        listings: pendingPremiumListings,
        tickets: pendingTickets,
        claims: pendingClaims,
        ads: pendingAds,
      },
      revenueChart: monthlyData,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.method,
        createdAt: p.createdAt,
        customerName: p.user?.name || 'Unknown',
        businessName: p.booking?.business?.name || 'N/A',
      })),
      settings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
