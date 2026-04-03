import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";

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
export async function GET() {
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

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "name email",
    response_mode: "form_post",
    state: crypto.randomUUID(),
  });

  const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;

  return NextResponse.json(
    {
      success: true,
      provider: "apple",
      authUrl: appleAuthUrl,
      redirectUri,
    },
    { status: 200 }
  );
}

export async function POST() {
  return GET();
}
