import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { generateCsrfToken } from '@/lib/csrf';
import { sanitizeUser } from '@/lib/response-sanitizer';
import { rateLimit, authRateLimitConfig } from '@/lib/rate-limit';
import { logFailedLogin, logSuccessfulLogin, extractRequestInfo } from '@/lib/audit-log';
import { trackSecurityEvent } from '@/lib/security-alerts';

// Max 5 login attempts per 15 minutes per IP
const loginRateLimiter = rateLimit(authRateLimitConfig);

// ── Account lockout: in-memory tracking per email ──
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutEntry {
  count: number;
  lockedUntil: number | null;
}

const failedAttemptsMap = new Map<string, LockoutEntry>();

// Periodically clean up stale entries to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedAttemptsMap.entries()) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      failedAttemptsMap.delete(key);
    }
  }
}, 60 * 1000); // Run every minute

export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await loginRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid email or password format', 400);
    }

    const normalizedEmail = validated.data.email.toLowerCase();

    // ── Account lockout check ──
    const lockoutEntry = failedAttemptsMap.get(normalizedEmail);
    if (lockoutEntry?.lockedUntil && lockoutEntry.lockedUntil > Date.now()) {
      const remainingMs = lockoutEntry.lockedUntil - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      // Create a security alert for lockout
      const info = extractRequestInfo(request);
      trackSecurityEvent({
        type: 'BRUTE_FORCE',
        ipAddress: info.ipAddress,
        email: normalizedEmail,
        details: { reason: 'account_locked', failedAttempts: lockoutEntry.count, lockoutMinutes: remainingMinutes },
      });

      return errorResponse(
        `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        429
      );
    }

    // If lockout has expired, clear the entry
    if (lockoutEntry?.lockedUntil && lockoutEntry.lockedUntil <= Date.now()) {
      failedAttemptsMap.delete(normalizedEmail);
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.password) {
      // Log failed login attempt (don't reveal whether email exists)
      const info = extractRequestInfo(request);
      logFailedLogin(validated.data.email, info.ipAddress, info.userAgent);
      incrementFailedAttempts(normalizedEmail, info.ipAddress);
      return errorResponse('Invalid email or password', 401);
    }

    const isValid = await verifyPassword(validated.data.password, user.password);
    if (!isValid) {
      const info = extractRequestInfo(request);
      logFailedLogin(user.email, info.ipAddress, info.userAgent);
      incrementFailedAttempts(normalizedEmail, info.ipAddress);
      return errorResponse('Invalid email or password', 401);
    }

    if (user.isBanned) {
      return errorResponse('Account has been suspended', 403);
    }

    // ── Successful login: clear failed attempts ──
    failedAttemptsMap.delete(normalizedEmail);

    // Log successful login
    const info = extractRequestInfo(request);
    logSuccessfulLogin(user.id, user.email, info.ipAddress, info.userAgent);

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const response = successResponse(
      sanitizeUser(user as unknown as Record<string, unknown>)
    );
    response.cookies.set('styra-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    response.cookies.set('csrf-token', generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}

/**
 * Increment failed login attempts for an email.
 * After MAX_FAILED_ATTEMPTS consecutive failures, lock the account for 15 minutes
 * and create a security alert.
 */
function incrementFailedAttempts(email: string, ipAddress: string): void {
  const current = failedAttemptsMap.get(email) || { count: 0, lockedUntil: null };
  current.count += 1;

  if (current.count >= MAX_FAILED_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;

    // Create a security alert for the lockout event
    trackSecurityEvent({
      type: 'BRUTE_FORCE',
      ipAddress,
      email,
      details: {
        reason: 'account_lockout_triggered',
        failedAttempts: current.count,
        lockoutDurationMinutes: LOCKOUT_DURATION_MS / 60000,
      },
    });

    console.warn(
      `[Auth Lockout] Account ${email} locked for 15 minutes after ${current.count} failed attempts (IP: ${ipAddress})`
    );
  }

  failedAttemptsMap.set(email, current);
}
