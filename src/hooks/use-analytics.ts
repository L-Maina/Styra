'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  trackPageView as _trackPageView,
  trackEvent as _trackEvent,
  identify as _identify,
  reset as _reset,
} from '@/lib/analytics';
import { useAuthStore } from '@/store';

/**
 * Main analytics hook — auto-syncs userId from auth store on mount.
 * Returns { trackPageView, trackEvent, identify, reset }.
 */
export function useAnalytics() {
  const { user } = useAuthStore();
  const lastSyncedId = useRef<string | null>(null);

  // Auto-identify when user logs in / changes
  useEffect(() => {
    if (user?.id && user.id !== lastSyncedId.current) {
      _identify(user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
      });
      lastSyncedId.current = user.id;
    }
  }, [user]);

  // Reset on logout
  useEffect(() => {
    if (!user && lastSyncedId.current) {
      _reset();
      lastSyncedId.current = null;
    }
  }, [user]);

  const trackPageView = useCallback(
    (path: string, properties?: Record<string, unknown>) => {
      _trackPageView(path, properties);
    },
    [],
  );

  const trackEvent = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      _trackEvent(event, properties);
    },
    [],
  );

  const identify = useCallback(
    (id: string, traits?: Record<string, unknown>) => {
      _identify(id, traits);
    },
    [],
  );

  const reset = useCallback(() => {
    _reset();
    lastSyncedId.current = null;
  }, []);

  return { trackPageView, trackEvent, identify, reset };
}

/**
 * Simple event-tracking hook — fires once on mount.
 */
export function useTrackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  useEffect(() => {
    _trackEvent(eventName, properties);
  }, [eventName, properties]);
}

/**
 * Auto page-view tracker — sends a page_view event on mount.
 */
export function usePageViewTracker(pageName?: string) {
  const tracked = useRef(false);

  const path = pageName ?? (typeof window !== 'undefined' ? window.location.pathname : '/');

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    _trackPageView(path);
  }, [path]);
}
