import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch single job with application count (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await db.job.findUnique({
      where: { id },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!job) {
      return errorResponse('Job not found', 404);
    }

    // Non-open jobs require admin access
    if (job.status !== 'OPEN') {
      await requireAdmin();
    }

    return successResponse({ job });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update job (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Verify job exists
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Job not found', 404);
    }

    const allowedFields = ['title', 'department', 'location', 'type', 'description', 'requirements', 'status'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    const job = await db.job.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ job });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete job (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Verify job exists
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Job not found', 404);
    }

    await db.job.delete({
      where: { id },
    });

    return successResponse({ message: 'Job deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
