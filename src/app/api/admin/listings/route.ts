import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch all premium listings
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

    const listings = await db.premiumListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        business: {
          select: { id: true, name: true },
        },
      },
    });

    const total = await db.premiumListing.count({ where });

    // Stats via groupBy (single query)
    const statusCounts = await db.premiumListing.groupBy({
      by: ['status'],
      _count: true,
      _sum: { price: true },
    });

    const stats: Record<string, number> = { pending: 0, active: 0, expired: 0, totalRevenue: 0 };
    for (const s of statusCounts) {
      const key = (s.status as string).toLowerCase();
      if (key in stats) stats[key] = s._count;
      if (s.status === 'ACTIVE') stats.totalRevenue = s._sum.price || 0;
    }

    // Map to frontend format
    const mapped = listings.map(l => ({
      id: l.id,
      businessName: l.business?.name || 'Unknown',
      businessId: l.businessId,
      plan: l.plan || 'PREMIUM',
      price: l.price,
      status: l.status,
      startDate: l.createdAt,
      endDate: l.endDate,
      createdAt: l.createdAt,
    }));

    return successResponse({
      listings: mapped,
      total,
      stats,
      hasMore: offset + listings.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update listing status/details
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { listingId, status, plan, price, endDate } = body;

    if (!listingId) {
      return errorResponse('Listing ID is required', 400);
    }

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) updateData.status = status;
    if (plan !== undefined) updateData.plan = plan;
    if (price !== undefined) updateData.price = price;
    if (endDate) updateData.endDate = new Date(endDate);

    const listing = await db.premiumListing.update({
      where: { id: listingId },
      data: updateData,
      include: { business: { select: { name: true } } },
    });

    return successResponse({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}
