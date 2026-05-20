import { NextRequest, NextResponse } from "next/server";
import { rateLimit, authRateLimitConfig } from "@/lib/rate-limit";

// Max 5 OAuth initiation attempts per 15 minutes per IP
const oauthRateLimiter = rateLimit(authRateLimitConfig);

/**
 * GET /api/auth/apple
 *
 * Initiates Apple Sign In JS flow.
 *
 * Flow:
 *   1. Client calls this endpoint
 *  2. Server responds with Apple's authorization URL + configuration
 *   3. Client-side JS handles the Apple sign-in popup/modal
 *   4. Apple calls back with authorization.code + id_token
 *   5. Server validates id_token (RSA signature) via Apple's public keys
 * 6. Server creates/finds user account, issues JWT
 *
 * Requires: NEXT_PUBLIC_APPLE_CLIENT_ID and APPLE_CLIENT_SECRET env vars.
 */
export async function GET(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await oauthRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      {
        success: false,
        error: "Apple sign-in is not configured. Set NEXT_PUBLIC_APPLE_CLIENT_ID.",
      },
      { status: 503 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/apple/callback`;

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "name email",
    response_mode: "form_post",
    state,
  });

  const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;

  const response = NextResponse.json(
    {
      success: true,
      provider: "apple",
      authUrl: appleAuthUrl,
      redirectUri,
    },
    { status: 200 }
  );

  // Store state in a short-lived cookie so callback can verify it
  response.cookies.set('apple-oauth-state', state, {
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
