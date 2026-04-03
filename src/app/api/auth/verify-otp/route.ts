import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyOTP as verifyOTPFromDB } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { otpVerifySchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { rateLimit, authRateLimitConfig } from '@/lib/rate-limit';

const otpRateLimiter = rateLimit(authRateLimitConfig);

export async function POST(request: NextRequest) {
  const rateLimitResponse = await otpRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = otpVerifySchema.parse(body);
    const { phone, code } = validated;

    let verified = false;

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
        // Mark user as verified
        if (result.userId) {
          await db.user.update({
            where: { id: result.userId },
            data: { isVerified: true },
          });
        }
      }
    }

    if (!verified) {
      return errorResponse('Invalid or expired verification code. Please try again.', 400);
    }

    // Also mark as verified in our User table by phone
    await db.user.updateMany({
      where: { phone },
      data: { isVerified: true },
    });

    return successResponse({ message: 'Phone number verified successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
