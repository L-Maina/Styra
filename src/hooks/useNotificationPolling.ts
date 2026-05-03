'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store';
import type { Notification } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────

interface UseNotificationPollingReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface NotificationEventDetail {
  type: 'new' | 'read' | 'all-read';
  notification?: Notification;
  unreadCount: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const API_LIMIT = 20;

// ── Custom Event Helper ────────────────────────────────────────────────

function dispatchNotificationEvent(detail: NotificationEventDetail) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('styra:notification', { detail })
    );
  } catch {
    // CustomEvent may not be available in some test environments
  }
}

// ── API Helpers ────────────────────────────────────────────────────────

async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`/api/notifications?limit=${API_LIMIT}`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const json = await res.json();
  // API returns { success, data: [...], total, page, limit, totalPages } via paginatedResponse
  if (json.success && Array.isArray(json.data)) return json.data;
  // Fallback: some endpoints may return the array directly
  if (Array.isArray(json)) return json;
  return [];
}

async function patchNotificationRead(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function patchAllNotificationsRead(): Promise<boolean> {
  try {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useNotificationPolling(): UseNotificationPollingReturn {
  const { isAuthenticated, user } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Refs to track previous state for diffing
  const prevUnreadCountRef = useRef(0);
  const prevNotificationIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  // ── Core fetch logic ────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const items = await fetchNotifications();
      const count = items.filter((n) => !n.isRead).length;

      // Detect new notifications by comparing IDs
      const currentIds = new Set(items.map((n) => n.id));
      const prevIds = prevNotificationIdsRef.current;
      const newNotifications = items.filter(
        (n) => !prevIds.has(n.id) && !n.isRead
      );

      setNotifications(items);
      setUnreadCount(count);

      // Fire custom events for each new notification
      for (const notif of newNotifications) {
        dispatchNotificationEvent({
          type: 'new',
          notification: notif,
          unreadCount: count,
        });
      }

      // Update refs
      prevNotificationIdsRef.current = currentIds;
      prevUnreadCountRef.current = count;
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated]);

  // ── Mark as read ────────────────────────────────────────────────────

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const ok = await patchNotificationRead(id);
      if (!ok) {
        // Revert on failure
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
        );
        setUnreadCount((prev) => prev + 1);
      } else {
        dispatchNotificationEvent({ type: 'read', unreadCount: Math.max(0, prevUnreadCountRef.current - 1) });
        prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1);
      }
    },
    []
  );

  // ── Mark all as read ────────────────────────────────────────────────

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    const ok = await patchAllNotificationsRead();
    if (!ok) {
      // Revert by re-fetching
      refresh();
    } else {
      dispatchNotificationEvent({ type: 'all-read', unreadCount: 0 });
      prevUnreadCountRef.current = 0;
    }
  }, [refresh]);

  // ── Visibility-based polling ────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset state on logout
      setNotifications([]);
      setUnreadCount(0);
      prevNotificationIdsRef.current = new Set();
      prevUnreadCountRef.current = 0;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    // Initial fetch
    refresh();

    // Start polling interval
    pollTimerRef.current = setInterval(() => {
      // Only poll when the tab is visible
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refresh();
      }
    }, POLL_INTERVAL_MS);

    // Also refresh when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isAuthenticated, user?.id, refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}

export default useNotificationPolling;
