import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setCsrfCookie, validateCsrf } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Middleware — Security headers, CSRF protection, CORS
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── CSRF validation for state-changing API requests ──
  if (pathname.startsWith('/api/')) {
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

  // ── Set/refresh CSRF cookie on every page load & API response ──
  // This ensures the cookie is always available for the frontend to read
  setCsrfCookie(response);

  // CORS for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || '';
    // Only allow specific origins
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'https://styra.app',
      'http://localhost:3000',
    ].filter(Boolean);

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    } else if (origin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
      response.headers.set('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      // Also set CSRF cookie on OPTIONS preflight responses
      setCsrfCookie(response);
      return new NextResponse(null, { status: 204, headers: Object.fromEntries(response.headers) });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
