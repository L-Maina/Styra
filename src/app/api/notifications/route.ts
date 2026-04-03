import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';

// List notifications
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const unreadOnly = searchParams.get('unread') === 'true';
    const type = searchParams.get('type');

    const where: Record<string, unknown> = { userId: session.userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    if (type) {
      where.type = type;
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ]);

    return paginatedResponse(notifications, page, limit, total);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}

// Mark all as read
export async function PATCH() {
  try {
    const session = await requireAuth();

    await db.notification.updateMany({
      where: {
        userId: session.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return successResponse({ message: 'All notifications marked as read' });
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}
