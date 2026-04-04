import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch OPEN jobs (public). Use ?admin=true for all statuses (requires admin).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminParam = searchParams.get('admin');

    let includeAllStatuses = false;
    if (adminParam === 'true') {
      // SECURITY: Require admin auth to query non-open jobs
      await requireAdmin();
      includeAllStatuses = true;
    }

    const where: Record<string, unknown> = {};

    if (!includeAllStatuses) {
      where.status = 'OPEN';
    }

    const jobs = await db.job.findMany({
      where,
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

// POST - Dual purpose:
//   1. Admin: Create a job listing
//   2. Public: Submit a job application (requires jobId, name, email)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If has jobId + name + email → it's a public job application
    if (body.jobId && body.name && body.email) {
      if (!body.jobId) {
        return errorResponse('Job ID is required', 400);
      }

      // Verify the job exists and is open
      const job = await db.job.findUnique({
        where: { id: body.jobId },
      });

      if (!job) {
        return errorResponse('Job not found', 404);
      }

      if (job.status !== 'OPEN') {
        return errorResponse('This job is no longer accepting applications', 400);
      }

      const application = await db.jobApplication.create({
        data: {
          jobId: body.jobId,
          name: body.name,
          email: body.email,
          phone: body.phone || null,
          resume: body.resume || null,
          coverLetter: body.coverLetter || null,
        },
      });

      return successResponse({ application }, 201);
    }

    // Otherwise, admin creating a job listing
    await requireAdmin();
    const { title, department, location, type, description, requirements, status } = body;

    if (!title || !department || !description || !requirements) {
      return errorResponse('Title, department, description, and requirements are required', 400);
    }

    const job = await db.job.create({
      data: {
        title,
        department,
        location: location || 'Nairobi, Kenya',
        type: type || 'Full-time',
        description,
        requirements,
        status: status || 'OPEN',
      },
    });

    return successResponse({ job }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
