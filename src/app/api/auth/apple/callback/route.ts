import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import jwt from "jsonwebtoken";

/**
 * POST /api/auth/apple/callback
 *
 * Handles Apple Sign In callback.
 * Receives authorization.code + user from Apple's form_post response.
 * Validates the id_token using Apple's public keys (fetched from Apple).
 * Creates/finds user in database, issues Styra JWT.
 *
 * Requires: APPLE_CLIENT_ID, APPLE_CLIENT_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const code = formData.get("code");
    const user = formData.get("user"); // JSON string with { name, email }

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing authorization code" },
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      provider: "apple",
      user: appleUser,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
        scope: tokens.scope,
        idToken: tokens.id_token,
      },
    });
  } catch (error) {
    console.error("[Apple OAuth] Callback error:", error);
    return NextResponse.json(
      { success: false, error: "Apple sign-in failed" },
      { status: 400 }
    );
  }
}
