import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createOTP } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const resendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters'),
});

// POST /api/auth/resend-otp
// Sends a new OTP code via Supabase Auth SMS (or fallback to DB OTP).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = resendOtpSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid phone number', 400);
    }

    const { phone } = validated.data;

    // Find the user by phone number
    const user = await db.user.findFirst({ where: { phone } });
    if (!user) {
      return errorResponse('No account found with this phone number', 404);
    }

    // Already verified
    if (user.isVerified) {
      return successResponse({ message: 'Phone number is already verified', alreadyVerified: true });
    }

    // Try Supabase Auth SMS first
    let otpSent = false;
    let otpFallback: string | null = null;

    try {
      const supabase = getSupabaseAdmin();
      const { error: smsError } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (smsError) {
        console.error('[Resend OTP SMS Failed]', smsError.message);
        otpFallback = await createOTP(user.id, user.email, phone, 'phone_verification');
      } else {
        otpSent = true;
      }
    } catch (err) {
      console.error('[Resend OTP SMS Error]', err);
      otpFallback = await createOTP(user.id, user.email, phone, 'phone_verification');
    }

    return successResponse({
      message: otpSent ? 'New verification code sent to your phone' : 'New verification code generated',
      otpSent,
      otpCode: otpSent ? undefined : otpFallback,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
