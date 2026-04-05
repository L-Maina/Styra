import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth, blockRole } from '@/lib/auth';

// POST /api/jobs/[id]/apply - Submit a job application
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await blockRole('admin');
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, coverLetter, resume } = body;

    if (!name || !email) {
      return errorResponse('Name and email are required', 400);
    }

    // Verify the job exists and is open
    const job = await db.job.findUnique({
      where: { id },
    });

    if (!job) {
      return errorResponse('Job not found', 404);
    }

    if (job.status !== 'OPEN') {
      return errorResponse('This job is no longer accepting applications', 400);
    }

    const application = await db.jobApplication.create({
      data: {
        jobId: id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        coverLetter: coverLetter?.trim() || null,
        resume: resume || null,
      },
    });

    return successResponse({ application }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
