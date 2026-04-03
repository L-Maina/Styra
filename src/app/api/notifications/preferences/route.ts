import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

// ── GET: Return user's notification preferences ───────────────────────
// Creates default preferences if none exist.

export async function GET() {
  try {
    const user = await requireAuth();

    let preferences = await db.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    // Create default preferences if the user doesn't have any
    if (!preferences) {
      preferences = await db.notificationPreference.create({
        data: { userId: user.id },
      });
    }

    return successResponse({
      id: preferences.id,
      userId: preferences.userId,
      pushEnabled: preferences.pushEnabled,
      emailEnabled: preferences.emailEnabled,
      smsEnabled: preferences.smsEnabled,
      bookingUpdates: preferences.bookingUpdates,
      messageNotifications: preferences.messageNotifications,
      promotionNotifications: preferences.promotionNotifications,
      reviewNotifications: preferences.reviewNotifications,
      paymentNotifications: preferences.paymentNotifications,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PUT: Update notification preferences ──────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate the body
    const allowedFields = [
      'pushEnabled',
      'emailEnabled',
      'smsEnabled',
      'bookingUpdates',
      'messageNotifications',
      'promotionNotifications',
      'reviewNotifications',
      'paymentNotifications',
      'quietHoursStart',
      'quietHoursEnd',
    ] as const;

    type PreferenceUpdate = {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      bookingUpdates?: boolean;
      messageNotifications?: boolean;
      promotionNotifications?: boolean;
      reviewNotifications?: boolean;
      paymentNotifications?: boolean;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
    };

    const updateData: PreferenceUpdate = {};

    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        const value = body[field];
        if (field === 'quietHoursStart' || field === 'quietHoursEnd') {
          // Time fields: must be null or HH:mm format
          if (value === null || value === '') {
            updateData[field] = null;
          } else if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
            updateData[field] = value;
          }
          // Invalid format: silently ignore
        } else {
          // Boolean fields
          if (typeof value === 'boolean') {
            updateData[field] = value;
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return successResponse({ message: 'No valid fields to update' });
    }

    // Upsert preferences
    const preferences = await db.notificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...updateData,
      },
      update: updateData,
    });

    return successResponse({
      id: preferences.id,
      userId: preferences.userId,
      pushEnabled: preferences.pushEnabled,
      emailEnabled: preferences.emailEnabled,
      smsEnabled: preferences.smsEnabled,
      bookingUpdates: preferences.bookingUpdates,
      messageNotifications: preferences.messageNotifications,
      promotionNotifications: preferences.promotionNotifications,
      reviewNotifications: preferences.reviewNotifications,
      paymentNotifications: preferences.paymentNotifications,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      updatedAt: preferences.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
