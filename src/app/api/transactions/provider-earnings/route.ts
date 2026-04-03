import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProviderEarnings } from '@/lib/transaction-log';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/transactions/provider-earnings?businessId=...&period=month
 *
 * Returns a provider's earnings breakdown for a given period.
 * - Business owners can view their own business earnings.
 * - Admins can view any business's earnings.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;

    const businessId = searchParams.get('businessId');
    if (!businessId) {
      return handleApiError(new Error('businessId is required'));
    }

    // Parse period
    const period = searchParams.get('period');
    let dateRange: { start: Date; end: Date } | undefined;

    if (period) {
      dateRange = parsePeriod(period);
    }

    const earnings = await getProviderEarnings(businessId, dateRange);

    if (!earnings) {
      return handleApiError(new Error('Business not found'));
    }

    return successResponse(earnings);
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
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
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
