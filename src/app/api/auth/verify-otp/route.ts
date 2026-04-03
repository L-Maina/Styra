import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyOTP as verifyOTPFromDB } from '@/lib/auth';
import { generateToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { otpVerifySchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { rateLimit, authRateLimitConfig } from '@/lib/rate-limit';

const otpRateLimiter = rateLimit(authRateLimitConfig);

/**
 * POST /api/auth/verify-otp
 *
 * Step 2 of registration — verifies the OTP and ONLY THEN creates the User.
 * If verification fails, no account is created.
 * If the user went back, the OTP expires in 10 minutes and nothing happens.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await otpRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = otpVerifySchema.parse(body);
    const { phone, code } = validated;

    let verified = false;
    let registrationData: string | null = null;

    // Strategy 1: Try Supabase Auth verification (real SMS OTP)
    try {
      const supabase = getSupabaseAdmin();
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (!otpError && data) {
        verified = true;
      }
    } catch (err) {
      console.error('[Verify OTP Supabase Error]', err);
      // Fall through to DB verification
    }

    // Strategy 2: Fallback — verify against our DB OTP table
    if (!verified) {
      const result = await verifyOTPFromDB(code, 'phone_verification');
      if (result) {
        verified = true;
        // Retrieve registration data stored during step 1
        if (result.email && result.email.startsWith('{')) {
          registrationData = result.email;
        }
      }
    }

    if (!verified) {
      return errorResponse('Invalid or expired verification code. Please try again.', 400);
    }

    // Check if user already exists (from a previous successful verification)
    const existingUser = await db.user.findFirst({ where: { phone } });
    if (existingUser) {
      // Already verified — just set session
      const token = generateToken({
        userId: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        tokenVersion: existingUser.tokenVersion,
      });

      const response = successResponse({
        message: 'Phone number verified successfully',
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
      });

      response.cookies.set('styra-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    }

    // NOW create the user (only after OTP is verified)
    if (!registrationData) {
      return errorResponse(
        'Registration data expired. Please start registration again.',
        400
      );
    }

    const regPayload = JSON.parse(registrationData) as {
      email: string;
      name: string;
      phone: string | null;
      hashedPassword: string;
      role: string;
    };

    // Double-check the email isn't taken (race condition protection)
    const emailTaken = await db.user.findUnique({ where: { email: regPayload.email } });
    if (emailTaken) {
      return errorResponse('This email is already registered. Please sign in instead.', 409);
    }

    // Create the user
    const user = await db.user.create({
      data: {
        email: regPayload.email,
        name: regPayload.name,
        phone: regPayload.phone,
        password: regPayload.hashedPassword,
        role: regPayload.role,
        isVerified: true,
      },
    });

    // Generate JWT and set session cookie
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const response = successResponse({
      message: 'Account created and verified successfully!',
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    response.cookies.set('styra-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
