import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Get business by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      include: {
        services: {
          where: { isActive: true },
        },
        staff: {
          where: { isActive: true },
        },
        portfolio: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        reviews: {
          include: {
            customer: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        owner: {
          select: { id: true, name: true, avatar: true },
        },
        _count: {
          select: { reviews: true, favorites: true },
        },
      },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    // Use boothPhotoUrl as fallback for coverImage
    const response = {
      ...business,
      coverImage: business.coverImage || business.boothPhotoUrl || null,
    };

    return successResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
}

// Update business
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const business = await db.business.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    if (session.role !== 'ADMIN' && business.ownerId !== session.userId) {
      return errorResponse('You do not have permission to update this business', 403);
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.category !== undefined) data.category = body.category;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.email !== undefined) data.email = body.email;
    if (body.website !== undefined) data.website = body.website;
    if (body.address !== undefined) data.address = body.address;
    if (body.city !== undefined) data.city = body.city;
    if (body.country !== undefined) data.country = body.country;
    if (body.latitude !== undefined) data.latitude = body.latitude;
    if (body.longitude !== undefined) data.longitude = body.longitude;
    if (body.logo !== undefined) data.logo = body.logo;
    if (body.coverImage !== undefined) data.coverImage = body.coverImage;
    if (body.operatingHours !== undefined) {
      data.operatingHours = typeof body.operatingHours === 'string'
        ? body.operatingHours
        : JSON.stringify(body.operatingHours);
    }
    if (body.amenities !== undefined) {
      data.amenities = typeof body.amenities === 'string'
        ? body.amenities
        : JSON.stringify(body.amenities);
    }

    const updatedBusiness = await db.business.update({
      where: { id },
      data,
    });

    return successResponse(updatedBusiness);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}

// Delete business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    if (session.role !== 'ADMIN' && business.ownerId !== session.userId) {
      return errorResponse('You do not have permission to delete this business', 403);
    }

    await db.business.delete({
      where: { id },
    });

    return successResponse({ message: 'Business deleted successfully' });
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}
