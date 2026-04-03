import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";

/**
 * GET /api/auth/google/callback
 *
 * Handles Google OAuth 2.0 callback.
 * Receives ?code=...&state=... from Google.
 * Exchanges code for tokens, retrieves user info, creates/finds user.
 *
 * Requires: GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_GOOGLE_CLIENT_ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=no_code`
      );
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=not_configured`
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[Google OAuth] Token exchange failed:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=token_exchange`
      );
    }

    const tokens = await tokenResponse.json();

    // Retrieve Google user info
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userResponse.ok) {
      console.error("[Google OAuth] Failed to fetch user info");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=user_info`
      );
    }

    const googleUser = await userResponse.json();

    // TODO: Create/find user in database using googleUser data
    // TODO: Issue Styra JWT
    // TODO: Redirect to frontend with success

    // For now, return user info (in production, this would create a session)
    return NextResponse.json({
      success: true,
      provider: "google",
      user: {
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        emailVerified: googleUser.email_verified,
      },
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
        scope: tokens.scope,
      },
    });
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=server_error`
    );
  }
}
