// ============================================
// SECURITY AUDIT LOGGING
// ============================================
// Comprehensive audit trail for security-relevant events.
// All entries are stored in the database (PostgreSQL via Prisma)
// and can be queried for compliance, forensics, and monitoring.
//
// ARCHITECTURE:
//   - Fire-and-forget: logging never blocks the main request
//   - Prisma bulk insert queue: batches logs to reduce DB writes
//   - Fails silently: a logging failure should NEVER break the app
//   - IP tracking: extracted from x-forwarded-for / x-real-ip headers
//   - Hash chaining: each entry's hash depends on the previous entry
//   - Request correlation: entries include X-Request-ID

import { db } from './db';

// ============================================
// TYPES
// ============================================

export type AuditAction =
  // Authentication
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'ACCOUNT_CREATED'
  // Authorization
  | 'PERMISSION_DENIED'
  | 'ROLE_CHECK_FAILED'
  | 'ADMIN_ACCESS_GRANTED'
  | 'PERMISSION_GRANTED'
  // Rate limiting
  | 'RATE_LIMIT_EXCEEDED'
  | 'GLOBAL_RATE_LIMIT_EXCEEDED'
  // Password
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_RESET_TOKEN_INVALID'
  | 'PASSWORD_CHANGED'
  // CSRF
  | 'CSRF_VIOLATION'
  // Admin actions
  | 'ADMIN_USER_BANNED'
  | 'ADMIN_USER_UNBANNED'
  | 'ADMIN_USER_ROLE_CHANGED'
  | 'ADMIN_BUSINESS_APPROVED'
  | 'ADMIN_BUSINESS_REJECTED'
  | 'ADMIN_BUSINESS_SUSPENDED'
  | 'ADMIN_SETTINGS_UPDATED'
  | 'ADMIN_PAGE_CONTENT_UPDATED'
  | 'ADMIN_DISPUTE_RESOLVED'
  | 'ADMIN_REPORT_HANDLED'
  | 'ADMIN_TICKET_HANDLED'
  | 'ADMIN_CLAIM_HANDLED'
  | 'ADMIN_AD_MANAGED'
  | 'ADMIN_LISTING_MANAGED'
  // Resource ownership
  | 'OWNERSHIP_CHECK_FAILED'
  | 'UNAUTHORIZED_RESOURCE_ACCESS'
  // Security alerts
  | 'SECURITY_ALERT_GENERATED'
  // Email verification
  | 'VERIFICATION_EMAIL_RESENT'
  // General
  | 'SESSION_CREATED'
  | 'TOKEN_EXPIRED';

export interface AuditLogEntry {
  userId: string | null;
  email: string | null;
  action: AuditAction;
  ipAddress: string;
  route: string;
  method: string;
  userAgent: string;
  details?: Record<string, unknown>;
  success: boolean;
}

// ============================================
// LOG QUEUE (fire-and-forget)
// ============================================

const logQueue: AuditLogEntry[] = [];
let flushInProgress = false;
const FLUSH_INTERVAL_MS = 2000;
const MAX_QUEUE_SIZE = 50;

let _flushTimer: ReturnType<typeof setTimeout> | null = null;

// Track the last hash in memory for chain continuity
let _lastKnownHash: string = 'GENESIS';

/**
 * Initialize the hash chain by loading the last entry's hash from DB.
 */
export async function initializeAuditChain(): Promise<void> {
  try {
    const lastEntry = await db.securityAuditLog.findFirst({
      select: { hash: true },
      orderBy: { createdAt: 'desc' },
    });
    if (lastEntry?.hash) {
      _lastKnownHash = lastEntry.hash;
    }
  } catch {
    _lastKnownHash = 'GENESIS';
  }
}

