// ============================================
// ANALYTICS MODULE
// ============================================
// Client-side analytics for page views, events, and user identification.
// Uses batching to reduce network calls.

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

interface IdentifyData {
  userId: string;
  traits?: Record<string, unknown>;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;
const API_ENDPOINT = '/api/analytics';

let eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let userId: string | null = null;
let userTraits: Record<string, unknown> | null = null;

/**
 * Track a page view event.
 */
export function trackPageView(path: string, properties?: Record<string, unknown>): void {
  pushEvent({
    event: 'page_view',
    properties: { path, ...properties },
  });
}

/**
 * Track a custom event.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  pushEvent({ event, properties });
}

/**
 * Identify a user with traits.
 */
export function identify(id: string, traits?: Record<string, unknown>): void {
  userId = id;
  userTraits = traits || null;
  pushEvent({ event: 'identify', properties: { userId: id, ...traits } });
}

/**
 * Reset the analytics state (e.g., on logout).
 */
export function reset(): void {
  userId = null;
  userTraits = null;
  eventQueue = [];
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Get the current event queue (useful for testing).
 */
export function getEventQueue(): AnalyticsEvent[] {
  return [...eventQueue];
}

/**
 * Get the current identified user.
 */
export function getIdentifiedUser(): { userId: string | null; traits: Record<string, unknown> | null } {
  return { userId, traits: userTraits };
}

/**
 * Get the batch size configuration.
 */
export function getBatchConfig(): { batchSize: number; flushIntervalMs: number } {
  return { batchSize: BATCH_SIZE, flushIntervalMs: FLUSH_INTERVAL_MS };
}

/**
 * Manually flush the event queue.
 */
export async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, eventQueue.length);

  try {
    await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: batch,
        userId,
        timestamp: Date.now(),
      }),
    });
  } catch {
    // Analytics should never block the app — silently fail
  }
}

// ============================================
// INTERNAL
// ============================================

function pushEvent(event: AnalyticsEvent): void {
  const queuedEvent: AnalyticsEvent = { ...event, timestamp: event.timestamp ?? Date.now() };
  eventQueue.push(queuedEvent);

  // Auto-flush when batch is full
  if (eventQueue.length >= BATCH_SIZE) {
    flush();
    return;
  }

  // Start flush timer if not already running
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      if (eventQueue.length > 0) {
        flush();
      }
    }, FLUSH_INTERVAL_MS);
  }
}
