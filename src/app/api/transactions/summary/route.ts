import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTransactionStats } from '@/lib/transaction-log';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/transactions/summary?userId=...
 *
 * Returns aggregated financial stats for a user.
 * - Regular users see only their own stats.
 * - Admins can pass userId to view any user's stats.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;

    const isViewingOtherUser = user.role === 'ADMIN' && searchParams.get('userId');
    const targetUserId = isViewingOtherUser
      ? searchParams.get('userId')!
      : user.id;

    const stats = await getTransactionStats(targetUserId);

    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
