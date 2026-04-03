import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const { title, message, targetRole, userIds } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    // Build recipient list
    const userWhere: Record<string, unknown> = { isBanned: false };
    if (targetRole && targetRole !== 'all') {
      userWhere.role = targetRole;
    }
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      userWhere.id = { in: userIds };
    }

    const recipients = await db.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }

    // Create notifications for all recipients in batch
    const notifications = recipients.map(r => ({
      userId: r.id,
      title,
      message,
      type: 'announcement' as const,
      isRead: false,
      link: null,
    }));

    const result = await db.notification.createMany({ data: notifications });

    return successResponse({
      sent: result.count,
      message: `Announcement sent to ${result.count} user(s)`,
    });
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}
