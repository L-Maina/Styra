// ============================================
// CSRF PROTECTION — Double Submit Cookie Pattern
// ============================================
// This module implements stateless CSRF protection using the
// Double Submit Cookie pattern. It requires NO server-side
// storage, making it compatible with:
//   - Server restarts (token stored in cookie)
//   - Multi-instance deployments (no shared state needed)
//   - Edge runtime (pure crypto, no I/O)
//
// HOW IT WORKS:
//   1. Server generates a random token, sets it as a NON-httpOnly cookie.
//   2. Client reads cookie via document.cookie, sends as X-CSRF-Token header.
//   3. Server validates: cookie value === header value.
//
// WHY THIS IS SECURE:
//   - An attacker's site CANNOT read our cookies (SameSite=Lax blocks cross-site)
//   - An attacker's site CANNOT set custom headers (only XHR/fetch can)
//   - Therefore, only requests from our own origin can pass validation.
//
// EXEMPTIONS (routes that don't require CSRF):
//   - Auth routes (login, register, forgot-password, reset-password) — no session to exploit
//   - Webhook endpoints — called by external services, not browsers
//   - GET/HEAD/OPTIONS — safe methods, never need CSRF

import { NextRequest, NextResponse } from 'next/server';

// Routes exempt from CSRF (no authenticated session to exploit)
const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/resend-verification',
  '/api/auth/verify-email',
  '/api/auth/logout',
  '/api/auth/logout-all',
  '/api/auth/me',
  '/api/webhooks/',
  '/api/health',
  '/api/businesses/auto-verify', // Called internally during registration
  '/api/cron/', // Cron jobs are server-side only
  '/api/setup',
  '/api/db-setup',
];

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Generate a cryptographically secure CSRF token.
 * Uses Web Crypto API — works in Edge, Node.js, and browser.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if a path is exempt from CSRF validation.
 */
export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((exempt) => pathname.startsWith(exempt));
}

/**
 * Check if the HTTP method is state-changing (needs CSRF validation).
 */
export function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING_METHODS.includes(method.toUpperCase());
}

/**
 * Set the CSRF token as a non-httpOnly cookie on a response.
 * Used by middleware and auth routes.
 */
export function setCsrfCookie(response: NextResponse, token?: string): void {
  const csrfToken = token || generateCsrfToken();
  response.cookies.set('csrf-token', csrfToken, {
    httpOnly: false, // MUST be false so JS can read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Prevents cross-site cookie sending
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Get the CSRF token from the request cookie.
 */
export function getCsrfCookie(request: NextRequest): string | undefined {
  return request.cookies.get('csrf-token')?.value;
}

/**
 * Validate CSRF token using Double Submit Cookie pattern.
 * Returns null if valid, or a 403 response if invalid.
 *
 * @param request - The incoming NextRequest
 * @returns null if CSRF check passes, or a 403 NextResponse
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Skip safe methods
  if (!isStateChangingMethod(request.method)) {
    return null;
  }

  // Skip exempt paths
  if (isCsrfExempt(pathname)) {
    return null;
  }

  // Only enforce CSRF for authenticated requests (those with an auth cookie)
  const hasAuthCookie = !!request.cookies.get('styra-token')?.value;
  if (!hasAuthCookie) {
    // No session = no CSRF risk — attacker can't forge a request
    // that has the user's httpOnly auth cookie
    return null;
  }

  // === CSRF VALIDATION ===

  const cookieToken = getCsrfCookie(request);
  const headerToken = request.headers.get('x-csrf-token');

  // Both must be present
  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'CSRF token missing. Please reload the page and try again.',
        code: 'CSRF_TOKEN_MISSING',
      },
      { status: 403 }
    );
  }

  // Constant-time comparison to prevent timing attacks
  // (using a simple approach — for production, use crypto.subtle.timingSafeEqual)
  if (!safeEquals(cookieToken, headerToken)) {
    return NextResponse.json(
      {
        success: false,
        error: 'CSRF token invalid. Please reload the page and try again.',
        code: 'CSRF_TOKEN_INVALID',
      },
      { status: 403 }
    );
  }

  return null; // CSRF check passed
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Falls back to regular comparison for strings of different lengths
 * (which leaks length info, but that's acceptable for CSRF tokens).
 */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}
