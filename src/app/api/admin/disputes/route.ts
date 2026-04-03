import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

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
    await requireAdmin();
    const body = await request.json();
    const { disputeId, status, adminMessage, resolution } = body;

    if (!disputeId) {
      return errorResponse('Dispute ID is required', 400);
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    // Store resolution and admin message in the resolution field
    if (adminMessage || resolution) {
      const existing = await db.dispute.findUnique({ where: { id: disputeId } });
      let existingResolution: Record<string, any> = {};
      if (existing?.resolution) {
        try { existingResolution = JSON.parse(existing.resolution); } catch { /* ignore */ }
      }
      if (adminMessage) existingResolution.adminMessage = adminMessage;
      if (resolution) existingResolution.resolution = resolution;
      updateData.resolution = JSON.stringify(existingResolution);
    }

    const dispute = await db.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });

    // If resolution involves refund, process it
    if (resolution && resolution.type === 'FULL_REFUND') {
      if (dispute.bookingId) {
        await db.payment.updateMany({
          where: { bookingId: dispute.bookingId },
          data: { status: 'REFUNDED' },
        });
      }
    }

    return successResponse({ dispute });
  } catch (error) {
    return handleApiError(error);
  }
}
