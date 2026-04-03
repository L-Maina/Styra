import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';
import { sanitizeResponse } from '@/lib/response-sanitizer';

// List conversations for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      OR: [
        { participant1: user.userId },
        { participant2: user.userId },
      ],
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { user1: { name: { contains: search } } },
            { user2: { name: { contains: search } } },
          ],
        },
      ];
    }

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        where,
        skip,
        take: limit,
        include: {
          user1: {
            select: { id: true, name: true, avatar: true },
          },
          user2: {
            select: { id: true, name: true, avatar: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.conversation.count({ where }),
    ]);

    // Batch unread count — count messages not sent by the current user and not read
    let unreadMap: Record<string, number> = {};
    if (conversations.length > 0) {
      const unreadCounts = await db.chatMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversations.map((c) => c.id) },
          senderId: { not: user.userId },
          isRead: false,
        },
        _count: { id: true },
      });
      for (const row of unreadCounts) {
        unreadMap[row.conversationId] = row._count.id;
      }
    }

    const conversationsWithUnread = conversations.map((conv) => ({
      ...conv,
      unreadCount: unreadMap[conv.id] || 0,
      // Add the other participant's info as "otherUser" for convenience
      otherUser: conv.participant1 === user.userId ? conv.user2 : conv.user1,
    }));

    return paginatedResponse(sanitizeResponse(conversationsWithUnread), page, limit, total);
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}

// Create or find conversation with another user
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { otherUserId } = body;

    if (!otherUserId || typeof otherUserId !== 'string') {
      return errorResponse('otherUserId is required', 400);
    }

    if (otherUserId === user.userId) {
      return errorResponse('Cannot create a conversation with yourself', 400);
    }

    // Verify the other user exists
    const otherUser = await db.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    if (!otherUser) {
      return errorResponse('User not found', 404);
    }

    // Check if conversation already exists between these two users
    const existingConversation = await db.conversation.findFirst({
      where: {
        OR: [
          { participant1: user.userId, participant2: otherUserId },
          { participant1: otherUserId, participant2: user.userId },
        ],
      },
    });

    if (existingConversation) {
      return successResponse(sanitizeResponse(existingConversation));
    }

    // Create new conversation
    const conversation = await db.conversation.create({
      data: {
        participant1: user.userId,
        participant2: otherUserId,
      },
      include: {
        user1: {
          select: { id: true, name: true, avatar: true },
        },
        user2: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return successResponse(sanitizeResponse(conversation), 201);
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}
