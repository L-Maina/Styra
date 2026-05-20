import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// ── Apple JWKS Key Fetching ──────────────────────────────────────────────────

// Cache Apple's JWKS keys for 24 hours
let jwksCache: { keys: Array<{ kid: string; n: string; e: string; kty: string }>; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getAppleJWKS() {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
    return jwksCache.keys;
  }

  const response = await fetch('https://appleid.apple.com/auth/keys');
  if (!response.ok) {
    throw new Error('Failed to fetch Apple JWKS');
  }

  const data = await response.json();
  jwksCache = { keys: data.keys, fetchedAt: Date.now() };
  return jwksCache.keys;
}

/**
 * Get Apple's public key for a given key ID (kid) as a PEM string.
 * Fetches Apple's JWKS, finds the matching key, and converts it to PEM format
 * for use with jsonwebtoken.verify().
 */
async function getApplePublicKey(kid: string): Promise<string | null> {
  try {
    const keys = await getAppleJWKS();
    const key = keys.find((k) => k.kid === kid);
    if (!key) return null;

    // Convert JWK (n, e) to PEM using Node.js crypto
    const modulus = Buffer.from(key.n, 'base64url');
    const exponent = Buffer.from(key.e, 'base64url');

    // Build DER-encoded RSA public key
    const der = createRSAPublicKeyDER(modulus, exponent);

    // Convert DER to PEM
    const pem = `-----BEGIN PUBLIC KEY-----\n${der.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
    return pem;
  } catch (error) {
    console.error('[Apple OAuth] Failed to get Apple public key:', error);
    return null;
  }
}

/**
 * Create a DER-encoded RSA public key from modulus and exponent.
 */
function createRSAPublicKeyDER(modulus: Buffer, exponent: Buffer): Buffer {
  // ASN.1 DER encoding for RSA public key (PKCS#1)
  function encodeLength(length: number): Buffer {
    if (length < 128) return Buffer.from([length]);
    const hex = length.toString(16);
    const bytes = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
    return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
  }

  function encodeInteger(buf: Buffer): Buffer {
    // Add leading zero if high bit is set (to keep it positive)
    if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0x00]), buf]);
    return Buffer.concat([Buffer.from([0x02]), encodeLength(buf.length), buf]);
  }

  const modEnc = encodeInteger(modulus);
  const expEnc = encodeInteger(exponent);

  // SEQUENCE { INTEGER modulus, INTEGER exponent }
  const seqContent = Buffer.concat([modEnc, expEnc]);
  const seq = Buffer.concat([Buffer.from([0x30]), encodeLength(seqContent.length), seqContent]);

  // BIT STRING { SEQUENCE { ... } }
  const bitStringContent = Buffer.concat([Buffer.from([0x00]), seq]);
  const bitString = Buffer.concat([Buffer.from([0x03]), encodeLength(bitStringContent.length), bitStringContent]);

  // SEQUENCE { OID rsaEncryption, NULL, BIT STRING { SEQUENCE { ... } } }
  const rsaEncryptionOid = Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  const spkiContent = Buffer.concat([rsaEncryptionOid, bitString]);
  const spki = Buffer.concat([Buffer.from([0x30]), encodeLength(spkiContent.length), spkiContent]);

  return spki;
}

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

    // Verify the id_token using Apple's public keys (JWKS)
    // Step 1: Decode the header to get the key ID (kid)
    const decodedHeader = jwt.decode(tokens.id_token, { complete: true });
    if (!decodedHeader || typeof decodedHeader.header?.kid !== 'string') {
      return NextResponse.json(
        { success: false, error: "Failed to decode Apple id_token header" },
        { status: 400 }
      );
    }

    // Step 2: Fetch Apple's JWKS and find the matching key
    const applePublicKey = await getApplePublicKey(decodedHeader.header.kid);
    if (!applePublicKey) {
      return NextResponse.json(
        { success: false, error: "Unable to verify Apple id_token: key not found" },
        { status: 400 }
      );
    }

    // Step 3: Verify the id_token signature with the public key
    let payload: Record<string, unknown>;
    try {
      payload = jwt.verify(tokens.id_token, applePublicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
      }) as Record<string, unknown>;
    } catch (verifyError) {
      console.error('[Apple OAuth] id_token verification failed:', verifyError);
      return NextResponse.json(
        { success: false, error: "Apple id_token verification failed" },
        { status: 400 }
      );
    }

    const appleUser = {
      sub: payload?.sub as string | undefined,
      email: payload?.email as string | undefined,
      emailVerified: (payload?.email_verified as boolean) || false,
      name: user ? (JSON.parse(user as string).name as string) : undefined,
    };

    // ── Create/find user in database ──
    const email = appleUser.email?.toLowerCase();
    // Apple may not always provide a name; use email as fallback
    const name = appleUser.name || email || 'Apple User';

    if (!email) {
      return NextResponse.json(
        { success: false, error: "No email provided by Apple" },
        { status: 400 }
      );
    }

    let dbUser = await db.user.findUnique({ where: { email } });

    if (dbUser) {
      // Existing user — update name if it was missing and Apple provided one
      if (!dbUser.avatar && appleUser.name) {
        dbUser = await db.user.update({
          where: { id: dbUser.id },
          data: { name: appleUser.name },
        });
      }
    } else {
      // New user — create with Apple profile data
      dbUser = await db.user.create({
        data: {
          email,
          name,
          role: "CUSTOMER",
          isVerified: true,
          emailVerified: true,
        },
      });

      // Create wallet for the new user
      await db.wallet.create({
        data: {
          userId: dbUser.id,
          balance: 0,
          pendingBalance: 0,
          currency: "KES",
        },
      });
    }

    if (dbUser.isBanned) {
      return NextResponse.json(
        { success: false, error: "Account has been suspended" },
        { status: 403 }
      );
    }

    // ── Issue Styra JWT session ──
    await createSession({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      tokenVersion: dbUser.tokenVersion,
    });

    // ── Redirect to frontend with success indicator ──
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "/"}?auth=apple_success`
    );

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
