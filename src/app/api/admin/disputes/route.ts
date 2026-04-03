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
    });

    const total = await db.dispute.count({ where });

    // Calculate stats
    const stats = {
      open: await db.dispute.count({ where: { status: 'OPEN' } }),
      inProgress: await db.dispute.count({ where: { status: 'IN_PROGRESS' } }),
      resolved: await db.dispute.count({ where: { status: 'RESOLVED' } }),
      totalAmount: await db.dispute.aggregate({
        _sum: { amount: true },
      }),
    };

    return successResponse({
      disputes,
      total,
      stats,
      hasMore: offset + disputes.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create a new dispute
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      bookingId,
      customerId,
      customerName,
      providerId,
      providerName,
      type,
      description,
      amount,
    } = body;

    if (!customerName || !providerName || !type || !description || !amount) {
      return errorResponse('Missing required fields', 400);
    }

    const dispute = await db.dispute.create({
      data: {
        bookingId,
        customerId,
        customerName,
        providerId,
        providerName,
        type,
        description,
        amount,
        status: 'OPEN',
      },
    });

    return successResponse({ dispute }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update dispute status/resolution
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { disputeId, status, resolution } = body;

    if (!disputeId) {
      return errorResponse('Dispute ID is required', 400);
    }

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED') {
        updateData.resolvedAt = new Date();
      }
    }
    
    if (resolution !== undefined) {
      updateData.resolution = JSON.stringify(resolution);
    }

    const dispute = await db.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });

    // If resolution involves refund, process it
    if (resolution && resolution.type === 'FULL_REFUND') {
      // Find the payment and mark as refunded
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

// DELETE - Delete a dispute
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Dispute ID is required', 400);
    }

    await db.dispute.delete({
      where: { id },
    });

    return successResponse({ message: 'Dispute deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
