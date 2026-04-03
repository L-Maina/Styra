import crypto from 'crypto';
import { db } from './db';

// ============================================
// EMAIL VERIFICATION HELPERS
// ============================================
// Handles generation, validation, and sending of
// email verification tokens for new user accounts.
//
// TOKEN FORMAT: 32-byte hex string (64 characters)
// EXPIRY: 30 minutes
// SECURITY: Only one active token per user at a time;
// generating a new one invalidates all previous tokens.

const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a new email verification token for a user.
 *
 * 1. Creates a 32-byte cryptographically random token (hex)
 * 2. Invalidates all previous tokens for this user
 * 3. Stores the new token in the database with 30 min expiry
 * 4. Returns the raw token string (for use in verification links)
 */
export async function generateEmailVerificationToken(
  userId: string,
  email: string,
): Promise<string> {
  // Step 1: Generate cryptographically random token
  const token = crypto.randomBytes(32).toString('hex');

  // Step 2: Invalidate all previous tokens for this user
  await db.emailVerificationToken.updateMany({
    where: { userId, isUsed: false },
    data: { isUsed: true },
  });

  // Step 3: Store the new token
  await db.emailVerificationToken.create({
    data: {
      userId,
      token,
      email,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    },
  });

  return token;
}

/**
 * Verify an email verification token.
 *
 * 1. Looks up the token in the database
 * 2. Checks it hasn't been used or expired
 * 3. Marks the token as used
 * 4. Returns userId and email if valid, null otherwise
 */
export async function verifyEmailToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const tokenRecord = await db.emailVerificationToken.findUnique({
    where: { token },
  });

  if (!tokenRecord) return null;
  if (tokenRecord.isUsed) return null;
  if (tokenRecord.expiresAt < new Date()) return null;

  // Mark token as used
  await db.emailVerificationToken.update({
    where: { id: tokenRecord.id },
    data: { isUsed: true },
  });

  return {
    userId: tokenRecord.userId,
    email: tokenRecord.email,
  };
}

/**
 * Send a verification email to the user.
 *
 * Uses the Resend API when RESEND_API_KEY is set.
 * Falls back to console logging in development mode.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev mode: log the verification link
    console.log(`[Email Verification - DEV MODE] To: ${email}`);
    console.log(`[Email Verification - DEV MODE] Verification URL: ${verificationUrl}`);
    return;
  }

  // Import dynamically to avoid circular dependencies
  const { sendEmail } = await import('./email');

  await sendEmail({
    to: email,
    subject: 'Verify Your Email - Styra',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #059669;">Verify Your Email Address</h1>
        <p>Thank you for signing up with Styra!</p>
        <p>Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${verificationUrl}" style="color: #059669; word-break: break-all;">${verificationUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">
          This link will expire in 30 minutes. If you didn't create an account, please ignore this email.
        </p>
      </div>
    `,
    text: `Verify your email: ${verificationUrl}`,
  });
}
