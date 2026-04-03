// ============================================
// SECURITY ALERT SYSTEM
// ============================================
// Real-time attack pattern detection and alerting.
//
// DETECTS: BRUTE_FORCE, RATE_LIMIT_ABUSE, CSRF_STORM,
//          CREDENTIAL_STUFFING, PRIVILEGE_ESCALATION_ATTEMPT

import { db } from './db';
import { logSecurityAlert } from './audit-log';

// ============================================
// TYPES
// ============================================

export type AlertType =
  | 'BRUTE_FORCE'
  | 'RATE_LIMIT_ABUSE'
  | 'CSRF_STORM'
  | 'CREDENTIAL_STUFFING'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'
  | 'SUSPICIOUS_PATTERN';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface AlertRule {
  type: AlertType;
  threshold: number;
  windowMs: number;
  cooldownMs: number;
  severity: AlertSeverity;
  title: string;
  description: string;
}

interface AlertEvent {
  type: AlertType;
  ipAddress: string;
  userId?: string | null;
  email?: string | null;
  details?: Record<string, unknown>;
}

// ============================================
// ALERT RULES
// ============================================

const ALERT_RULES: Record<AlertType, AlertRule> = {
  BRUTE_FORCE: {
    type: 'BRUTE_FORCE', threshold: 5, windowMs: 10 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000, severity: 'HIGH',
    title: 'Brute Force Attack Detected',
    description: 'Multiple failed login attempts from the same IP address.',
  },
  RATE_LIMIT_ABUSE: {
    type: 'RATE_LIMIT_ABUSE', threshold: 10, windowMs: 5 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000, severity: 'MEDIUM',
    title: 'Rate Limit Abuse Detected',
    description: 'Repeated rate limit violations from the same IP address.',
  },
  CSRF_STORM: {
    type: 'CSRF_STORM', threshold: 3, windowMs: 5 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000, severity: 'HIGH',
    title: 'CSRF Attack Pattern Detected',
    description: 'Multiple CSRF validation failures from the same IP.',
  },
  CREDENTIAL_STUFFING: {
    type: 'CREDENTIAL_STUFFING', threshold: 5, windowMs: 10 * 60 * 1000,
    cooldownMs: 60 * 60 * 1000, severity: 'CRITICAL',
    title: 'Credential Stuffing Attack Detected',
    description: 'Failed logins across multiple accounts from the same IP.',
  },
  PRIVILEGE_ESCALATION_ATTEMPT: {
    type: 'PRIVILEGE_ESCALATION_ATTEMPT', threshold: 5, windowMs: 10 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000, severity: 'HIGH',
    title: 'Privilege Escalation Attempt Detected',
    description: 'Repeated unauthorized access attempts from the same user.',
  },
  SUSPICIOUS_PATTERN: {
    type: 'SUSPICIOUS_PATTERN', threshold: 10, windowMs: 10 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000, severity: 'MEDIUM',
    title: 'Suspicious Activity Pattern Detected',
    description: 'Unusual pattern of requests detected.',
  },
};

// ============================================
// EVENT TRACKER (in-memory)
// ============================================

interface TrackedEvent {
  timestamp: number;
  identifier: string;
  metadata?: Record<string, unknown>;
}

const eventBuffer: TrackedEvent[] = [];
const alertCooldowns = new Map<string, number>();

