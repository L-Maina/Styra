import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// ============================================
// WEBHOOK EVENT STORE
// ============================================
// Centralized webhook event management for all payment providers.
// Provides idempotency, secure logging, and retry tracking.
//
// Usage:
//   1. recordReceivedEvent() — Store incoming event (raw body + sanitized headers)
//   2. checkAndMarkProcessing() — Atomic check-and-update for idempotency
//   3. markEventProcessed() — Mark as successfully processed
//   4. markEventFailed() — Mark as failed (for retry tracking)
//   5. markEventUnhandled() — Mark as unhandled event type
//   6. markEventInvalidSignature() — Mark when signature verification fails
//   7. pruneOldEvents() — Cleanup old events (call from cron/scheduler)

export type WebhookProvider = 'STRIPE' | 'PAYPAL' | 'MPESA' | 'PAYSTACK';

/** Sensitive header patterns to redact from logs */
const SENSITIVE_HEADER_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /set-cookie/i,
  /stripe-signature/i,
  /paypal-transmission-sig/i,
  /x-mpesa-signature/i,
];

/**
 * Sanitize request headers — remove sensitive values but keep header names.
 * Example: { "authorization": "Bearer sk_live_xxx" } → { "authorization": "[REDACTED]" }
 */
function sanitizeHeaders(headers: Record<string, string | null>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === null || value === undefined) continue;
    if (SENSITIVE_HEADER_PATTERNS.some(pattern => pattern.test(key))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Extract relevant webhook headers for logging */
function extractRelevantHeaders(headers: Headers, provider: WebhookProvider): Record<string, string> {
  const relevant: Record<string, string> = {};

  // Common headers
  const commonHeaders = ['content-type', 'user-agent', 'x-forwarded-for', 'x-real-ip'];
  for (const h of commonHeaders) {
    const val = headers.get(h);
    if (val) relevant[h] = val;
  }

  // Provider-specific headers
  switch (provider) {
    case 'STRIPE':
      for (const h of ['stripe-signature', 'stripe-delivery-timestamp']) {
        const val = headers.get(h);
        if (val) relevant[h] = val;
      }
      break;
    case 'PAYPAL':
      for (const h of ['paypal-transmission-id', 'paypal-cert-url', 'paypal-auth-algo', 'paypal-transmission-sig', 'paypal-transmission-time']) {
        const val = headers.get(h);
        if (val) relevant[h] = val;
      }
      break;
    case 'MPESA':
      for (const h of ['x-mpesa-signature']) {
        const val = headers.get(h);
        if (val) relevant[h] = val;
      }
      break;
  }

  return sanitizeHeaders(relevant);
}

/**
 * Extract client IP from request headers.
 * Checks multiple proxy headers with fallback.
 */
export function extractClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || headers.get('cf-connecting-ip')
    || 'unknown';
}

/**
 * Record an incoming webhook event BEFORE any processing.
 * Uses try/catch to ensure logging never blocks webhook processing.
 *
 * @returns The created WebhookEvent record, or null if storage fails
 */
