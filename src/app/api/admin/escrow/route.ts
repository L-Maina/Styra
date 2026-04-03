import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import {
  getEscrowSummary,
  getEscrowStatus,
  releaseFromEscrow,
  refundFromEscrow,
} from '@/lib/escrow';
import { db } from '@/lib/db';
import { getPlatformWalletStats } from '@/lib/wallet';

/**
 * GET /api/admin/escrow
 * Admin views all escrow data + summary
 *
 * Query params:
 *   type: "summary" | "held" | "released" | "disputed" (default: "summary")
 *   bookingId: string (get specific booking's escrow status)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const bookingId = searchParams.get('bookingId');

    // Single booking escrow status
    if (bookingId) {
      const status = await getEscrowStatus(bookingId);
      return successResponse(status);
    }

    // Summary view
    const [escrowSummary, walletStats] = await Promise.all([
      getEscrowSummary(),
      getPlatformWalletStats().catch(() => null),
    ]);

    let transactions: unknown[] = [];
    const escrowFilter: Record<string, unknown> = { type: 'ESCROW_HELD' };

    switch (type) {
      case 'held':
        escrowFilter.escrowStatus = 'HELD';
        break;
      case 'released':
        escrowFilter.escrowStatus = 'RELEASED';
        break;
      case 'disputed':
        escrowFilter.escrowStatus = 'DISPUTED';
        break;
      case 'refunded':
        escrowFilter.escrowStatus = 'REFUNDED';
        break;
    }

    const queryOptions: any = {
      where: escrowFilter,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        booking: {
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            customer: { select: { id: true, name: true, email: true } },
          },
        },
        business: {
          select: { id: true, name: true },
        },
      },
    };
    transactions = await db.platformTransaction.findMany(queryOptions) as unknown[];

    return successResponse({
      summary: escrowSummary,
      walletStats,
      transactions,
      filter: type,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return errorResponse(err.message, err.message.includes('Unauthorized') ? 401 : 500);
  }
}

/**
 * POST /api/admin/escrow
 * Admin manually releases or refunds an escrow
 *
 * Body: { bookingId: string, action: "release" | "refund", reason: string }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { bookingId, action, reason } = body as {
      bookingId?: string;
      action?: string;
      reason?: string;
    };

    if (!bookingId || !action) {
      return errorResponse('bookingId and action are required', 400);
    }

    if (!['release', 'refund'].includes(action)) {
      return errorResponse('action must be "release" or "refund"', 400);
    }

    if (action === 'release') {
      const result = await releaseFromEscrow(bookingId, reason || 'Admin manual release');
      return successResponse({
        success: true,
        action: 'released',
        releasedAmount: result.releasedAmount,
        transactionId: result.transaction.id,
      });
    }

    // action === 'refund'
    const result = await refundFromEscrow(bookingId, reason || 'Admin manual refund');
    return successResponse({
      success: true,
      action: 'refunded',
      refundAmount: result.refundAmount,
      transactionId: result.transaction.id,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return errorResponse(err.message, 500);
  }
}
