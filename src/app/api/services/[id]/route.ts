import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { updateServiceSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Get service by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const service = await db.service.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        timeSlots: {
          where: {
            date: { gte: new Date().toISOString().split('T')[0] },
            isBooked: false,
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: 50,
        },
      },
    });

    if (!service) {
      return errorResponse('Service not found', 404);
    }

    return successResponse(service);
  } catch (error) {
    return handleApiError(error);
  }
}

// Update service
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const validated = updateServiceSchema.parse(body);

    const service = await db.service.findUnique({
      where: { id },
      include: { business: { select: { ownerId: true } } },
    });

    if (!service) {
      return errorResponse('Service not found', 404);
    }

    if (service.business.ownerId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to update this service', 403);
    }

    const updatedService = await db.service.update({
      where: { id },
      data: validated,
    });

    return successResponse(updatedService);
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete service (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const service = await db.service.findUnique({
      where: { id },
      include: { business: { select: { ownerId: true } } },
    });

    if (!service) {
      return errorResponse('Service not found', 404);
    }

    if (service.business.ownerId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to delete this service', 403);
    }

    // Soft delete
    await db.service.update({
      where: { id },
      data: { isActive: false },
    });

    return successResponse({ message: 'Service deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
