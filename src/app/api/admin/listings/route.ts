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
    });

    const total = await db.premiumListing.count({ where });

    // Calculate stats
    const stats = {
      pending: await db.premiumListing.count({ where: { status: 'PENDING' } }),
      active: await db.premiumListing.count({ where: { status: 'ACTIVE' } }),
      expired: await db.premiumListing.count({ where: { status: 'EXPIRED' } }),
      totalRevenue: await db.premiumListing.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { price: true },
      }),
    };

    return successResponse({
      listings,
      total,
      stats,
      hasMore: offset + listings.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create a new premium listing
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      businessId,
      businessName,
      plan,
      price,
      startDate,
      endDate,
    } = body;

    if (!businessId || !businessName || !plan || !price || !startDate || !endDate) {
      return errorResponse('Missing required fields', 400);
    }

    // Check if business already has a listing
    const existingListing = await db.premiumListing.findUnique({
      where: { businessId },
    });

    if (existingListing && existingListing.status === 'ACTIVE') {
      return errorResponse('Business already has an active premium listing', 400);
    }

    const listing = await db.premiumListing.create({
      data: {
        businessId,
        businessName,
        plan,
        price,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'PENDING',
      },
    });

    // Update business subscription plan
    await db.business.update({
      where: { id: businessId },
      data: { subscriptionPlan: plan },
    });

    return successResponse({ listing }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update listing status/details
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { listingId, status, plan, price, endDate, impressions, clicks, conversions } = body;

    if (!listingId) {
      return errorResponse('Listing ID is required', 400);
    }

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
    }
    
    if (plan) {
      updateData.plan = plan;
    }
    
    if (price !== undefined) {
      updateData.price = price;
    }
    
    if (endDate) {
      updateData.endDate = new Date(endDate);
    }
    
    if (impressions !== undefined) {
      updateData.impressions = impressions;
    }
    
    if (clicks !== undefined) {
      updateData.clicks = clicks;
    }
    
    if (conversions !== undefined) {
      updateData.conversions = conversions;
    }

    const listing = await db.premiumListing.update({
      where: { id: listingId },
      data: updateData,
    });

    // Update business subscription plan if status changed to active
    if (status === 'ACTIVE' && listing.plan) {
      await db.business.update({
        where: { id: listing.businessId },
        data: { subscriptionPlan: listing.plan },
      });
    }

    return successResponse({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete a listing
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Listing ID is required', 400);
    }

    const listing = await db.premiumListing.findUnique({
      where: { id },
    });

    if (listing) {
      // Update business subscription plan to FREE
      await db.business.update({
        where: { id: listing.businessId },
        data: { subscriptionPlan: 'FREE' },
      });
    }

    await db.premiumListing.delete({
      where: { id },
    });

    return successResponse({ message: 'Listing deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
