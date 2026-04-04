import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// PUT - Update FAQ (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Verify FAQ exists
    const existing = await db.fAQ.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('FAQ not found', 404);
    }

    const allowedFields = ['question', 'answer', 'category', 'order', 'isPublished'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    const faq = await db.fAQ.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ faq });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete FAQ (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Verify FAQ exists
    const existing = await db.fAQ.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('FAQ not found', 404);
    }

    await db.fAQ.delete({
      where: { id },
    });

    return successResponse({ message: 'FAQ deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
