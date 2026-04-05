import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// POST /api/submissions - Submit a contact form (PUBLIC - contact/support forms)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, email, phone, subject, message, category, userId, metadata } = body;

    const validTypes = ['CONTACT', 'SUPPORT', 'FEEDBACK', 'PARTNERSHIP', 'REPORT', 'CLAIM', 'OTHER'];
    if (!type || !validTypes.includes(type)) {
      return errorResponse(`Invalid submission type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Use transaction for atomic submission + notification
    const submission = await db.$transaction(async (tx) => {
      const sub = await tx.formSubmission.create({
        data: {
          type,
          name: name?.substring(0, 200) || null,
          email: email?.substring(0, 200) || null,
          phone: phone?.substring(0, 30) || null,
          subject: subject?.substring(0, 300) || null,
          message: message?.substring(0, 5000) || null,
          category: category?.substring(0, 100) || null,
          userId: userId || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          status: 'PENDING',
        },
      });

      // Notify all admin users about the new submission
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: `New ${type.toLowerCase()} submission`,
            message: subject || message?.substring(0, 100) || 'New form submission received',
            type: 'SYSTEM_ALERT',
            link: JSON.stringify({ submissionId: sub.id, type }),
          },
        });
      }

      return sub;
    });

    return successResponse({
      message: 'Submission received successfully',
      id: submission.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/submissions - List all submissions (ADMIN ONLY)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0);

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const submissions = await db.formSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.formSubmission.count({ where });

    return successResponse({
      submissions,
      total,
      hasMore: offset + submissions.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
