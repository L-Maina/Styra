import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';
import { sanitizeResponse } from '@/lib/response-sanitizer';

// Get conversation messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const conversation = await db.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    // Verify user is part of conversation
    const isParticipant =
      conversation.participant1 === user.userId ||
      conversation.participant2 === user.userId;

    if (!isParticipant) {
      return errorResponse('You do not have access to this conversation', 403);
    }

    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where: { conversationId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      }),
      db.chatMessage.count({ where: { conversationId: id } }),
    ]);

    // Mark messages as read (messages not sent by current user)
    await db.chatMessage.updateMany({
      where: {
        conversationId: id,
        senderId: { not: user.userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return paginatedResponse(sanitizeResponse(messages.reverse()), page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}

// Send message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await blockRole('admin');
    const { id } = await params;
    const body = await request.json();

    // Validate content
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return errorResponse('Message content is required', 400);
    }
    if (content.length > 10000) {
      return errorResponse('Message too long (max 10000 characters)', 400);
    }

    const conversation = await db.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    // Verify user is part of conversation
    const isParticipant =
      conversation.participant1 === user.userId ||
      conversation.participant2 === user.userId;

    if (!isParticipant) {
      return errorResponse('You do not have access to this conversation', 403);
    }

    // Determine receiver (the other participant)
    const receiverId = conversation.participant1 === user.userId
      ? conversation.participant2
      : conversation.participant1;

    // Create message
    const message = await db.chatMessage.create({
      data: {
        conversationId: id,
        senderId: user.userId,
        content,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id },
      data: {
        lastMessage: content,
        lastMessageAt: new Date(),
      },
    });

    // Create notification for receiver
    try {
      await db.notification.create({
        data: {
          userId: receiverId,
          title: 'New Message',
          message: content.substring(0, 100),
          type: 'NEW_MESSAGE',
          link: `/chat?conversation=${id}`,
        },
      });
    } catch {
      // Non-blocking: notification creation failure should not prevent message sending
    }

    return successResponse(sanitizeResponse(message), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
