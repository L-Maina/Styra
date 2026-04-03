import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { createServiceSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';

// List services for a business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const { page, limit, skip } = parsePagination(searchParams);

    const validSortFields = ['price', 'name', 'createdAt', 'duration'];
    const resolvedSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    if (!businessId) {
      return errorResponse('Business ID is required', 400);
    }

    const where: Record<string, unknown> = {
      businessId,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = { contains: search };
    }

    const [services, total] = await Promise.all([
      db.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [resolvedSortBy]: sortOrder },
      }),
      db.service.count({ where }),
    ]);

    return paginatedResponse(services, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}

// Create new service
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole('business', 'admin');
    const body = await request.json();
    const validated = createServiceSchema.parse(body);

    // Verify business ownership
    const business = await db.business.findFirst({
      where: { ownerId: session.userId },
    });

    if (!business) {
      return errorResponse('You do not have a registered business', 404);
    }

    const service = await db.service.create({
      data: {
        businessId: business.id,
        name: validated.name,
        description: validated.description || null,
        category: validated.category || null,
        duration: validated.duration,
        price: validated.price,
        image: validated.imageUrl || null,
      },
    });

    return successResponse(service, 201);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}
