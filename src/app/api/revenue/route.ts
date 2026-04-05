import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// ============================================
// REVENUE API
// Handles: Revenue metrics, transactions, analytics
// SECURITY: All endpoints require ADMIN role.
// Revenue data is sensitive financial information.
// Uses handleApiError for consistent error handling.
// ============================================

// GET /api/revenue - Fetch revenue data (ADMIN ONLY)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'overview';
    const period = searchParams.get('period') || 'monthly';
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    switch (type) {
      case 'overview':
        return await getRevenueOverview(period);
      case 'transactions':
        return await getTransactions(businessId, startDate, endDate);
      case 'metrics':
        return await getRevenueMetrics();
      case 'breakdown':
        return await getRevenueBreakdown(period, startDate, endDate);
      case 'business':
        return await getBusinessRevenue(businessId);
      case 'payout-accounts':
        return await getPayoutAccounts(businessId);
      default:
        return await getRevenueOverview(period);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/revenue - Record transaction (ADMIN ONLY)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { 
      type, 
      bookingId, 
      businessId, 
      userId, 
      amount, 
      platformFee,
      providerAmount,
      paymentMethod,
      metadata 
    } = body;

    if (!amount || amount < 0) {
      return errorResponse('Valid positive amount is required', 400);
    }

    const validTypes = ['BOOKING_COMMISSION', 'PREMIUM_LISTING', 'MARKETING_BOOST', 'SUBSCRIPTION', 'REFUND'];
    if (type && !validTypes.includes(type)) {
      return errorResponse(`Invalid transaction type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    const transaction = await db.platformTransaction.create({
      data: {
        type: type || 'BOOKING_COMMISSION',
        bookingId,
        businessId,
        userId,
        amount,
        platformFee: platformFee || 0,
        providerAmount: providerAmount || 0,
        paymentMethod,
        metadata: metadata ? JSON.stringify(metadata) : null,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return successResponse({ transaction, message: 'Transaction recorded successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/revenue - Update platform fee settings (ADMIN ONLY)
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { platformFee } = body;

    if (platformFee !== undefined) {
      if (typeof platformFee !== 'number' || platformFee < 0 || platformFee > 100) {
        return errorResponse('Platform fee must be a number between 0 and 100', 400);
      }
    }

    await db.platformSetting.upsert({
      where: { key: 'platformFee' },
      update: { value: String(platformFee || 15.0) },
      create: { key: 'platformFee', value: String(platformFee || 15.0) },
    });

    const settings = await db.platformSetting.findFirst({ where: { key: 'platformFee' } });

    return successResponse({
      settings: {
        platformFee: settings ? parseFloat(settings.value) : 15.0,
        updatedAt: settings?.updatedAt,
      },
      message: 'Revenue settings updated successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getRevenueOverview(period: string) {
  try {
    const now = new Date();
    const startDate = new Date(now);

    switch (period) {
      case 'daily': startDate.setDate(now.getDate() - 1); break;
      case 'weekly': startDate.setDate(now.getDate() - 7); break;
      case 'yearly': startDate.setFullYear(now.getFullYear() - 1); break;
      default: startDate.setMonth(now.getMonth() - 1); break;
    }

    const dateRange = { start: startDate, end: now };

    const txnByType = await db.platformTransaction.groupBy({
      by: ['type'],
      where: { createdAt: { gte: startDate, lte: now }, status: 'COMPLETED' },
      _sum: { amount: true, platformFee: true },
      _count: true,
    });

    const commissionRevenue = txnByType.find(t => t.type === 'SERVICE_COMPLETED')?._sum.platformFee || 0;
    const premiumListingRevenue = txnByType.find(t => t.type === 'PREMIUM_LISTING')?._sum.amount || 0;
    const marketingBoostRevenue = txnByType.find(t => t.type === 'MARKETING_BOOST')?._sum.amount || 0;
    const subscriptionRevenue = txnByType.find(t => t.type === 'SUBSCRIPTION')?._sum.amount || 0;
    const refundAmount = txnByType.find(t => t.type === 'REFUND')?._sum.amount || 0;
    const totalTransactions = txnByType.reduce((s, t) => s + t._count, 0);
    const totalRevenue = txnByType.reduce((s, t) => s + (t._sum.amount || 0), 0);

    const completedBookings = await db.booking.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: now } },
      include: { service: { select: { category: true } } },
    });

    const categoryMap = new Map<string, { revenue: number; transactions: number }>();
    for (const booking of completedBookings) {
      const cat = booking.service?.category || 'Other';
      const current = categoryMap.get(cat) || { revenue: 0, transactions: 0 };
      current.revenue += booking.totalPrice;
      current.transactions += 1;
      categoryMap.set(cat, current);
    }
    const topCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data, growth: 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);

    const txnByBusiness = await db.platformTransaction.groupBy({
      by: ['businessId'],
      where: { createdAt: { gte: startDate, lte: now }, status: 'COMPLETED', businessId: { not: null } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: 3,
    });

    const businessIds = txnByBusiness.map(t => t.businessId!);
    const businesses = businessIds.length > 0
      ? await db.business.findMany({ where: { id: { in: businessIds } }, select: { id: true, name: true } })
      : [];
    const bizNameMap = new Map(businesses.map(b => [b.id, b.name]));

    const topBusinesses = txnByBusiness.map(t => ({
      businessId: t.businessId!,
      name: bizNameMap.get(t.businessId!) || 'Unknown',
      revenue: t._sum.amount || 0,
      transactions: t._count,
      growth: 0,
    }));

    const overview = {
      period,
      dateRange,
      totalRevenue,
      commissionRevenue,
      premiumListingRevenue,
      marketingBoostRevenue,
      subscriptionRevenue,
      refundAmount,
      netRevenue: commissionRevenue + premiumListingRevenue + marketingBoostRevenue + subscriptionRevenue - refundAmount,
      totalTransactions,
      averageTransactionValue: totalTransactions > 0 ? Math.round((totalRevenue / totalTransactions) * 100) / 100 : 0,
      revenueGrowth: 0,
      topCategories,
      topBusinesses,
      chartData: await generateChartData(period, startDate, now),
    };

    return successResponse(overview);
  } catch (error) {
    return errorResponse('Failed to fetch revenue overview', 500);
  }
}

async function getTransactions(businessId: string | null, startDate: string | null, endDate: string | null) {
  try {
    const where: Record<string, unknown> = {};
    if (businessId) where.businessId = businessId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, string>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, string>).lte = endDate;
    }

    const transactions = await db.platformTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const bizIds = [...new Set(transactions.map(t => t.businessId).filter((id): id is string => !!id))];
    const bizNames = bizIds.length > 0
      ? await db.business.findMany({ where: { id: { in: bizIds } }, select: { id: true, name: true } })
      : [];
    const bizMap = new Map(bizNames.map(b => [b.id, b.name]));

    const enriched = transactions.map(t => ({
      ...t,
      businessName: t.businessId ? (bizMap.get(t.businessId) || 'Unknown') : null,
    }));

    return successResponse({ data: enriched, total: enriched.length });
  } catch (error) {
    return errorResponse('Failed to fetch transactions', 500);
  }
}

async function getRevenueMetrics() {
  try {
    const [allTxn, settings, premiumListings, payoutAgg, escrowHeld] = await Promise.all([
      db.platformTransaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true, platformFee: true },
        _count: true,
      }),
      db.platformSetting.findFirst({ where: { key: 'platformFee' } }),
      db.premiumListing.count({ where: { status: 'ACTIVE' } }),
      db.payout.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      db.platformTransaction.aggregate({
        where: { type: 'ESCROW_HELD', escrowStatus: 'HELD' },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = allTxn._sum.amount || 0;
    const totalTransactions = allTxn._count;
    const commissionRate = settings ? parseFloat(settings.value) : 15;
    const escrowBalance = escrowHeld._sum?.amount || 0;

    const metrics = {
      totalRevenue,
      totalTransactions,
      averageTransactionValue: totalTransactions > 0 ? Math.round((totalRevenue / totalTransactions) * 100) / 100 : 0,
      commissionRate,
      grossMargin: commissionRate,
      revenueGrowth: 0,
      monthlyRecurringRevenue: 0,
      annualRecurringRevenue: 0,
      activePremiumListings: premiumListings,
      pendingPayouts: payoutAgg._count,
      totalPayoutsAmount: payoutAgg._sum?.amount || 0,
      escrowBalance: escrowBalance,
    };

    return successResponse(metrics);
  } catch (error) {
    return errorResponse('Failed to fetch revenue metrics', 500);
  }
}

async function getRevenueBreakdown(period: string, startDate: string | null, endDate: string | null) {
  try {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const txnByType = await db.platformTransaction.groupBy({
      by: ['type'],
      where: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    });
    const totalTypeRevenue = txnByType.reduce((s, t) => s + (t._sum.amount || 0), 0);
    const byType: Record<string, { amount: number; percentage: number }> = {
      bookingCommission: { amount: 0, percentage: 0 },
      premiumListing: { amount: 0, percentage: 0 },
      marketingBoost: { amount: 0, percentage: 0 },
      subscription: { amount: 0, percentage: 0 },
    };
    const typeKeyMap: Record<string, string> = {
      BOOKING_COMMISSION: 'bookingCommission',
      PREMIUM_LISTING: 'premiumListing',
      MARKETING_BOOST: 'marketingBoost',
      SUBSCRIPTION: 'subscription',
    };
    for (const t of txnByType) {
      const key = typeKeyMap[t.type];
      if (key) {
        byType[key].amount = t._sum.amount || 0;
        byType[key].percentage = totalTypeRevenue > 0 ? Math.round((byType[key].amount / totalTypeRevenue) * 1000) / 10 : 0;
      }
    }

    const completedBookings = await db.booking.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      include: { service: { select: { category: true } } },
    });
    const catMap = new Map<string, { amount: number; transactions: number }>();
    let totalCatRevenue = 0;
    for (const b of completedBookings) {
      const cat = b.service?.category || 'Other';
      const cur = catMap.get(cat) || { amount: 0, transactions: 0 };
      cur.amount += b.totalPrice;
      cur.transactions += 1;
      catMap.set(cat, cur);
      totalCatRevenue += b.totalPrice;
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        transactions: data.transactions,
        percentage: totalCatRevenue > 0 ? Math.round((data.amount / totalCatRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const paymentsByMethod = await db.payment.groupBy({
      by: ['method'],
      where: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    });
    const totalPaymentRevenue = paymentsByMethod.reduce((s, p) => s + (p._sum.amount || 0), 0);
    const byPaymentMethod: Record<string, { amount: number; transactions: number; percentage: number }> = {};
    for (const p of paymentsByMethod) {
      const key = p.method.toLowerCase();
      byPaymentMethod[key] = {
        amount: p._sum.amount || 0,
        transactions: p._count as number,
        percentage: totalPaymentRevenue > 0 ? Math.round(((p._sum.amount || 0) / totalPaymentRevenue) * 1000) / 10 : 0,
      };
    }

    const breakdown = {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      byType,
      byCategory,
      byPaymentMethod,
      growth: { revenueGrowth: 0, transactionGrowth: 0, averageOrderGrowth: 0 },
    };

    return successResponse(breakdown);
  } catch (error) {
    return errorResponse('Failed to fetch revenue breakdown', 500);
  }
}

async function getBusinessRevenue(businessId: string | null) {
  if (!businessId) {
    return errorResponse('Business ID is required', 400);
  }

  try {
    const [business, txnAgg, payouts, recentTxns, premiumListings] = await Promise.all([
      db.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, category: true },
      }),
      db.platformTransaction.aggregate({
        where: { businessId, status: 'COMPLETED' },
        _sum: { amount: true, platformFee: true, providerAmount: true },
        _count: true,
      }),
      db.payout.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
      db.platformTransaction.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.premiumListing.findMany({
        where: { businessId, status: 'ACTIVE' },
        orderBy: { endDate: 'asc' },
      }),
    ]);

    const completedPayouts = payouts.filter(p => p.status === 'COMPLETED');
    const pendingPayouts = payouts.filter(p => p.status === 'PENDING');
    const totalPayoutsAmount = completedPayouts.reduce((s, p) => s + p.amount, 0);
    const pendingPayoutsAmount = pendingPayouts.reduce((s, p) => s + p.amount, 0);
    const lastPayout = completedPayouts[0] || null;

    const recentTransactions = recentTxns.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      commission: t.platformFee,
      netAmount: t.providerAmount,
      status: t.status,
      createdAt: t.createdAt,
    }));

    const activeListing = premiumListings[0] || null;

    const businessRevenue = {
      businessId,
      totalEarnings: 0,
      pendingBalance: pendingPayoutsAmount,
      availableBalance: (txnAgg._sum.providerAmount || 0) - totalPayoutsAmount,
      totalCommissionPaid: txnAgg._sum.platformFee || 0,
      totalPayouts: totalPayoutsAmount,
      lastPayout: lastPayout ? {
        id: lastPayout.id,
        amount: lastPayout.amount,
        status: lastPayout.status,
        completedAt: lastPayout.createdAt,
      } : null,
      nextPayout: {
        estimatedAmount: pendingPayoutsAmount,
        estimatedDate: null,
      },
      premiumListings: {
        active: premiumListings.length,
        totalSpent: premiumListings.reduce((s, p) => s + p.price, 0),
        currentPlan: activeListing?.plan || 'FREE',
        expiresAt: activeListing?.endDate || null,
      },
      recentTransactions,
    };

    return successResponse(businessRevenue);
  } catch (error) {
    return errorResponse('Failed to fetch business revenue', 500);
  }
}

async function getPayoutAccounts(businessId: string | null) {
  if (!businessId) {
    return errorResponse('Business ID is required', 400);
  }

  try {
    const payouts = await db.payout.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return successResponse(payouts);
  } catch (error) {
    return errorResponse('Failed to fetch payout accounts', 500);
  }
}

async function generateChartData(period: string, startDate: Date, endDate: Date) {
  try {
    const transactions = await db.platformTransaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
      select: { amount: true, platformFee: true, createdAt: true },
    });

    const dayMap = new Map<string, { revenue: number; transactions: number; commission: number }>();
    for (const t of transactions) {
      const dateKey = t.createdAt.toISOString().split('T')[0];
      const cur = dayMap.get(dateKey) || { revenue: 0, transactions: 0, commission: 0 };
      cur.revenue += t.amount;
      cur.transactions += 1;
      cur.commission += t.platformFee;
      dayMap.set(dateKey, cur);
    }

    const dataPoints = period === 'daily' ? 24 : period === 'weekly' ? 7 : period === 'yearly' ? 12 : 30;
    const result: { date: string; revenue: number; transactions: number; commission: number }[] = [];

    for (let i = dataPoints - 1; i >= 0; i--) {
      const d = new Date(endDate);
      if (period === 'yearly') {
        d.setMonth(d.getMonth() - i);
      } else if (period === 'weekly') {
        d.setDate(d.getDate() - i);
      } else {
        d.setDate(d.getDate() - i);
      }
      const dateKey = d.toISOString().split('T')[0];
      const data = dayMap.get(dateKey) || { revenue: 0, transactions: 0, commission: 0 };
      result.push({ date: dateKey, ...data });
    }

    return result;
  } catch {
    const dataPoints = period === 'daily' ? 24 : period === 'weekly' ? 7 : period === 'yearly' ? 12 : 30;
    return Array.from({ length: dataPoints }, (_, i) => ({
      date: new Date(Date.now() - (dataPoints - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revenue: 0, transactions: 0, commission: 0,
    }));
  }
}
