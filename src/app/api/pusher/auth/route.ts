import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import Pusher from 'pusher';

// Lazy initialization — only create Pusher when the endpoint is actually called
function getPusherServer() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

  if (!appId || !key || !secret) {
    throw new Error(
      'Pusher is not configured. Set PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, and PUSHER_SECRET.'
    );
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

// Pusher authentication endpoint
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.formData();

    const socketId = body.get('socket_id') as string;
    const channel = body.get('channel_name') as string;

    if (!socketId || !channel) {
      return errorResponse('Missing socket_id or channel_name', 400);
    }

    // Lazy init pusher server
    const pusherServer = getPusherServer();

    // Validate that user can access this channel
    const isUserChannel = channel.startsWith(`user-${user.id}`);
    const isChatChannel = channel.startsWith('chat-');
    const isBusinessChannel = channel.startsWith('business-');
    const isAdminChannel = channel === 'admin-channel';

    let authorized = false;

    if (isUserChannel) {
      // User can only subscribe to their own private channel
      authorized = true;
    } else if (isChatChannel) {
      // SECURITY: Verify user is a participant in this conversation
      const conversationId = channel.replace('chat-', '');
      const conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        select: { customerId: true, businessId: true },
      });
      if (conversation) {
        const business = await db.business.findUnique({
          where: { id: conversation.businessId },
          select: { ownerId: true },
        });
        authorized = conversation.customerId === user.id ||
                      (business && business.ownerId === user.id) ||
                      user.role === 'ADMIN';
      }
    } else if (isBusinessChannel) {
      // SECURITY: Only business owners and admins can subscribe to business channels
      const businessId = channel.replace('business-', '');
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      authorized = (business !== null) && (business.ownerId === user.id || user.role === 'ADMIN');
    } else if (isAdminChannel) {
      authorized = user.role === 'ADMIN';
    }

    if (!authorized) {
      return errorResponse('Unauthorized channel access', 403);
    }

    // Generate auth response
    const authResponse = pusherServer.authorizeChannel(socketId, channel, {
      user_id: user.id,
      user_info: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    return successResponse(authResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
