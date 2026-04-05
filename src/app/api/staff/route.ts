import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireBusinessOwner } from '@/lib/auth';
import { createStaffSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// List staff for a business
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return errorResponse('Business ID is required', 400);
    }

    // Verify the business belongs to the user or user is admin
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    if (business.ownerId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to view staff for this business', 403);
    }

    const staff = await db.staff.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

// Create staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createStaffSchema.parse(body);
    const user = await requireBusinessOwner(validated.businessId);

    // Verify business ownership
    const business = await db.business.findUnique({
      where: { id: validated.businessId },
      select: { ownerId: true },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    if (business.ownerId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to add staff to this business', 403);
    }

    const { businessId, ...staffData } = validated;

    const staff = await db.staff.create({
      data: {
        businessId,
        ...staffData,
      },
    });

    return successResponse(staff, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
