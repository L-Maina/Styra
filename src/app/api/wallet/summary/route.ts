import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getWalletSummary } from '@/lib/wallet';
import { getUserTransactions } from '@/lib/transaction-log';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/wallet/summary
 *
 * Returns a detailed wallet summary including:
 * - Total earnings, pending, held, withdrawn
 * - Wallet balances
 * - Last 10 recent transactions
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const [summary, txResult] = await Promise.all([
      getWalletSummary(user.id),
      getUserTransactions(user.id, { page: 1, limit: 10 }),
    ]);

    return successResponse({
      wallet: {
        id: summary.wallet.id,
        balance: summary.wallet.balance,
        pendingBalance: summary.wallet.pendingBalance,
        heldBalance: summary.wallet.heldBalance,
        currency: summary.wallet.currency,
        updatedAt: summary.wallet.updatedAt,
      },
      totalEarnings: summary.totalEarnings,
      totalPending: summary.totalPending,
      totalHeld: summary.totalHeld,
      totalWithdrawn: summary.totalWithdrawn,
      recentTransactions: txResult.transactions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