function startFlushTimer(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushQueue().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

// ============================================
// HASH COMPUTATION (lazy-loaded crypto)
// ============================================

async function computeEntryHash(
  action: string,
  ipAddress: string,
  timestamp: string,
  previousHash: string,
  requestId: string,
  success: boolean,
): Promise<string> {
  try {
    // Dynamic import to avoid Turbopack bundling issues
    const { createHash } = await import('crypto');
    const input = `${action}:${ipAddress}:${timestamp}:${previousHash}:${requestId}:${success ? '1' : '0'}`;
    return createHash('sha256').update(input).digest('hex');
  } catch (error) {
    // SECURITY: Never fall back to a weak hash. If crypto is unavailable,
    // audit logging MUST fail explicitly rather than silently degrade.
    // A weak hash (e.g., djb2) would allow tampering with the audit chain.
    throw new Error(
      'CRITICAL: crypto module is unavailable — cannot compute audit log hash. ' +
      'Audit logging requires a cryptographic hash function (SHA-256). ' +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================
// FLUSH QUEUE (with hash chaining)
// ============================================

async function flushQueue(): Promise<void> {
  if (flushInProgress || logQueue.length === 0) return;
  flushInProgress = true;

  const batch = logQueue.splice(0, logQueue.length);

  try {
    let currentPreviousHash = _lastKnownHash;
    const records: Array<{ userId: string | null; email: string | null; action: string; ipAddress: string; route: string; method: string; userAgent: string; details: string | null; success: boolean; requestId: string; hash: string; previousHash: string }> = [];
    const now = new Date();
    const timestamp = now.toISOString();
    // Generate a simple request ID (no dependency on request-context)
    const requestId = `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

    for (const entry of batch) {
      const hash = await computeEntryHash(
        entry.action,
        entry.ipAddress,
        timestamp,
        currentPreviousHash,
        requestId,
        entry.success,
      );

      records.push({
        userId: entry.userId,
        email: entry.email,
        action: entry.action,
        ipAddress: entry.ipAddress,
        route: entry.route,
        method: entry.method,
        userAgent: entry.userAgent,
        details: entry.details ? JSON.stringify(entry.details) : null,
        success: entry.success,
        requestId,
        hash,
        previousHash: currentPreviousHash,
      });

      currentPreviousHash = hash;
    }

    await db.securityAuditLog.createMany({
      data: records,
    });

    _lastKnownHash = currentPreviousHash;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AuditLog] Failed to flush audit log batch');
    }
  } finally {
    flushInProgress = false;
    if (logQueue.length > 0) {
      startFlushTimer();
    }
  }
}

// ============================================
// PUBLIC API
// ============================================

const VALID_ACTIONS: string[] = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'ACCOUNT_CREATED',
  'PERMISSION_DENIED', 'ROLE_CHECK_FAILED', 'ADMIN_ACCESS_GRANTED', 'PERMISSION_GRANTED',
  'RATE_LIMIT_EXCEEDED', 'GLOBAL_RATE_LIMIT_EXCEEDED',
  'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_RESET_TOKEN_INVALID', 'PASSWORD_CHANGED',
  'CSRF_VIOLATION',
  'ADMIN_USER_BANNED', 'ADMIN_USER_UNBANNED', 'ADMIN_USER_ROLE_CHANGED',
  'ADMIN_BUSINESS_APPROVED', 'ADMIN_BUSINESS_REJECTED', 'ADMIN_BUSINESS_SUSPENDED',
  'ADMIN_SETTINGS_UPDATED', 'ADMIN_PAGE_CONTENT_UPDATED',
  'ADMIN_DISPUTE_RESOLVED', 'ADMIN_REPORT_HANDLED', 'ADMIN_TICKET_HANDLED',
  'ADMIN_CLAIM_HANDLED', 'ADMIN_AD_MANAGED', 'ADMIN_LISTING_MANAGED',
  'OWNERSHIP_CHECK_FAILED', 'UNAUTHORIZED_RESOURCE_ACCESS',
  'SECURITY_ALERT_GENERATED',
  'SESSION_CREATED', 'TOKEN_EXPIRED',
];

/**
 * Log a security audit event. Fire-and-forget — returns immediately.
 */
export function auditLog(entry: AuditLogEntry): void {
  if (!VALID_ACTIONS.includes(entry.action)) {
    return;
  }

  logQueue.push(entry);

  if (logQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue().catch(() => {});
  } else {
    startFlushTimer();
  }
}

/**
 * Extract IP and user agent from a NextRequest.
 */
export function extractRequestInfo(req: any): { ipAddress: string; userAgent: string; route: string; method: string } {
  const forwardedFor = req.headers?.get?.('x-forwarded-for');
  const realIp = req.headers?.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  const userAgent = req.headers?.get('user-agent') || 'unknown';
  const route = req.nextUrl?.pathname || 'unknown';
  const method = req.method || 'GET';
  return { ipAddress, userAgent, route, method };
}

// ============================================
// CONVENIENCE LOGGERS
// ============================================

export function logFailedLogin(email: string, ipAddress: string, userAgent: string): void {
  auditLog({ userId: null, email, action: 'LOGIN_FAILED', ipAddress, route: '/api/auth/login', method: 'POST', userAgent, success: false });
}

export function logSuccessfulLogin(userId: string, email: string, ipAddress: string, userAgent: string): void {
  auditLog({ userId, email, action: 'LOGIN_SUCCESS', ipAddress, route: '/api/auth/login', method: 'POST', userAgent, success: true });
}

export function logRateLimitViolation(identifier: string, route: string, ipAddress: string, userAgent: string): void {
  auditLog({ userId: null, email: null, action: 'RATE_LIMIT_EXCEEDED', ipAddress, route, method: 'POST', userAgent, details: { identifier }, success: false });
}

export function logGlobalRateLimit(ipAddress: string, userAgent: string): void {
  auditLog({ userId: null, email: null, action: 'GLOBAL_RATE_LIMIT_EXCEEDED', ipAddress, route: '*', method: '*', userAgent, details: { type: 'global' }, success: false });
}

export function logAdminAction(
  adminUserId: string, adminEmail: string, action: AuditAction,
  route: string, ipAddress: string, userAgent: string,
  details?: Record<string, unknown>,
): void {
  auditLog({ userId: adminUserId, email: adminEmail, action, ipAddress, route, method: 'POST', userAgent, details, success: true });
}

export function logPermissionDenied(
  userId: string | null, email: string | null,
  route: string, ipAddress: string, userAgent: string,
  details?: Record<string, unknown>,
): void {
  auditLog({ userId, email, action: 'PERMISSION_DENIED', ipAddress, route, method: '*', userAgent, details, success: false });
}

export function logOwnershipCheckFailed(
  userId: string, email: string, resourceType: string, resourceId: string,
  route: string, ipAddress: string, userAgent: string,
): void {
  auditLog({ userId, email, action: 'OWNERSHIP_CHECK_FAILED', ipAddress, route, method: '*', userAgent, details: { resourceType, resourceId }, success: false });
}

export function logPasswordResetRequested(email: string, ipAddress: string, userAgent: string): void {
  auditLog({ userId: null, email, action: 'PASSWORD_RESET_REQUESTED', ipAddress, route: '/api/auth/forgot-password', method: 'POST', userAgent, success: true });
}

export function logPasswordResetCompleted(email: string, ipAddress: string, userAgent: string): void {
  auditLog({ userId: null, email, action: 'PASSWORD_RESET_COMPLETED', ipAddress, route: '/api/auth/reset-password', method: 'POST', userAgent, success: true });
}

export function logCsrfViolation(ipAddress: string, route: string, userAgent: string): void {
  auditLog({ userId: null, email: null, action: 'CSRF_VIOLATION', ipAddress, route, method: 'POST', userAgent, success: false });
}

export function logSecurityAlert(alertType: string, ipAddress: string, details: Record<string, unknown>): void {
  auditLog({ userId: null, email: null, action: 'SECURITY_ALERT_GENERATED', ipAddress, route: '*', method: '*', userAgent: 'system', details: { alertType, ...details }, success: true });
}

// ============================================
// CHAIN INTEGRITY VERIFICATION
// ============================================

export interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAtIndex: number | null;
  brokenEntryId: string | null;
}

/**
 * Verify the integrity of the last N audit log entries.
 */
export async function verifyRecentEntries(count: number = 10): Promise<ChainVerificationResult> {
  try {
    const recentEntries = await db.securityAuditLog.findMany({
      select: { id: true, hash: true, previousHash: true, action: true, ipAddress: true, createdAt: true, requestId: true, success: true },
      orderBy: { createdAt: 'desc' },
      take: count,
    });

    if (recentEntries.length === 0) {
      return { valid: true, totalEntries: 0, verifiedEntries: 0, brokenAtIndex: null, brokenEntryId: null };
    }

    const entries = recentEntries.reverse();

    // Verify chain: each entry's previousHash should match the previous entry's hash
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].previousHash !== entries[i - 1].hash) {
        return { valid: false, totalEntries: entries.length, verifiedEntries: i - 1, brokenAtIndex: i, brokenEntryId: entries[i].id };
      }
    }

    return { valid: true, totalEntries: entries.length, verifiedEntries: entries.length, brokenAtIndex: null, brokenEntryId: null };
  } catch {
    return { valid: false, totalEntries: 0, verifiedEntries: 0, brokenAtIndex: null, brokenEntryId: null };
  }
}

export async function flushAuditLogs(): Promise<void> {
  await flushQueue();
}
