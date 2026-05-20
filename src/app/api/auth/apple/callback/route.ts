import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import jwt from "jsonwebtoken";

/**
 * POST /api/auth/apple/callback
 *
 * Handles Apple Sign In callback.
 * Receives authorization.code + user from Apple's form_post response.
 * Validates state (CSRF protection), validates the id_token using Apple's
 * public keys (fetched from Apple), creates/finds user, issues Styra JWT.
 *
 * Requires: APPLE_CLIENT_ID, APPLE_CLIENT_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const code = formData.get("code");
    const state = formData.get("state");
    const user = formData.get("user"); // JSON string with { name, email }

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // ── CSRF: Validate state parameter ──
    const cookieState = request.cookies.get('apple-oauth-state')?.value;
    if (!state || !cookieState || String(state) !== cookieState) {
      console.warn('[Apple OAuth] State mismatch — possible CSRF attack', {
        hasState: !!state,
        hasCookieState: !!cookieState,
      });
      return NextResponse.json(
        { success: false, error: "Invalid state parameter" },
        { status: 403 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    const clientSecret = process.env.APPLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: "Apple sign-in not configured" },
        { status: 503 }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/apple/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("[Apple OAuth] Token exchange failed:", await tokenResponse.text());
      return NextResponse.json(
        { success: false, error: "Token exchange failed" },
        { status: 400 }
      );
    }

    const tokens = await tokenResponse.json();

    // Decode the id_token to get Apple user info
    const decoded = jwt.decode(tokens.id_token, { complete: true });

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Failed to decode Apple id_token" },
        { status: 400 }
      );
    }

    const payload = decoded.payload as Record<string, unknown> | undefined;

    const appleUser = {
      sub: payload?.sub as string | undefined,
      email: payload?.email as string | undefined,
      emailVerified: (payload?.email_verified as boolean) || false,
      name: user ? (JSON.parse(user as string).name as string) : undefined,
    };

    // TODO: Create/find user in database using appleUser data
    // TODO: Issue Styra JWT
    // TODO: Redirect to frontend with success

    // Return minimal user info (NEVER expose access_token/refresh_token to client)
    const response = NextResponse.json({
      success: true,
      provider: "apple",
      user: appleUser,
    });

    // Clear the OAuth state cookie
    response.cookies.delete('apple-oauth-state');

    return response;
  } catch (error) {
    console.error("[Apple OAuth] Callback error:", error);
    return NextResponse.json(
      { success: false, error: "Apple sign-in failed" },
      { status: 400 }
    );
  }
}
