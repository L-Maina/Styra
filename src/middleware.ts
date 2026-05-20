import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setCsrfCookie, getCsrfCookie, validateCsrf } from '@/lib/csrf';
import { checkMiddlewareRateLimit } from '@/lib/middleware-rate-limit';
import { checkPayloadSize, validateContentType } from '@/lib/input-sanitizer';

// ---------------------------------------------------------------------------
// Middleware — Rate limiting, Payload validation, Security headers,
//             CSRF protection, CORS
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    // ── Rate limiting (FIRST — before any other processing) ──
    // This is the first line of defense against brute-force and abuse.
    const rateLimitResponse = checkMiddlewareRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse as unknown as NextResponse;
    }

    // ── Payload size check ──
    // Reject oversized payloads before they're parsed
    const payloadSizeResponse = checkPayloadSize(request);
    if (payloadSizeResponse) {
      return payloadSizeResponse as unknown as NextResponse;
    }

    // ── Content-Type validation ──
    // Reject requests with unsupported content types
    const contentTypeResponse = validateContentType(request);
    if (contentTypeResponse) {
      return contentTypeResponse as unknown as NextResponse;
    }

    // ── CSRF validation for state-changing API requests ──
    const csrfResult = validateCsrf(request);
    if (csrfResult) {
      return csrfResult; // Return 403 if CSRF validation fails
    }
  }

  // Security headers for all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");

  // ── Set CSRF cookie only when needed ──
  // Re-use existing token to avoid breaking multi-tab sessions and to allow
  // CDN caching. Only generate a new token if one doesn't already exist.
  const existingCsrfToken = getCsrfCookie(request);
  if (existingCsrfToken) {
    setCsrfCookie(response, existingCsrfToken);
  } else {
    setCsrfCookie(response);
  }

  // CORS for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || '';
    // Only allow specific origins
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'https://styra-silk.vercel.app',
      'http://localhost:3000',
    ].filter(Boolean);

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: Object.fromEntries(response.headers) });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
