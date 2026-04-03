import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { updateStaffSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Update staff member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const validated = updateStaffSchema.parse(body);

    const staff = await db.staff.findUnique({
      where: { id },
      include: { business: { select: { ownerId: true } } },
    });

    if (!staff) {
      return errorResponse('Staff member not found', 404);
    }

    if (staff.business.ownerId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to update this staff member', 403);
    }

    const updatedStaff = await db.staff.update({
      where: { id },
      data: validated,
    });

    return successResponse(updatedStaff);
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const staff = await db.staff.findUnique({
      where: { id },
      include: { business: { select: { ownerId: true } } },
    });

    if (!staff) {
      return errorResponse('Staff member not found', 404);
    }

    if (staff.business.ownerId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to delete this staff member', 403);
    }

    await db.staff.delete({
      where: { id },
    });

    return successResponse({ message: 'Staff member deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
