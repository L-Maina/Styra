import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// PUT - Update team member (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Verify member exists
    const existing = await db.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Team member not found', 404);
    }

    const allowedFields = ['name', 'role', 'bio', 'image', 'order', 'isActive'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    const member = await db.teamMember.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ member });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete team member (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Verify member exists
    const existing = await db.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Team member not found', 404);
    }

    await db.teamMember.delete({
      where: { id },
    });

    return successResponse({ message: 'Team member deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
