import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch all insurance claims
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

    const claims = await db.insuranceClaim.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.insuranceClaim.count({ where });

    // Calculate stats
    const stats = {
      submitted: await db.insuranceClaim.count({ where: { status: 'SUBMITTED' } }),
      underReview: await db.insuranceClaim.count({ where: { status: 'UNDER_REVIEW' } }),
      approved: await db.insuranceClaim.count({ where: { status: 'APPROVED' } }),
      rejected: await db.insuranceClaim.count({ where: { status: 'REJECTED' } }),
      paid: await db.insuranceClaim.count({ where: { status: 'PAID' } }),
      totalPaid: await db.insuranceClaim.aggregate({
        where: { status: { in: ['APPROVED', 'PAID'] } },
        _sum: { amount: true },
      }),
    };

    return successResponse({
      claims,
      total,
      stats,
      hasMore: offset + claims.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create a new insurance claim
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      customerId,
      customerName,
      customerEmail,
      providerId,
      providerName,
      bookingId,
      type,
      description,
      amount,
      currency,
      documents,
      incidentDate,
    } = body;

    if (!customerName || !customerEmail || !type || !description || !amount) {
      return errorResponse('Missing required fields', 400);
    }

    // Generate claim number
    const claimCount = await db.insuranceClaim.count();
    const claimNumber = `CLM-${new Date().getFullYear()}-${String(claimCount + 1).padStart(3, '0')}`;

    const claim = await db.insuranceClaim.create({
      data: {
        claimNumber,
        customerId,
        customerName,
        customerEmail,
        providerId,
        providerName,
        bookingId,
        type,
        description,
        amount,
        currency: currency || 'USD',
        documents: documents ? JSON.stringify(documents) : null,
        incidentDate: new Date(incidentDate),
        status: 'SUBMITTED',
      },
    });

    return successResponse({ claim }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update claim status/details
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { claimId, status, adminNotes, resolution, reviewedBy } = body;

    if (!claimId) {
      return errorResponse('Claim ID is required', 400);
    }

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = reviewedBy;
    }
    
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }
    
    if (resolution !== undefined) {
      updateData.resolution = resolution;
    }

    const claim = await db.insuranceClaim.update({
      where: { id: claimId },
      data: updateData,
    });

    return successResponse({ claim });
  } catch (error) {
    return handleApiError(error);
  }
}
