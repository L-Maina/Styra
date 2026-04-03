// ============================================
// ERROR TRACKING SYSTEM (Sentry-like, Self-Hosted)
// ============================================
// Lightweight error tracking that stores errors in PostgreSQL via Prisma.
// All tracking is fire-and-forget — never blocks request handlers.
//
// USAGE:
//   import { trackError, trackApiError, getRecentErrors, getErrorStats } from '@/lib/error-tracker';
//
//   // Manual tracking
//   trackError(error, { route: '/api/payments', severity: 'HIGH' });
//
//   // From a request handler
//   trackApiError(error, request);
//
//   // Query errors (admin dashboard)
//   const stats = await getErrorStats();
//   const recent = await getRecentErrors(50);

import { db } from './db';
import { env } from './env';

// ============================================
// TYPES
// ============================================

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ErrorContext {
  route?: string;
  method?: string;
  url?: string;
  userId?: string;
  userAgent?: string;
  severity?: ErrorSeverity;
}

interface QueuedError {
  message: string;
  stack: string | null;
  severity: ErrorSeverity;
  route: string | null;
  method: string | null;
  url: string | null;
  userId: string | null;
  userAgent: string | null;
}

// ============================================
// FIRE-AND-FORGET QUEUE
// ============================================

const errorQueue: QueuedError[] = [];
let flushInProgress = false;

const FLUSH_INTERVAL_MS = 3000;
const MAX_QUEUE_SIZE = 100;

let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function startFlushTimer(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushErrorQueue().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

async function flushErrorQueue(): Promise<void> {
  if (flushInProgress || errorQueue.length === 0) return;
  flushInProgress = true;

  const batch = errorQueue.splice(0, errorQueue.length);

  try {
    await db.monitoringError.createMany({
      data: batch,
    });
  } catch {
    // Error tracking must NEVER break the application
    // Silently fail — the errors are lost but the app stays up
  } finally {
    flushInProgress = false;
    if (errorQueue.length > 0) {
      startFlushTimer();
    }
  }
}

// ============================================
// SEVERITY CLASSIFICATION
// ============================================

/**
 * Auto-classify error severity based on error type and message.
 */
function classifySeverity(error: unknown, explicitSeverity?: ErrorSeverity): ErrorSeverity {
  if (explicitSeverity) return explicitSeverity;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // CRITICAL: database failures, authentication system failures
  if (
    lower.includes('database') ||
    lower.includes('prisma') ||
    lower.includes('econnrefused') ||
    lower.includes('jwt') ||
    lower.includes('token') ||
    lower.includes('unauthorized') ||
    lower.includes('out of memory')
  ) {
    return 'CRITICAL';
  }

  // HIGH: payment failures, external API failures, validation errors
  if (
    lower.includes('payment') ||
    lower.includes('stripe') ||
    lower.includes('paypal') ||
    lower.includes('mpesa') ||
    lower.includes('webhook') ||
    lower.includes('timeout') ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return 'HIGH';
  }

  // LOW: client errors, not found, validation
  if (
    lower.includes('not found') ||
    lower.includes('404') ||
    lower.includes('validation') ||
    lower.includes('invalid input') ||
    lower.includes('zod')
  ) {
    return 'LOW';
  }

  return 'MEDIUM';
}

/**
 * Extract a safe error message (no sensitive data).
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    // Truncate very long messages to avoid storage issues
    const msg = error.message;
    return msg.length > 2000 ? msg.substring(0, 2000) + '...' : msg;
  }
  const str = String(error);
  return str.length > 2000 ? str.substring(0, 2000) + '...' : str;
}

/**
 * Extract stack trace if available.
 */
function extractStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    const stack = error.stack;
    return stack.length > 5000 ? stack.substring(0, 5000) + '...' : stack;
  }
  return null;
}

// ============================================
// PUBLIC API — FIRE AND FORGET
// ============================================

/**
 * Track an error. Fire-and-forget — never blocks the caller.
 *
 * @param error - The error to track (Error object, string, or anything)
 * @param context - Optional context (route, severity, userId, etc.)
 */
export function trackError(error: unknown, context?: ErrorContext): void {
  try {
    const message = extractMessage(error);
    const stack = extractStack(error);
    const severity = classifySeverity(error, context?.severity);

    errorQueue.push({
      message,
      stack,
      severity,
      route: context?.route || null,
      method: context?.method || null,
      url: context?.url || null,
      userId: context?.userId || null,
      userAgent: context?.userAgent || null,
    });

    if (errorQueue.length >= MAX_QUEUE_SIZE) {
      flushErrorQueue().catch(() => {});
    } else {
      startFlushTimer();
    }
  } catch {
    // Error tracking must NEVER break the application
  }
}

/**
 * Track an API error with request context auto-extracted.
 * Fire-and-forget — never blocks the caller.
 *
 * @param error - The error to track
 * @param request - NextRequest object (or any object with headers/nextUrl/method)
 * @param extraContext - Additional context to merge
 */
