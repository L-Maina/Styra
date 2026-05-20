import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { rateLimit, authRateLimitConfig } from "@/lib/rate-limit";

// Max 5 OAuth initiation attempts per 15 minutes per IP
const oauthRateLimiter = rateLimit(authRateLimitConfig);

/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth 2.0 sign-in flow.
 *
 * Flow:
 *   1. Client calls this endpoint
 * 2. Server generates a state token (stored in cookie for CSRF protection)
 *   3. Server redirects browser to Google's consent screen
 *   4. Google redirects back to /api/auth/google/callback with code + state
 *   5. Callback endpoint exchanges code for Google user info + id_token
 *  6. Server creates/finds user account, issues JWT
 *
 * Requires: NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
 */
export async function GET(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await oauthRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      {
        success: false,
        error: "Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
      },
      { status: 503 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  // Generate and store state in a cookie for CSRF protection in the callback
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.redirect(googleAuthUrl);

  // Store state in a short-lived cookie so callback can verify it
  response.cookies.set('oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
