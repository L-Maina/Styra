import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendMessageSchema } from '@/lib/validations';
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
      conversation.customerId === user.id ||
      (await db.business.findFirst({
        where: { id: conversation.businessId, ownerId: user.id },
      }));

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

    // Mark messages as read
    await db.chatMessage.updateMany({
      where: {
        conversationId: id,
        receiverId: user.id,
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
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const validated = sendMessageSchema.parse(body);

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    // Verify user is part of conversation
    const isCustomer = conversation.customerId === user.id;
    const isBusinessOwner = conversation.business.ownerId === user.id;

    if (!isCustomer && !isBusinessOwner) {
      return errorResponse('You do not have access to this conversation', 403);
    }

    // Create message
    const message = await db.chatMessage.create({
      data: {
        conversationId: id,
        senderId: user.id,
        receiverId: validated.receiverId,
        content: validated.content,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id },
      data: {
        lastMessage: validated.content,
        lastMessageAt: new Date(),
      },
    });

    // Create notification for receiver
    await db.notification.create({
      data: {
        userId: validated.receiverId,
        title: 'New Message',
        message: validated.content.substring(0, 100),
        type: 'NEW_MESSAGE',
        data: JSON.stringify({ conversationId: id, messageId: message.id }),
      },
    });

    return successResponse(sanitizeResponse(message), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
