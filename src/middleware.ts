import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Lightweight middleware — no env-dependent crashes
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Security headers for all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

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
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    } else if (origin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
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
