import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Create a portfolio item for a business
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { businessId, image, title, description } = body;

    if (!businessId || !image) {
      return errorResponse('Business ID and image are required', 400);
    }

    // Verify business ownership
    const business = await db.business.findFirst({
      where: { id: businessId, ownerId: session.userId },
    });

    if (!business) {
      return errorResponse('Business not found or unauthorized', 404);
    }

    const portfolioItem = await db.portfolioItem.create({
      data: {
        businessId,
        image,
        title: title || null,
        description: description || null,
      },
    });

    return successResponse(portfolioItem, 201);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}

// List portfolio items for a business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return errorResponse('Business ID is required', 400);
    }

    const items = await db.portfolioItem.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return successResponse(items);
  } catch (error) {
    return handleApiError(error);
  }
}