export function trackApiError(
  error: unknown,
  request?: { headers?: { get?: (name: string) => string | null }; nextUrl?: { pathname?: string; href?: string }; method?: string },
  extraContext?: Partial<ErrorContext>,
): void {
  try {
    const headers = request?.headers;
    const forwardedFor = headers?.get?.('x-forwarded-for');
    const realIp = headers?.get?.('x-real-ip');

    const route = request?.nextUrl?.pathname || extraContext?.route;
    const method = request?.method || extraContext?.method;
    const userAgent = headers?.get?.('user-agent') || undefined;
    const url = request?.nextUrl?.href || extraContext?.url || undefined;

    trackError(error, {
      route,
      method,
      url,
      userAgent,
      ...extraContext,
    });
  } catch {
    // Error tracking must NEVER break the application
  }
}

// ============================================
// PUBLIC API — QUERIES (awaitable, for admin)
// ============================================

/**
 * Get recent unresolved errors, ordered by most recent.
 *
 * @param limit - Maximum number of errors to return (default 50)
 */
export async function getRecentErrors(limit: number = 50) {
  return db.monitoringError.findMany({
    where: { resolved: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      message: true,
      severity: true,
      route: true,
      method: true,
      createdAt: true,
    },
  });
}

/**
 * Resolve a specific error by ID.
 */
export async function resolveError(errorId: string): Promise<boolean> {
  try {
    const result = await db.monitoringError.update({
      where: { id: errorId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
    return !!result;
  } catch {
    return false;
  }
}

/**
 * Resolve multiple errors at once.
 */
export async function resolveErrors(errorIds: string[]): Promise<number> {
  try {
    const result = await db.monitoringError.updateMany({
      where: { id: { in: errorIds } },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Get error statistics for the admin dashboard.
 * Returns counts by severity, route, and time period.
 */
export async function getErrorStats(): Promise<{
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
  byRoute: { route: string; count: number }[];
  recent24h: number;
  recent7d: number;
  recent30d: number;
  avgPerDay: number;
}> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    total,
    unresolved,
    bySeverityRaw,
    byRouteRaw,
    recent24h,
    recent7d,
    recent30d,
  ] = await Promise.all([
    db.monitoringError.count(),
    db.monitoringError.count({ where: { resolved: false } }),
    db.monitoringError.groupBy({ by: ['severity'], _count: { id: true } }),
    db.monitoringError.groupBy({
      by: ['route'],
      _count: { id: true },
      where: { route: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    db.monitoringError.count({ where: { createdAt: { gte: oneDayAgo } } }),
    db.monitoringError.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.monitoringError.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  const bySeverity: Record<string, number> = {};
  for (const item of bySeverityRaw) {
    bySeverity[item.severity] = item._count.id;
  }

  const byRoute = byRouteRaw.map((item) => ({
    route: item.route || 'unknown',
    count: item._count.id,
  }));

  // Average errors per day (over last 30 days, minimum 1 to avoid div by zero)
  const avgPerDay = Math.round((recent30d / 30) * 10) / 10;

  return {
    total,
    unresolved,
    bySeverity,
    byRoute,
    recent24h,
    recent7d,
    recent30d,
    avgPerDay,
  };
}

// ============================================
// GLOBAL ERROR HANDLERS (auto-track)
// ============================================

/**
 * Set up global error handlers to auto-track unhandled errors.
 * Call once at module load time.
 */
export function setupGlobalErrorTracking(): void {
  if (typeof globalThis !== 'undefined') {
    // Track unhandled promise rejections
    globalThis.addEventListener?.('unhandledrejection', (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      trackError(rejectionEvent?.reason, {
        severity: 'HIGH',
        route: 'global:unhandledrejection',
      });
    });

    // Track global errors (less useful in Node.js but catches edge cases)
    globalThis.addEventListener?.('error', (event: Event) => {
      const errorEvent = event as ErrorEvent;
      trackError(errorEvent?.error || errorEvent?.message || 'Unknown global error', {
        severity: 'HIGH',
        route: 'global:error',
        url: errorEvent?.filename || undefined,
      });
    });
  }

  // Track uncaught exceptions in Node.js
  if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', (error: Error) => {
      trackError(error, {
        severity: 'CRITICAL',
        route: 'process:uncaughtException',
      });
    });

    process.on('unhandledRejection', (reason: unknown) => {
      trackError(reason, {
        severity: 'HIGH',
        route: 'process:unhandledRejection',
      });
    });
  }
}

// Auto-setup global tracking (fire-and-forget, never crashes)
try {
  setupGlobalErrorTracking();
} catch {
  // Silently fail — global tracking is best-effort
}

// Flush any queued errors on process exit
if (typeof process !== 'undefined' && process.on) {
  process.on('beforeExit', () => {
    if (errorQueue.length > 0) {
      flushErrorQueue().catch(() => {});
    }
  });
}
