import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return errorResponse('Notification not found', 404);
    }

    if (notification.userId !== user.userId) {
      return errorResponse('You do not have permission to access this notification', 403);
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return errorResponse('Notification not found', 404);
    }

    if (notification.userId !== user.userId) {
      return errorResponse('You do not have permission to delete this notification', 403);
    }

    await db.notification.delete({
      where: { id },
    });

    return successResponse({ message: 'Notification deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
