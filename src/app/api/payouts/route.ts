import { NextRequest, NextResponse } from 'next/server';
import { requireBusinessOwner } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { triggerPayout, getPayoutsForBusiness } from '@/lib/payout';
import { getWallet } from '@/lib/wallet';

/**
 * GET /api/payouts
 * Business owner gets their payout history + wallet balance
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireBusinessOwner();

    // Find the business owned by this user
    const business = await db.business.findFirst({
      where: { ownerId: session.id, isActive: true },
      select: { id: true },
    });

    if (!business) {
      return errorResponse('No active business found', 404);
    }

    const [payouts, wallet] = await Promise.all([
      getPayoutsForBusiness(business.id),
      getWallet(session.id).catch(() => null),
    ]);

    return successResponse({
      payouts,
      wallet: wallet
        ? {
            balance: wallet.balance,
            pendingBalance: wallet.pendingBalance,
            heldBalance: wallet.heldBalance,
            currency: wallet.currency,
          }
        : null,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return errorResponse(err.message, err.message.includes('Unauthorized') ? 401 : 500);
  }
}

/**
 * POST /api/payouts
 * Business owner requests a payout for a specific booking
 * Body: { bookingId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireBusinessOwner();

    const body = await request.json();
    const { bookingId } = body as { bookingId?: string };

    if (!bookingId) {
      return errorResponse('bookingId is required', 400);
    }

    const result = await triggerPayout(bookingId, session.id);

    return successResponse({
      success: result.success,
      payout: {
        id: result.payout.id,
        amount: result.payout.amount,
        netAmount: result.payout.netAmount,
        currency: result.payout.currency,
        method: result.payout.method,
        status: result.payout.status,
        referenceNumber: result.payout.referenceNumber,
        estimatedArrival: result.payout.estimatedArrival,
      },
      message: result.message,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return errorResponse(err.message, 500);
  }
}
