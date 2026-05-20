import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { updateBusinessSchema } from '@/lib/validations';

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

    // Validate input with Zod schema
    const validated = updateBusinessSchema.parse(body);

    const data: Record<string, unknown> = {};
    if (validated.name !== undefined) data.name = validated.name;
    if (validated.description !== undefined) data.description = validated.description;
    if (validated.category !== undefined) data.category = validated.category;
    if (validated.phone !== undefined) data.phone = validated.phone;
    if (validated.email !== undefined) data.email = validated.email;
    if (validated.website !== undefined) data.website = validated.website;
    if (validated.address !== undefined) data.address = validated.address;
    if (validated.city !== undefined) data.city = validated.city;
    if (validated.country !== undefined) data.country = validated.country;
    if (validated.latitude !== undefined) data.latitude = validated.latitude;
    if (validated.longitude !== undefined) data.longitude = validated.longitude;
    if (validated.logo !== undefined) data.logo = validated.logo;
    if (validated.coverImage !== undefined) data.coverImage = validated.coverImage;

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
