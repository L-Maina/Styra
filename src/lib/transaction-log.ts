/**
 * Unified Transaction Log
 *
 * Every financial event creates a TransactionLog entry.
 * This provides a complete audit trail and powers user-facing
 * financial history views.
 *
 * Types: PAYMENT_IN, ESCROW_HELD, SERVICE_COMPLETED, PAYOUT_SENT, REFUND, PLATFORM_FEE
 *
 * All logging is fire-and-forget — errors are caught and logged but
 * never propagated to callers (non-blocking).
 */

import { db } from '@/lib/db';
import type { TransactionLog, TransactionLogType, TransactionLogStatus } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LogTransactionData {
  userId: string;
  bookingId?: string;
  amount: number;
  type: TransactionLogType;
  status?: TransactionLogStatus;
  provider?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionFilters {
  type?: TransactionLogType;
  status?: TransactionLogStatus;
  provider?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface ProviderEarnings {
  businessId: string;
  businessName: string;
  period: { start: Date; end: Date };
  totalEarnings: number;
  totalPlatformFees: number;
  totalRefunds: number;
  totalPayouts: number;
  netEarnings: number;
  bookingCount: number;
}

export interface PlatformFinancialOverview {
  period: { start: Date; end: Date };
  totalRevenue: number;
  totalPlatformFees: number;
  totalPayouts: number;
  totalRefunds: number;
  totalDisputed: number;
  netPlatformRevenue: number;
  transactionCount: number;
}

export interface TransactionStats {
  totalEarnings: number;
  totalPending: number;
  totalRefunded: number;
  totalPlatformFees: number;
  totalPayouts: number;
  transactionCount: number;
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Create a transaction log entry.
 * This is the single entry point for all financial event logging.
 * Errors are caught and logged but never thrown (fire-and-forget).
 */
export async function logTransaction(data: LogTransactionData): Promise<TransactionLog | null> {
  try {
    const entry = await db.transactionLog.create({
      data: {
        userId: data.userId,
        bookingId: data.bookingId || null,
        amount: data.amount,
        type: data.type,
        status: data.status || 'COMPLETED',
        provider: data.provider || null,
        referenceId: data.referenceId || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });

    return entry;
  } catch (error) {
    // Fire-and-forget: log but never block
    if (process.env.NODE_ENV === 'development') {
      console.error('[TransactionLog] Failed to log transaction:', error instanceof Error ? error.message : 'unknown');
    }
    return null;
  }
}

/**
 * Get a user's transaction history with optional filters and pagination.
 *
 * @param userId  - The user whose transactions to retrieve
 * @param filters - Optional filters (type, status, date range, pagination)
 */
export async function getUserTransactions(
  userId: string,
  filters?: TransactionFilters,
): Promise<{ transactions: TransactionLog[]; total: number }> {
  const page = filters?.page || 1;
  const limit = Math.min(filters?.limit || 20, 100);

  const where: Record<string, unknown> = { userId };

  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;
  if (filters?.provider) where.provider = filters.provider;

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) (where.createdAt as Record<string, unknown>).gte = filters.startDate;
    if (filters.endDate) (where.createdAt as Record<string, unknown>).lte = filters.endDate;
  }

  const [transactions, total] = await Promise.all([
    db.transactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.transactionLog.count({ where }),
  ]);

  return { transactions, total };
}

/**
 * Get all transaction log entries for a specific booking.
 * Useful for viewing the complete financial lifecycle of a booking.
 *
 * @param bookingId - The booking ID
 */
export async function getBookingTransactions(bookingId: string): Promise<TransactionLog[]> {
  return db.transactionLog.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get a provider's earnings breakdown for a given period.
 *
 * @param businessId - The business ID (used to find the owner)
 * @param period     - Optional { start, end } date range (defaults to current month)
 */
export async function getProviderEarnings(
  businessId: string,
  period?: { start: Date; end: Date },
): Promise<ProviderEarnings | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true, name: true },
  });

  if (!business) return null;

  const now = new Date();
  const start = period?.start || new Date(now.getFullYear(), now.getMonth(), 1);
  const end = period?.end || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [earnings, fees, refunds, payouts, bookingCount] = await Promise.all([
    db.transactionLog.aggregate({
      where: {
        userId: business.ownerId,
        type: 'SERVICE_COMPLETED',
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: {
        userId: business.ownerId,
        type: 'PLATFORM_FEE',
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: {
        userId: business.ownerId,
        type: 'REFUND',
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: {
        userId: business.ownerId,
        type: 'PAYOUT_SENT',
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // Count unique bookings that contributed to earnings
    db.transactionLog.groupBy({
      by: ['bookingId'],
      where: {
        userId: business.ownerId,
        type: 'SERVICE_COMPLETED',
        status: 'COMPLETED',
        bookingId: { not: null },
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
    }),
  ]);

  const totalEarnings = earnings._sum.amount || 0;
  const totalPlatformFees = fees._sum.amount || 0;
  const totalRefunds = refunds._sum.amount || 0;
  const totalPayouts = payouts._sum.amount || 0;

  return {
    businessId,
    businessName: business.name,
    period: { start, end },
    totalEarnings,
    totalPlatformFees,
    totalRefunds,
    totalPayouts,
    netEarnings: totalEarnings - totalRefunds - totalPayouts,
    bookingCount: bookingCount.length,
  };
}

/**
 * Get a platform-wide financial overview for admin dashboards.
 *
 * @param period - Optional { start, end } date range (defaults to current month)
 */
export async function getPlatformFinancialOverview(
  period?: { start: Date; end: Date },
): Promise<PlatformFinancialOverview> {
  const now = new Date();
  const start = period?.start || new Date(now.getFullYear(), now.getMonth(), 1);
  const end = period?.end || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const dateFilter = { createdAt: { gte: start, lte: end } };

  const [revenue, fees, payouts, refunds, disputed, count] = await Promise.all([
    db.transactionLog.aggregate({
      where: { type: 'PAYMENT_IN', status: 'COMPLETED', ...dateFilter },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { type: 'PLATFORM_FEE', status: 'COMPLETED', ...dateFilter },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { type: 'PAYOUT_SENT', status: 'COMPLETED', ...dateFilter },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { type: 'REFUND', status: 'COMPLETED', ...dateFilter },
      _sum: { amount: true },
    }),
    db.platformTransaction.aggregate({
      where: { status: 'DISPUTED', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    db.transactionLog.count({
      where: { ...dateFilter },
    }),
  ]);

  const totalRevenue = revenue._sum.amount || 0;
  const totalPlatformFees = fees._sum.amount || 0;
  const totalPayouts = payouts._sum.amount || 0;
  const totalRefunds = refunds._sum.amount || 0;
  const totalDisputed = disputed._sum.amount || 0;

  return {
    period: { start, end },
    totalRevenue,
    totalPlatformFees,
    totalPayouts,
    totalRefunds,
    totalDisputed,
    netPlatformRevenue: totalPlatformFees - totalRefunds,
    transactionCount: count,
  };
}

/**
 * Get a user's financial summary stats.
 *
 * @param userId - The user ID
 */
export async function getTransactionStats(userId: string): Promise<TransactionStats> {
  const [
    earnings,
    pending,
    refunded,
    platformFees,
    payouts,
    count,
  ] = await Promise.all([
    db.transactionLog.aggregate({
      where: { userId, type: 'SERVICE_COMPLETED', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { userId, type: 'ESCROW_HELD', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { userId, type: 'REFUND', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { userId, type: 'PLATFORM_FEE', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.transactionLog.aggregate({
      where: { userId, type: 'PAYOUT_SENT', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.transactionLog.count({ where: { userId } }),
  ]);

  return {
    totalEarnings: earnings._sum.amount || 0,
    totalPending: pending._sum.amount || 0,
    totalRefunded: refunded._sum.amount || 0,
    totalPlatformFees: platformFees._sum.amount || 0,
    totalPayouts: payouts._sum.amount || 0,
    transactionCount: count,
  };
}
