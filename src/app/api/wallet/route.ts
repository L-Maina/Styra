import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getWallet } from '@/lib/wallet';
import { getUserTransactions } from '@/lib/transaction-log';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/wallet
 *
 * Returns the authenticated user's wallet (balance, pendingBalance, heldBalance, currency)
 * along with their 10 most recent transactions.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const [wallet, txResult] = await Promise.all([
      getWallet(user.id),
      getUserTransactions(user.id, { page: 1, limit: 10 }),
    ]);

    return successResponse({
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        updatedAt: wallet.updatedAt,
      },
      recentTransactions: txResult.transactions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
