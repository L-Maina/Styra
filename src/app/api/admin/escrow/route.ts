import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { getEscrowSummary, getEscrowStatus } from '@/lib/escrow';
import { adminSettleEscrow } from '@/lib/verification';
import { db } from '@/lib/db';
import { getPlatformWalletStats } from '@/lib/wallet';

/** Escrow rows have no relations in the schema, so bookings and businesses are joined here. */
async function withDetails<T extends { bookingId: string | null; businessId: string | null }>(rows: T[]) {
  const bookingIds = Array.from(new Set(rows.map((r) => r.bookingId).filter((id): id is string => !!id)));
  const businessIds = Array.from(new Set(rows.map((r) => r.businessId).filter((id): id is string => !!id)));

  const [bookings, businesses] = await Promise.all([
    bookingIds.length
      ? db.booking.findMany({
          where: { id: { in: bookingIds } },
          select: {
            id: true,
            date: true,
            time: true,
            status: true,
            customer: { select: { id: true, name: true, email: true } },
          },
        })
      : [],
    businessIds.length
      ? db.business.findMany({ where: { id: { in: businessIds } }, select: { id: true, name: true } })
      : [],
  ]);

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const businessById = new Map(businesses.map((b) => [b.id, b]));

  return rows.map((row) => ({
    ...row,
    booking: (row.bookingId && bookingById.get(row.bookingId)) || null,
    business: (row.businessId && businessById.get(row.businessId)) || null,
  }));
}

/**
 * GET /api/admin/escrow
 * Admin views all escrow data + summary
 *
 * Query params:
 *   type: "summary" | "held" | "released" | "disputed" | "refunded" (default: "summary")
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

    const escrowFilter: { type: string; escrowStatus?: string } = { type: 'ESCROW_HELD' };

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

    const rows = await db.platformTransaction.findMany({
      where: escrowFilter,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse({
      summary: escrowSummary,
      walletStats,
      transactions: await withDetails(rows),
      filter: type,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/escrow
 * Admin manually releases or refunds an escrow
 *
 * Body: { bookingId: string, action: "release" | "refund", reason: string }
 *
 * A refund updates the ledger only. The money still has to be sent back through the payment
 * provider; admins get a notification with the payment reference.
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

    if (action !== 'release' && action !== 'refund') {
      return errorResponse('action must be "release" or "refund"', 400);
    }

    const result = await adminSettleEscrow(
      bookingId,
      action,
      reason || (action === 'release' ? 'Admin manual release' : 'Admin manual refund'),
    );

    return successResponse({
      success: true,
      action: result.action,
      ...(result.action === 'released'
        ? { releasedAmount: result.amount }
        : { refundAmount: result.amount }),
      transactionId: result.transactionId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
