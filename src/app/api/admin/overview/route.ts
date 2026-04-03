import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch admin dashboard overview
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    // Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel fetch all stats — no sequential awaits after this block
    const [
      totalUsers,
      totalBusinesses,
      totalBookings,
      totalRevenue,
      monthlyRevenue,
      lastMonthRevenue,
      monthlyBookings,
      pendingApplications,
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
      // Total users
      db.user.count(),
      
      // Total businesses
      db.business.count(),
      
      // Total bookings
      db.booking.count(),
      
      // Total revenue
      db.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      
      // Monthly revenue
      db.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      
      // Last month revenue
      db.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      
      // Monthly bookings count
      db.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
      
      // Pending business applications
      db.business.count({ where: { verificationStatus: 'PENDING' } }),
      
      // Pending reports
      db.adminReport.count({ where: { status: 'PENDING' } }),
      
      // Open disputes
      db.dispute.count({ where: { status: 'OPEN' } }),
      
      // Active premium listings
      db.premiumListing.count({ where: { status: 'ACTIVE' } }),
      
      // Pending premium listings
      db.premiumListing.count({ where: { status: 'PENDING' } }),
      
      // Pending support tickets
      db.supportTicket.count({ where: { status: 'OPEN' } }),
      
      // Pending insurance claims
      db.insuranceClaim.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      
      // Pending advertisements
      db.advertisement.count({ where: { status: 'PENDING' } }),
      
      // Recent payments
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
      
      // Platform settings
      db.platformSetting.findFirst(),
    ]);

    // Calculate growth percentage
    const currentRevenue = monthlyRevenue._sum.amount || 0;
    const previousRevenue = lastMonthRevenue._sum.amount || 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    // Get monthly revenue data for the last 6 months — single query with grouping
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
    const monthlyData: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.push({
        month: monthStart.toLocaleDateString('en-KE', { month: 'short' }),
        revenue: monthlyDataMap.get(monthKey) || 0,
      });
    }

    // Calculate commissions (platform fee)
    const platformFee = settings?.platformFee || 15;
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
        applications: pendingApplications,
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
        createdAt: p.createdAt,
        customerName: p.user?.name || 'Unknown',
        businessName: p.booking?.business?.name || 'N/A',
      })),
      settings: settings || {
        platformFee: 15,
        minWithdrawal: 50,
        featuredListingPrice: 99,
        premiumListingPrice: 49,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