let _cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function cleanupBuffer(): void {
  const now = Date.now();
  const maxWindow = Math.max(...Object.values(ALERT_RULES).map(r => r.windowMs));
  const cutoff = now - maxWindow - 60_000;
  let i = eventBuffer.length - 1;
  while (i >= 0 && eventBuffer[i].timestamp < cutoff) i--;
  if (i < eventBuffer.length - 1) eventBuffer.splice(0, eventBuffer.length - 1 - i);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Record a security event and check if it triggers an alert.
 * Fire-and-forget: returns immediately.
 */
export function trackSecurityEvent(event: AlertEvent): void {
  try {
    eventBuffer.push({
      timestamp: Date.now(),
      identifier: event.ipAddress,
      metadata: { type: event.type, userId: event.userId, email: event.email, ...event.details },
    });

    checkAndAlert(event).catch(() => {});

    if (!_cleanupTimer) {
      _cleanupTimer = setTimeout(() => {
        _cleanupTimer = null;
        cleanupBuffer();
      }, 60_000);
    }
  } catch {
    // Alert tracking must NEVER break the application
  }
}

async function checkAndAlert(event: AlertEvent): Promise<void> {
  const rule = ALERT_RULES[event.type];
  if (!rule) return;

  const now = Date.now();
  const cooldownKey = `${event.type}:${event.ipAddress}`;
  const lastAlert = alertCooldowns.get(cooldownKey) || 0;

  if (now - lastAlert < rule.cooldownMs) return;

  const windowStart = now - rule.windowMs;
  const matchingEvents = eventBuffer.filter(
    e => e.timestamp >= windowStart && e.identifier === event.ipAddress && e.metadata?.type === event.type,
  );

  if (matchingEvents.length >= rule.threshold) {
    await createAlert(rule, event);
    alertCooldowns.set(cooldownKey, now);
  }
}

async function createAlert(rule: AlertRule, event: AlertEvent): Promise<void> {
  try {
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    const eventCount = eventBuffer.filter(
      e => e.timestamp >= windowStart && e.identifier === event.ipAddress && e.metadata?.type === event.type,
    ).length;

    await db.securityAlert.create({
      data: {
        type: rule.type,
        severity: rule.severity,
        ipAddress: event.ipAddress,
        userId: event.userId || null,
        email: event.email || null,
        title: rule.title,
        description: rule.description,
        metadata: JSON.stringify({ eventCount, windowMs: rule.windowMs, threshold: rule.threshold, timestamp: new Date().toISOString(), ...event.details }),
        status: 'OPEN',
      },
    });

    logSecurityAlert(rule.type, event.ipAddress, {
      severity: rule.severity, eventCount, threshold: rule.threshold, userId: event.userId, email: event.email,
    });

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SecurityAlert] ${rule.severity} ${rule.type}: ${rule.title} (IP: ${event.ipAddress}, Events: ${eventCount}/${rule.threshold})`);
    }
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.error('[SecurityAlert] Failed to create alert');
    }
  }
}

/**
 * Track a failed login and detect both brute force and credential stuffing.
 */
export function trackFailedLogin(email: string, ipAddress: string): void {
  trackSecurityEvent({ type: 'BRUTE_FORCE', ipAddress, email, details: { email } });
  checkCredentialStuffing(ipAddress, email).catch(() => {});
}

async function checkCredentialStuffing(ipAddress: string, currentEmail: string): Promise<void> {
  try {
    const now = Date.now();
    const rule = ALERT_RULES.CREDENTIAL_STUFFING;
    const cooldownKey = `CREDENTIAL_STUFFING:${ipAddress}`;
    const lastAlert = alertCooldowns.get(cooldownKey) || 0;

    if (now - lastAlert < rule.cooldownMs) return;

    const windowStart = now - 10 * 60 * 1000;
    const matchingEvents = eventBuffer.filter(
      e => e.timestamp >= windowStart && e.identifier === ipAddress && e.metadata?.type === 'BRUTE_FORCE',
    );

    const uniqueEmails = new Set(matchingEvents.map(e => e.metadata?.email));
    uniqueEmails.add(currentEmail);

    if (uniqueEmails.size >= 3 && matchingEvents.length >= rule.threshold) {
      await createAlert(rule, {
        type: 'CREDENTIAL_STUFFING', ipAddress,
        details: { uniqueAccounts: uniqueEmails.size, totalAttempts: matchingEvents.length },
      });
      alertCooldowns.set(cooldownKey, now);
    }
  } catch {
    // Detection must never break the application
  }
}

/**
 * Get alert statistics for admin dashboard.
 */
export async function getAlertStats(): Promise<{
  total: number; open: number;
  byType: Record<string, number>; bySeverity: Record<string, number>;
  recent24h: number;
}> {
  const [total, open, recent24h, byTypeRaw, bySeverityRaw] = await Promise.all([
    db.securityAlert.count(),
    db.securityAlert.count({ where: { status: 'OPEN' } }),
    db.securityAlert.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    db.securityAlert.groupBy({ by: ['type'], _count: { id: true } }),
    db.securityAlert.groupBy({ by: ['severity'], _count: { id: true } }),
  ]);

  const byType: Record<string, number> = {};
  for (const item of byTypeRaw) byType[item.type] = item._count.id;

  const bySeverity: Record<string, number> = {};
  for (const item of bySeverityRaw) bySeverity[item.severity] = item._count.id;

  return { total, open, byType, bySeverity, recent24h };
}
