import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Admin: Fetch all jobs (including closed/draft) with application counts
export async function GET() {
  try {
    await requireAdmin();

    const jobs = await db.job.findMany({
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ jobs });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Admin: Update job status { jobId, status }
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { jobId, status } = body;

    if (!jobId) {
      return errorResponse('Job ID is required', 400);
    }

    if (!status || !['OPEN', 'CLOSED', 'DRAFT'].includes(status)) {
      return errorResponse('Status must be OPEN, CLOSED, or DRAFT', 400);
    }

    // Verify job exists
    const existing = await db.job.findUnique({ where: { id: jobId } });
    if (!existing) {
      return errorResponse('Job not found', 404);
    }

    const job = await db.job.update({
      where: { id: jobId },
      data: { status },
    });

    return successResponse({ job });
  } catch (error) {
    return handleApiError(error);
  }
}
