import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { db } from '@/lib/db';
import type { NotificationType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationPayload {
  title: string;
  message: string;
  type?: string;
}

interface PersistNotificationPayload extends NotificationPayload {
  data?: Record<string, unknown>;
}

interface InAppNotificationData {
  title: string;
  message: string;
  type: NotificationType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a generic type string to a specific Pusher event name.
 * Returns both the generic `new-notification` event AND a type-specific
 * event (e.g. `booking-update`, `payment-update`) when applicable.
 */
function getPusherEvents(type?: string): string[] {
  const events: string[] = [EVENTS.NEW_NOTIFICATION];

  if (!type) return events;

  const lower = type.toLowerCase();

  if (lower.includes('booking')) {
    events.push(EVENTS.BOOKING_UPDATE);
  } else if (lower.includes('payment')) {
    events.push(EVENTS.PAYMENT_UPDATE);
  }

  return events;
}

/**
 * Build the payload that will be sent over Pusher to the client.
 */
function buildPusherPayload(payload: NotificationPayload, timestamp: Date) {
  return {
    type: payload.type ?? 'GENERAL',
    title: payload.title,
    message: payload.message,
    timestamp: timestamp.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 1. sendRealtimeNotification
// ---------------------------------------------------------------------------

/**
 * Send a real-time Pusher notification to a single user.
 *
 * Always triggers the `new-notification` event on the user's private channel.
 * If the type field contains "booking" or "payment", a type-specific event is
 * also triggered so that clients can subscribe to granular event streams.
 */
export async function sendRealtimeNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  const channel = CHANNELS.USER_NOTIFICATIONS(userId);
  const events = getPusherEvents(payload.type);
  const pusherPayload = buildPusherPayload(payload, new Date());

  // Fire all events in parallel — Pusher handles them independently
  await Promise.allSettled(
    events.map((event) =>
      pusherServer.trigger(channel, event, pusherPayload),
    ),
  );
}

// ---------------------------------------------------------------------------
// 2. sendBulkRealtimeNotifications
// ---------------------------------------------------------------------------

/**
 * Send the same real-time Pusher notification to multiple users.
 *
 * Each user receives the notification on their own `user-{userId}` channel.
 * Uses `Promise.allSettled` so that one failing user does not block the rest.
 */
export async function sendBulkRealtimeNotifications(
  userIds: string[],
  payload: NotificationPayload,
): Promise<void> {
  const events = getPusherEvents(payload.type);
  const pusherPayload = buildPusherPayload(payload, new Date());

  // Build an array of all (channel, event) pairs
  const triggers: Promise<unknown>[] = [];
  for (const userId of userIds) {
    const channel = CHANNELS.USER_NOTIFICATIONS(userId);
    for (const event of events) {
      triggers.push(pusherServer.trigger(channel, event, pusherPayload));
    }
  }

  await Promise.allSettled(triggers);
}

// ---------------------------------------------------------------------------
// 3. createInAppNotification
// ---------------------------------------------------------------------------

/**
 * Persist an in-app notification to the database via Prisma.
 *
 * Returns the created Notification record so callers can reference its ID
 * (useful for linking notifications to bookings, payments, etc.).
 */
export async function createInAppNotification(
  userId: string,
  data: InAppNotificationData,
) {
  const notification = await db.notification.create({
    data: {
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
    },
  });

  return notification;
}

// ---------------------------------------------------------------------------
// 4. sendAndPersistNotification
// ---------------------------------------------------------------------------

/**
 * Send a notification BOTH over Pusher (real-time) AND persist it to the
 * database (in-app).  This is the primary function most API routes should use.
 *
 * - The Pusher payload includes any extra `data` fields so the client can
 *   act on them (e.g. navigate to a booking detail page).
 * - The database record stores extra `data` as a JSON string.
 * - Both operations run in parallel; Pusher failures are caught and logged
 *   so that the DB record is always created even if Pusher is temporarily
 *   unavailable.
 *
 * Returns the persisted Notification record (or `null` if DB write failed).
 */
export async function sendAndPersistNotification(
  userId: string,
  payload: PersistNotificationPayload,
) {
  const now = new Date();

  // --- Persist to database ---
  const notificationType: NotificationType = isValidNotificationType(payload.type)
    ? (payload.type as NotificationType)
    : 'SYSTEM_ALERT';

  const notification = await db.notification.create({
    data: {
      userId,
      title: payload.title,
      message: payload.message,
      type: notificationType,
      data: payload.data ? JSON.stringify(payload.data) : null,
    },
  });

  // --- Send real-time (fire-and-forget, never blocks) ---
  const channel = CHANNELS.USER_NOTIFICATIONS(userId);
  const events = getPusherEvents(payload.type);
  const pusherPayload = {
    ...buildPusherPayload(payload, now),
    notificationId: notification.id,
    ...(payload.data ?? {}),
  };

  Promise.allSettled(
    events.map((event) =>
      pusherServer.trigger(channel, event, pusherPayload),
    ),
  ).catch(() => {
    // Intentionally swallowed — real-time delivery is best-effort.
    // The in-app notification is already persisted.
  });

  return notification;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

const VALID_NOTIFICATION_TYPES = new Set<string>([
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_REMINDER',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'NEW_MESSAGE',
  'NEW_REVIEW',
  'SYSTEM_ALERT',
  'VERIFICATION_UPDATE',
]);

function isValidNotificationType(type?: string): type is NotificationType {
  return !!type && VALID_NOTIFICATION_TYPES.has(type);
}
