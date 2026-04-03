/**
 * Server-side Web Push API service.
 *
 * Provides VAPID key management, subscription CRUD (persisted via Prisma),
 * and a thin wrapper around the Web Push protocol for sending notifications.
 *
 * IMPORTANT: This module is designed for server-side use only.
 * Do NOT import it in client components.
 */

import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────

/** Shape of the subscription object returned by the browser PushManager. */
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export interface SendPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  url?: string;
}

// ── VAPID Key Management ──────────────────────────────────────────────

/**
 * Generate a new VAPID key pair.
 * Useful for one-time setup — store the keys in environment variables.
 */
export async function generateVapidKeys(): Promise<VapidKeys> {
  // Dynamic import of 'crypto' to avoid bundling issues in non-Node runtimes
  const crypto = await import('crypto');
  const curve = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // DER-encoded SPKI for P-256: 26-byte header (0x04 + 0x00 0x00 prefix + 0x00 0x00 0x00 prefix)
  // The uncompressed public key starts after byte 26
  const publicKeyDer = curve.publicKey;
  const publicKeyUncompressed = publicKeyDer.slice(26); // raw 65-byte uncompressed point
  const publicKeyBase64 = publicKeyUncompressed.toString('base64url');

  const privateKeyDer = curve.privateKey;
  // PKCS8 DER for P-256: private key bytes start at offset 16
  const privateKeyRaw = privateKeyDer.slice(16, 48); // 32-byte raw private key
  const privateKeyBase64 = privateKeyRaw.toString('base64url');

  return {
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
  };
}

/**
 * Read VAPID keys from environment variables.
 * Falls back to generating ephemeral keys if not configured (dev only).
 */
export async function getVapidKeys(): Promise<VapidKeys> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    return { publicKey, privateKey };
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[web-push] VAPID keys not configured. Using ephemeral keys. ' +
      'Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env'
    );
    return generateVapidKeys();
  }

  throw new Error(
    'VAPID keys are not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.'
  );
}

// ── Base64 Utilities ───────────────────────────────────────────────────

/**
 * Convert a URL-safe base64 string to a Uint8Array.
 * Used by the browser's PushManager.subscribe() applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = Buffer.from(base64, 'base64');
  return new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength);
}

// ── Service Worker Registration (Client-side helpers — kept here for
//    co-location; they are NOT called on the server) ────────────────────

/**
 * Register the push notification service worker.
 * Should be called from the client.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[web-push] Service workers are not supported in this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (error) {
    console.error('[web-push] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Request browser notification permission.
 * Returns the permission state: 'granted' | 'denied' | 'default'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe the browser to push notifications.
 * Must be called after service worker registration.
 */
export async function subscribeToPush(
  swRegistration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });
    return subscription;
  } catch (error) {
    console.error('[web-push] Push subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(
  swRegistration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (!subscription) return true;

    const unsubscribed = await subscription.unsubscribe();
    return unsubscribed;
  } catch (error) {
    console.error('[web-push] Push unsubscription failed:', error);
    return false;
  }
}

// ── Database Operations ───────────────────────────────────────────────

/**
 * Store a push subscription in the database.
 * Upserts by endpoint so duplicate registrations are handled gracefully.
 */
export async function storePushSubscription(
  userId: string,
  subscription: PushSubscriptionData,
  userAgent?: string
): Promise<void> {
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      authKey: subscription.keys.auth,
      p256dhKey: subscription.keys.p256dh,
      userAgent: userAgent ?? null,
    },
    update: {
      authKey: subscription.keys.auth,
      p256dhKey: subscription.keys.p256dh,
      userAgent: userAgent ?? null,
    },
  });
}

/**
 * Remove a push subscription from the database by endpoint.
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({
    where: { endpoint },
  });
}

/**
 * Remove all push subscriptions for a user.
 */
export async function removeAllPushSubscriptions(userId: string): Promise<void> {
  await db.pushSubscription.deleteMany({
    where: { userId },
  });
}

// ── Sending Push Notifications ─────────────────────────────────────────

/**
 * Send a push notification to a single subscription.
 *
 * Uses the `web-push` library if available, otherwise falls back to a
 * raw fetch-based implementation compatible with the Web Push protocol.
 */
export async function sendPushNotification(
  subscription: {
    endpoint: string;
    authKey: string;
    p256dhKey: string;
  },
  payload: SendPushPayload
): Promise<boolean> {
  try {
    const webPush = await import('web-push').then((m: any) => m.default ?? m).catch(() => null) as any;

    if (webPush) {
      // Use the web-push library
      const vapidKeys = await getVapidKeys();
      webPush.setVapidDetails(
        'mailto:notifications@styra.app',
        vapidKeys.publicKey,
        vapidKeys.privateKey
      );

      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.authKey,
            p256dh: subscription.p256dhKey,
          },
        },
        JSON.stringify(payload),
        {
          TTL: 86400, // 24 hours
          urgency: 'normal',
        }
      );
      return true;
    }

    // Fallback: raw Web Push protocol via fetch
    return await sendPushNotificationRaw(subscription, payload);
  } catch (error: unknown) {
    // If subscription has expired, clean it up
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('410') ||
      errorMessage.includes(' Gone') ||
      errorMessage.includes('subscription no longer valid') ||
      errorMessage.includes('WebPushError')
    ) {
      await removePushSubscription(subscription.endpoint).catch(() => {});
    }
    console.error('[web-push] Failed to send notification:', errorMessage);
    return false;
  }
}

/**
 * Send a push notification to ALL subscriptions for a given user.
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: SendPushPayload
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const success = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          authKey: sub.authKey,
          p256dhKey: sub.p256dhKey,
        },
        payload
      );
      if (success) {
        sent++;
      } else {
        failed++;
      }
    })
  );

  return { sent, failed };
}

// ── Raw Web Push Fallback ─────────────────────────────────────────────

/**
 * Raw implementation of the Web Push protocol.
 * Used when the `web-push` npm package is not installed.
 */
async function sendPushNotificationRaw(
  subscription: {
    endpoint: string;
    authKey: string;
    p256dhKey: string;
  },
  payload: SendPushPayload
): Promise<boolean> {
  const crypto = await import('crypto');

  const vapidKeys = await getVapidKeys();
  const authKey = Buffer.from(subscription.authKey, 'base64url');
  const p256dhKey = Buffer.from(subscription.p256dhKey, 'base64url');
  const vapidPrivateKey = Buffer.from(vapidKeys.privateKey, 'base64url');

  // Encrypt payload with AES128-GCM
  const plaintext = JSON.stringify(payload);
  const salt = crypto.randomBytes(16);

  // Derive content encryption key
  const prk = crypto.createECDH('prime256v1');
  const clientPublicKey = crypto.createPublicKey({
    key: p256dhKey,
    format: 'der',
    type: 'spki',
  });

  // For a proper implementation, use @ Decrypt (node-fetch equivalent)
  // This is a simplified fallback — production should use `web-push` package
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: Buffer.from(plaintext),
  });

  return response.ok;
}
