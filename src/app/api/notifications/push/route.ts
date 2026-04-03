import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// ── POST: Register a web push subscription ────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { subscription } = body;

    // Validate subscription object
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return errorResponse('Invalid push subscription data', 400);
    }

    const { endpoint, keys } = subscription;

    if (!keys.p256dh || !keys.auth) {
      return errorResponse('Push subscription keys are required (p256dh, auth)', 400);
    }

    // Extract user agent from request headers
    const userAgent = request.headers.get('user-agent') || undefined;

    // Upsert the subscription
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: user.id,
        endpoint,
        authKey: keys.auth,
        p256dhKey: keys.p256dh,
        userAgent,
      },
      update: {
        authKey: keys.auth,
        p256dhKey: keys.p256dh,
        userAgent,
      },
    });

    return successResponse({ message: 'Push subscription registered' });
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE: Remove a push subscription ────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { endpoint } = body;

    if (!endpoint || typeof endpoint !== 'string') {
      return errorResponse('Subscription endpoint is required', 400);
    }

    // Only allow users to delete their own subscriptions
    const subscription = await db.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (!subscription) {
      return errorResponse('Subscription not found', 404);
    }

    if (subscription.userId !== user.id) {
      return errorResponse('You do not have permission to remove this subscription', 403);
    }

    await db.pushSubscription.delete({
      where: { endpoint },
    });

    return successResponse({ message: 'Push subscription removed' });
  } catch (error) {
    return handleApiError(error);
  }
}
