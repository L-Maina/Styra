import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

/**
 * GET /api/auth/google/callback
 *
 * Handles Google OAuth 2.0 callback.
 * Receives ?code=...&state=... from Google.
 * Validates state (CSRF protection), exchanges code for tokens,
 * retrieves user info, creates/finds user.
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

    // ── CSRF: Validate state parameter ──
    // The state was set as a cookie by the /api/auth/google initiator.
    // If it doesn't match, this could be a CSRF attack.
    const cookieState = request.cookies.get('oauth-state')?.value;
    if (!state || !cookieState || state !== cookieState) {
      console.warn('[Google OAuth] State mismatch — possible CSRF attack', {
        hasState: !!state,
        hasCookieState: !!cookieState,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=invalid_state`
      );
    }

    // Clear the state cookie (one-time use)
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

    // ── Create/find user in database ──
    const email = (googleUser.email as string)?.toLowerCase();
    const name = (googleUser.name as string) || email;
    const avatar = googleUser.picture as string | undefined;

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=no_email`
      );
    }

    let user = await db.user.findUnique({ where: { email } });

    if (user) {
      // Existing user — update avatar if not already set
      if (!user.avatar && avatar) {
        user = await db.user.update({
          where: { id: user.id },
          data: { avatar },
        });
      }
    } else {
      // New user — create with Google profile data
      user = await db.user.create({
        data: {
          email,
          name,
          avatar: avatar || null,
          role: "CUSTOMER",
          isVerified: true,
          emailVerified: true,
        },
      });

      // Create wallet for the new user
      await db.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          pendingBalance: 0,
          currency: "KES",
        },
      });
    }

    if (user.isBanned) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=banned`
      );
    }

    // ── Issue Styra JWT session ──
    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    // ── Redirect to frontend with success indicator ──
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_success`
    );

    // Clear the OAuth state cookie (one-time use)
    response.cookies.delete('oauth-state');

    return response;
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=google_failed&reason=server_error`
    );
  }
}
