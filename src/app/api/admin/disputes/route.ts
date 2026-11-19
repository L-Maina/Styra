import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';
import { resolveDispute, DISPUTE_RESOLUTIONS } from '@/lib/verification';

/** Statuses an admin can set directly. RESOLVED goes through resolveDispute so money moves. */
const DIRECT_STATUSES = ['OPEN', 'IN_PROGRESS'];

// GET - Fetch all disputes
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    const disputes = await db.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        customer: { select: { name: true, email: true } },
        provider: { select: { name: true, email: true } },
        booking: { select: { totalPrice: true, serviceName: true } },
      },
    });

    const total = await db.dispute.count({ where });

    // Stats (3 queries instead of 4 - use groupBy for efficiency)
    const [statusCounts] = await Promise.all([
      db.dispute.groupBy({ by: ['status'], _count: true }),
    ]);

    const stats = { open: 0, inProgress: 0, resolved: 0 };
    for (const s of statusCounts) {
      if (s.status === 'OPEN') stats.open = s._count;
      else if (s.status === 'IN_PROGRESS') stats.inProgress = s._count;
      else if (s.status === 'RESOLVED') stats.resolved = s._count;
    }

    // Map to frontend-friendly format
    const mapped = disputes.map(d => ({
      id: d.id,
      bookingId: d.bookingId,
      status: d.status,
      reason: d.reason,
      description: d.description,
      amount: d.booking?.totalPrice || 0,
      createdAt: d.createdAt,
      customerName: d.customer?.name || 'Unknown',
      providerName: d.provider?.name || 'Unknown',
      resolution: d.resolution ? (() => { try { return JSON.parse(d.resolution); } catch { return null; } })() : null,
    }));

    return successResponse({
      disputes: mapped,
      total,
      stats,
      hasMore: offset + disputes.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update dispute status/resolution
export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    const body = await request.json();
    const { disputeId, status, adminMessage, resolution } = body;

    if (!disputeId) {
      return errorResponse('Dispute ID is required', 400);
    }

    // If a resolution type is provided, use the proper resolveDispute flow
    // which handles escrow release/refund, wallet balances, and TransactionLog entries
    // Errors from resolveDispute (wrong state, nothing to refund, ...) carry a status and a
    // message that is safe to show, and are turned into a response by handleApiError below.
    if (resolution?.type && (DISPUTE_RESOLUTIONS as readonly string[]).includes(resolution.type)) {
      const result = await resolveDispute(disputeId, resolution.type, adminUser.id, {
        notes: typeof adminMessage === 'string' ? adminMessage : undefined,
        customerRefundAmount:
          typeof resolution.customerRefundAmount === 'number' ? resolution.customerRefundAmount : undefined,
      });

      // If adminMessage is provided, keep it under its own key in the resolution JSON
      if (adminMessage) {
        const existing = await db.dispute.findUnique({ where: { id: disputeId } });
        if (existing?.resolution) {
          let existingResolution: Record<string, any> = {};
          try { existingResolution = JSON.parse(existing.resolution); } catch { /* ignore */ }
          existingResolution.adminMessage = adminMessage;
          await db.dispute.update({
            where: { id: disputeId },
            data: { resolution: JSON.stringify(existingResolution) },
          });
        }
      }

      return successResponse({
        dispute: result.dispute,
        message: result.message,
        refundAmount: result.refundAmount,
      });
    }

    // Fallback: status/message update without money operations. A dispute can only be moved
    // between OPEN and IN_PROGRESS here. RESOLVED needs a resolution type, because resolving
    // is what releases or refunds the held payment.
    const updateData: Record<string, unknown> = {};

    if (status) {
      if (!DIRECT_STATUSES.includes(status)) {
        return errorResponse(
          'To resolve a dispute, choose a resolution: release to provider, full refund or partial refund.',
          400,
        );
      }
      const current = await db.dispute.findUnique({ where: { id: disputeId }, select: { status: true } });
      if (!current) {
        return errorResponse('Dispute not found', 404);
      }
      if (current.status === 'RESOLVED') {
        return errorResponse('This dispute is already resolved.', 409);
      }
      updateData.status = status;
    }

    // Store admin message in the resolution field
    if (adminMessage) {
      const existing = await db.dispute.findUnique({ where: { id: disputeId } });
      let existingResolution: Record<string, any> = {};
      if (existing?.resolution) {
        try { existingResolution = JSON.parse(existing.resolution); } catch { /* ignore */ }
      }
      existingResolution.adminMessage = adminMessage;
      updateData.resolution = JSON.stringify(existingResolution);
    }

    const dispute = await db.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });

    return successResponse({ dispute });
  } catch (error) {
    return handleApiError(error);
  }
}