export async function recordReceivedEvent(params: {
  provider: WebhookProvider;
  providerEventId: string;
  eventType: string;
  requestBody: string;
  headers: Headers;
  ipAddress?: string;
}): Promise<{ id: string; isDuplicate: boolean } | null> {
  // TYPE GUARD: Verify requestBody is a raw string (not already-parsed object).
  // This is critical for forensic/legal evidence integrity — the requestBody field
  // must contain the EXACT unparsed payload from the payment provider.
  if (typeof params.requestBody !== 'string') {
    console.warn(
      '[WebhookStore] INTEGRITY WARNING: requestBody is not a string (type: ' +
      typeof params.requestBody +
      '). This breaks forensic evidence chain. Rejecting event ' +
      params.provider + '/' + params.providerEventId +
      '. Ensure request.text() is called BEFORE any JSON parsing.'
    );
    return null;
  }

  try {
    const sanitizedHeaders = extractRelevantHeaders(params.headers, params.provider);

    // Use upsert to handle race conditions:
    // - If event doesn't exist → create it with RECEIVED status
    // - If event already exists → return existing (duplicate detected)
    const event = await db.webhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: params.provider,
          providerEventId: params.providerEventId,
        },
      },
      create: {
        provider: params.provider,
        providerEventId: params.providerEventId,
        eventType: params.eventType,
        status: 'RECEIVED',
        requestBody: params.requestBody,
        requestHeaders: JSON.stringify(sanitizedHeaders),
        ipAddress: params.ipAddress || null,
      },
      update: {
        // Update attempt count on retry
        processingAttempts: { increment: 1 },
        lastAttemptAt: new Date(),
        requestHeaders: JSON.stringify(sanitizedHeaders),
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      id: event.id,
      isDuplicate: event.status !== 'RECEIVED' && event.status !== 'FAILED',
    };
  } catch (error) {
    // NEVER block webhook processing due to logging failures
    // Log to console as last resort
    console.error('[WebhookStore] Failed to record event:', {
      provider: params.provider,
      eventId: params.providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if an event is already processed (idempotency guard).
 * Returns true if the event was already successfully processed or is a known duplicate.
 */
export async function isEventAlreadyProcessed(
  provider: WebhookProvider,
  providerEventId: string
): Promise<boolean> {
  try {
    const event = await db.webhookEvent.findUnique({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      select: { status: true },
    });

    if (!event) return false;

    return ['PROCESSED', 'DUPLICATE', 'UNHANDLED'].includes(event.status);
  } catch {
    // On DB error, allow processing (fail-open)
    return false;
  }
}

/**
 * Mark an event as successfully processed.
 */
export async function markEventProcessed(
  provider: WebhookProvider,
  providerEventId: string,
  opts?: {
    processingTimeMs?: number;
    relatedPaymentId?: string;
    relatedBookingId?: string;
  }
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      data: {
        status: 'PROCESSED',
        responseCode: 200,
        processingTimeMs: opts?.processingTimeMs,
        relatedPaymentId: opts?.relatedPaymentId,
        relatedBookingId: opts?.relatedBookingId,
      },
    });
  } catch (error) {
    console.error('[WebhookStore] Failed to mark event processed:', {
      provider, providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark an event as a duplicate (already processed before).
 */
export async function markEventDuplicate(
  provider: WebhookProvider,
  providerEventId: string
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      data: {
        status: 'DUPLICATE',
        responseCode: 200,
      },
    });
  } catch (error) {
    console.error('[WebhookStore] Failed to mark event duplicate:', {
      provider, providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark an event as failed (processing error, retryable).
 * Stripe/PayPal will auto-retry based on their own retry schedules.
 */
export async function markEventFailed(
  provider: WebhookProvider,
  providerEventId: string,
  errorMessage: string,
  opts?: {
    processingTimeMs?: number;
    responseCode?: number;
  }
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      data: {
        status: 'FAILED',
        processingAttempts: { increment: 1 },
        lastAttemptAt: new Date(),
        errorMessage: errorMessage.slice(0, 1000), // Truncate to prevent huge error blobs
        processingTimeMs: opts?.processingTimeMs,
        responseCode: opts?.responseCode,
      },
    });
  } catch (error) {
    console.error('[WebhookStore] Failed to mark event failed:', {
      provider, providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark an event type as unhandled (not a failure, just not our concern).
 */
export async function markEventUnhandled(
  provider: WebhookProvider,
  providerEventId: string
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      data: {
        status: 'UNHANDLED',
        responseCode: 200,
      },
    });
  } catch (error) {
    console.error('[WebhookStore] Failed to mark event unhandled:', {
      provider, providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark an event as having an invalid signature.
 * This is NOT retryable — the signature will never become valid.
 */
export async function markEventInvalidSignature(
  provider: WebhookProvider,
  providerEventId: string,
  errorMessage: string
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      data: {
        status: 'INVALID_SIGNATURE',
        signatureValid: false,
        responseCode: 401,
        errorMessage: errorMessage.slice(0, 500),
      },
    });
  } catch (error) {
    console.error('[WebhookStore] Failed to mark invalid signature:', {
      provider, providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Update event with valid signature confirmation.
 */
export async function markEventSignatureValid(
  provider: WebhookProvider,
  providerEventId: string
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
      data: {
        signatureValid: true,
      },
    });
  } catch {
    // Non-critical, don't block
  }
}

/**
 * Prune old webhook events to prevent unbounded table growth.
 * Keeps events from the last `daysToKeep` days.
 * Events with status FAILED or INVALID_SIGNATURE are pruned after `daysToKeepFailed`.
 *
 * Recommended: Run daily from a cron job or scheduled task.
 */
export async function pruneOldEvents(daysToKeep = 90, daysToKeepFailed = 7): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const failedCutoffDate = new Date();
    failedCutoffDate.setDate(failedCutoffDate.getDate() - daysToKeepFailed);

    const result = await db.webhookEvent.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: cutoffDate } },
          {
            AND: [
              { status: { in: ['FAILED', 'INVALID_SIGNATURE'] } },
              { createdAt: { lt: failedCutoffDate } },
            ],
          },
        ],
      },
    });

    return result.count;
  } catch (error) {
    console.error('[WebhookStore] Failed to prune old events:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Get webhook event statistics for admin dashboard.
 */
export async function getWebhookStats(): Promise<{
  total: number;
  byProvider: Record<string, number>;
  byStatus: Record<string, number>;
  recentFailures: number;
  avgProcessingTimeMs: number | null;
}> {
  try {
    const [total, byProvider, byStatus, recentFailures, avgTime] = await Promise.all([
      db.webhookEvent.count(),
      db.webhookEvent.groupBy({ by: ['provider'], _count: true }),
      db.webhookEvent.groupBy({ by: ['status'], _count: true }),
      db.webhookEvent.count({
        where: {
          status: 'FAILED',
          lastAttemptAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      db.webhookEvent.aggregate({
        where: { processingTimeMs: { not: null } },
        _avg: { processingTimeMs: true },
      }),
    ]);

    return {
      total,
      byProvider: Object.fromEntries(byProvider.map(g => [g.provider, g._count])),
      byStatus: Object.fromEntries(byStatus.map(g => [g.status, g._count])),
      recentFailures,
      avgProcessingTimeMs: avgTime._avg.processingTimeMs,
    };
  } catch {
    return { total: 0, byProvider: {}, byStatus: {}, recentFailures: 0, avgProcessingTimeMs: null };
  }
}

/**
 * Get detailed webhook statistics for the admin webhook dashboard.
 * Includes time-series data, retry tracking, and provider health scores.
 */
export async function getDetailedWebhookStats(): Promise<{
  overview: {
    total: number;
    processed: number;
    failed: number;
    duplicates: number;
    unhandled: number;
    invalidSignature: number;
    received: number;
    successRate: number;
  };
  byProvider: Array<{
    provider: string;
    total: number;
    processed: number;
    failed: number;
    duplicates: number;
    avgProcessingTimeMs: number | null;
    lastEventAt: string | null;
    failureRate: number;
    signatureValidCount: number;
    signatureInvalidCount: number;
  }>;
  timeSeries: Array<{
    date: string;
    total: number;
    processed: number;
    failed: number;
  }>;
  retryTracking: {
    eventsWithMultipleAttempts: number;
    maxAttempts: number;
    avgAttempts: number | null;
    highRetryEvents: number; // 3+ attempts
  };
  recentEvents: Array<{
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    status: string;
    processingAttempts: number;
    processingTimeMs: number | null;
    errorMessage: string | null;
    ipAddress: string | null;
    relatedPaymentId: string | null;
    createdAt: string;
  }>;
}> {
  try {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Overview counts
    const [statusCounts, providerAggregates, timeSeriesData, retryStats] = await Promise.all([
      // Status breakdown
      db.webhookEvent.groupBy({ by: ['status'], _count: true }),

      // Per-provider aggregates
      db.webhookEvent.groupBy({
        by: ['provider', 'status'],
        _count: true,
        _avg: { processingTimeMs: true },
        _max: { processingAttempts: true },
        _min: { createdAt: true },
      }),

      // 7-day time series (daily buckets)
      db.$queryRaw`
        SELECT
          date(createdAt) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'PROCESSED' THEN 1 ELSE 0 END) as processed,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
        FROM WebhookEvent
        WHERE createdAt >= ${sevenDaysAgo.getTime()}
        GROUP BY date(createdAt)
        ORDER BY date ASC
      ` as unknown as Array<{ date: string; total: number; processed: number; failed: number }>,

      // Retry tracking
      db.webhookEvent.aggregate({
        where: { processingAttempts: { gt: 1 } },
        _count: true,
        _max: { processingAttempts: true },
        _avg: { processingAttempts: true },
      }),
    ]);

    // Build overview
    const byStatus = Object.fromEntries(statusCounts.map(g => [g.status, g._count]));
    const total = Object.values(byStatus).reduce((s, c) => s + c, 0);
    const processed = byStatus['PROCESSED'] || 0;
    const failed = byStatus['FAILED'] || 0;

    // Build per-provider breakdown
    const providerMap = new Map<string, {
      total: number; processed: number; failed: number; duplicates: number;
      avgProcessingTimeMs: number; maxAttempts: number; lastEventAt: Date;
      signatureValidCount: number; signatureInvalidCount: number;
    }>();

    for (const row of providerAggregates) {
      const provider = row.provider as string;
      const existing = providerMap.get(provider) || {
        total: 0, processed: 0, failed: 0, duplicates: 0,
        avgProcessingTimeMs: 0, maxAttempts: 0, lastEventAt: new Date(0),
        signatureValidCount: 0, signatureInvalidCount: 0,
      };

      existing.total += row._count;
      existing.maxAttempts = Math.max(existing.maxAttempts, row._max.processingAttempts ?? 0);
      const minCreatedAt = row._min.createdAt ?? new Date(0);
      if (existing.lastEventAt > minCreatedAt) {
        existing.lastEventAt = minCreatedAt;
      }

      switch (row.status) {
        case 'PROCESSED': existing.processed += row._count; break;
        case 'FAILED': existing.failed += row._count; break;
        case 'DUPLICATE': existing.duplicates += row._count; break;
      }

      if (row._avg.processingTimeMs) {
        // Weighted average across all statuses
        existing.avgProcessingTimeMs = existing.avgProcessingTimeMs + (row._avg.processingTimeMs || 0);
      }

      providerMap.set(provider, existing);
    }

    // Add signature counts
    const signatureStats = await db.webhookEvent.groupBy({
      where: { signatureValid: { not: null } },
      by: ['provider', 'signatureValid'],
      _count: true,
    });

    for (const row of signatureStats) {
      const provider = row.provider as string;
      const existing = providerMap.get(provider);
      if (existing) {
        if (row.signatureValid) existing.signatureValidCount = row._count;
        else existing.signatureInvalidCount = row._count;
      }
    }

    // Recent events (last 50)
    const recentEvents = await db.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        provider: true,
        providerEventId: true,
        eventType: true,
        status: true,
        processingAttempts: true,
        processingTimeMs: true,
        errorMessage: true,
        ipAddress: true,
        relatedPaymentId: true,
        createdAt: true,
      },
    });

    // High retry events (3+ attempts)
    const highRetryEvents = retryStats._count > 3
      ? (await db.webhookEvent.count({
          where: { processingAttempts: { gte: 3 } },
        }))
      : 0;

    return {
      overview: {
        total,
        processed,
        failed,
        duplicates: byStatus['DUPLICATE'] || 0,
        unhandled: byStatus['UNHANDLED'] || 0,
        invalidSignature: byStatus['INVALID_SIGNATURE'] || 0,
        received: byStatus['RECEIVED'] || 0,
        successRate: total > 0 ? Math.round((processed / total) * 100) / 100 : 0,
      },
      byProvider: Array.from(providerMap.entries()).map(([provider, data]) => ({
        provider,
        total: data.total,
        processed: data.processed,
        failed: data.failed,
        duplicates: data.duplicates,
        avgProcessingTimeMs: data.avgProcessingTimeMs > 0 ? Math.round(data.avgProcessingTimeMs) : null,
        lastEventAt: data.lastEventAt.toISOString(),
        failureRate: data.total > 0 ? Math.round((data.failed / data.total) * 100) / 100 : 0,
        signatureValidCount: data.signatureValidCount,
        signatureInvalidCount: data.signatureInvalidCount,
        maxAttempts: data.maxAttempts,
      })),
      timeSeries: timeSeriesData.map(row => ({
        date: row.date,
        total: Number(row.total),
        processed: Number(row.processed),
        failed: Number(row.failed),
      })),
      retryTracking: {
        eventsWithMultipleAttempts: retryStats._count,
        maxAttempts: retryStats._max.processingAttempts || 0,
        avgAttempts: retryStats._avg.processingAttempts ? Math.round(retryStats._avg.processingAttempts * 100) / 100 : null,
        highRetryEvents,
      },
      recentEvents: recentEvents.map(row => ({
        ...row,
        processingTimeMs: row.processingTimeMs ? Math.round(row.processingTimeMs) : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch {
    return {
      overview: { total: 0, processed: 0, failed: 0, duplicates: 0, unhandled: 0, invalidSignature: 0, received: 0, successRate: 0 },
      byProvider: [],
      timeSeries: [],
      retryTracking: { eventsWithMultipleAttempts: 0, maxAttempts: 0, avgAttempts: null, highRetryEvents: 0 },
      recentEvents: [],
    };
  }
}
