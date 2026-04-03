'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store';
import { getPusherClient } from '@/lib/pusher-client';

// ── Types ──────────────────────────────────────────────────────────────

interface PushNotificationState {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  unreadCount: number;
  isNew: boolean;
}

interface UsePushNotificationsReturn {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  unreadCount: number;
  isNew: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

// ── Helper: Fetch with credentials ────────────────────────────────────

async function apiRequest(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${response.status})`);
  }

  return response.json();
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user, isAuthenticated } = useAuthStore();
  const userId = user?.id;

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<
    Array<{ id: string; title: string; message: string; createdAt: string }>
  >([]);

  const pusherChannelRef = useRef<ReturnType<typeof import('pusher-js').default.prototype.subscribe> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sync notification permission ────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('denied');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // ── Fetch unread count on mount / auth change ───────────────────────

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setUnreadCount(0);
      setIsSubscribed(false);
      return;
    }

    // Fetch unread count
    apiRequest('/api/notifications?unread=true')
      .then((data) => {
        if (data.success) {
          const notifications = data.data || [];
          setUnreadCount(notifications.length);
          setRecentNotifications(notifications.slice(0, 10));
        }
      })
      .catch(() => {
        // Silently fail — notifications are non-critical
      });

    // Check push subscription status
    checkSubscriptionStatus();
  }, [isAuthenticated, userId]);

  // ── Subscribe to Pusher channel for real-time notifications ─────────

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `user-${userId}`;
    const channel = pusher.subscribe(channelName);
    pusherChannelRef.current = channel;

    const handleNewNotification = (data: { type: string; title: string; message: string }) => {
      // Increment unread count
      setUnreadCount((prev) => prev + 1);
      setIsNew(true);

      // Auto-reset isNew pulse after 3 seconds
      setTimeout(() => setIsNew(false), 3000);

      // Show browser notification if tab is not focused
      if (typeof document !== 'undefined' && document.hidden) {
        showBrowserNotification(data.title, data.message);
      }

      // Add to recent notifications
      setRecentNotifications((prev) => [
        {
          id: `pusher-${Date.now()}`,
          title: data.title || 'New Notification',
          message: data.message || '',
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 9),
      ]);
    };

    channel.bind('new-notification', handleNewNotification);
    channel.bind('booking-update', handleNewNotification);
    channel.bind('payment-update', handleNewNotification);

    return () => {
      channel.unbind('new-notification', handleNewNotification);
      channel.unbind('booking-update', handleNewNotification);
      channel.unbind('payment-update', handleNewNotification);
      pusher.unsubscribe(channelName);
      pusherChannelRef.current = null;
    };
  }, [isAuthenticated, userId]);

  // ── Show browser notification ───────────────────────────────────────

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'styra-notification',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch {
      // Notification API may not be available in all contexts
    }
  }, []);

  // ── Check subscription status ───────────────────────────────────────

  const checkSubscriptionStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setIsSubscribed(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  // ── Request notification permission ─────────────────────────────────

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('denied');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // ── Subscribe to push notifications ─────────────────────────────────

  const subscribe = useCallback(async () => {
    if (!isAuthenticated || !userId) return;
    setIsLoading(true);

    try {
      // Step 1: Request permission
      const perm = await requestPermission();
      if (perm !== 'granted') {
        setIsLoading(false);
        return;
      }

      // Step 2: Get VAPID public key
      const keyResponse = await fetch('/api/notifications/push', {
        credentials: 'include',
      });
      if (!keyResponse.ok) throw new Error('Failed to get VAPID key');

      // Reuse the existing subscription or create a new one
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        // Already subscribed, just register with backend
        await apiRequest('/api/notifications/push', {
          method: 'POST',
          body: JSON.stringify({
            subscription: existingSubscription.toJSON(),
          }),
        });
        setIsSubscribed(true);
        setIsLoading(false);
        return;
      }

      // Step 3: Convert base64 VAPID key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('VAPID public key not configured');

      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      // Step 4: Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: rawData,
      });

      // Step 5: Send subscription to backend
      await apiRequest('/api/notifications/push', {
        method: 'POST',
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error('[use-push-notifications] Subscribe failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, requestPermission]);

  // ── Unsubscribe from push notifications ──────────────────────────────

  const unsubscribe = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from backend first
        const subJson = subscription.toJSON();
        if (subJson.endpoint) {
          await apiRequest('/api/notifications/push', {
            method: 'DELETE',
            body: JSON.stringify({ endpoint: subJson.endpoint }),
          });
        }

        // Then unsubscribe from browser
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (error) {
      console.error('[use-push-notifications] Unsubscribe failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Mark single notification as read ────────────────────────────────

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await apiRequest(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isRead: true }),
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('[use-push-notifications] markAsRead failed:', error);
      }
    },
    []
  );

  // ── Mark all notifications as read ──────────────────────────────────

  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest('/api/notifications', {
        method: 'PATCH',
      });
      setUnreadCount(0);
    } catch (error) {
      console.error('[use-push-notifications] markAllAsRead failed:', error);
    }
  }, []);

  // ── Cleanup focus timeout ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  return {
    permission,
    isSubscribed,
    isLoading,
    unreadCount,
    isNew,
    requestPermission,
    subscribe,
    unsubscribe,
    markAsRead,
    markAllAsRead,
  };
}

export default usePushNotifications;
