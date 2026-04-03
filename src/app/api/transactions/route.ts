import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getUserTransactions,
  getBookingTransactions,
  type TransactionFilters,
} from '@/lib/transaction-log';
import { successResponse, paginatedResponse, handleApiError } from '@/lib/api-utils';
import type { TransactionLogType, TransactionLogStatus } from '@prisma/client';

const VALID_TYPES: TransactionLogType[] = [
  'PAYMENT_IN',
  'ESCROW_HELD',
  'SERVICE_COMPLETED',
  'PAYOUT_SENT',
  'REFUND',
  'PLATFORM_FEE',
];

const VALID_STATUSES: TransactionLogStatus[] = [
  'COMPLETED',
  'PENDING',
  'FAILED',
];

/**
 * GET /api/transactions?userId=...&bookingId=...&type=...&page=1&limit=20&period=month
 *
 * Paginated transaction history.
 * - Regular users see only their own transactions (userId filter ignored).
 * - Admins can pass userId or bookingId to view any user's transactions.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;

    // Admins can view other users' transactions
    const isViewingOtherUser = user.role === 'ADMIN' && searchParams.get('userId');
    const targetUserId = isViewingOtherUser
      ? searchParams.get('userId')!
      : user.id;

    const bookingId = searchParams.get('bookingId');

    // If bookingId is provided, return booking-specific transactions
    if (bookingId) {
      const transactions = await getBookingTransactions(bookingId);
      return successResponse({ transactions });
    }

    // Build filters
    const filters: TransactionFilters = {
      page: Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20)),
    };

    // Type filter
    const typeParam = searchParams.get('type');
    if (typeParam && VALID_TYPES.includes(typeParam as TransactionLogType)) {
      filters.type = typeParam as TransactionLogType;
    }

    // Status filter
    const statusParam = searchParams.get('status');
    if (statusParam && VALID_STATUSES.includes(statusParam as TransactionLogStatus)) {
      filters.status = statusParam as TransactionLogStatus;
    }

    // Date period filter
    const period = searchParams.get('period');
    if (period) {
      const { start, end } = parsePeriod(period);
      filters.startDate = start;
      filters.endDate = end;
    }

    const { transactions, total } = await getUserTransactions(targetUserId, filters);

    return paginatedResponse(
      transactions,
      filters.page || 1,
      filters.limit || 20,
      total,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Parse a period string into start/end dates.
 */
function parsePeriod(
  period: string,
): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case 'week': {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, -1);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'year': {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    default: {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  }

  return { start, end };
}
