import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createOTP } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const resendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters'),
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name is required'),
  password: z.string().min(8, 'Password is required'),
});

/**
 * POST /api/auth/resend-otp
 *
 * Generates a new OTP and re-stores registration data.
 * Must include email/name/password because the registration data
 * needs to be preserved in the new OTP record.
 *
 * If the user already exists and is verified, returns alreadyVerified.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = resendOtpSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid data', 400);
    }

    const { phone, email, name, password } = validated.data;

    // Check if already verified
    const existingUser = await db.user.findFirst({ where: { phone } });
    if (existingUser?.isVerified) {
      return successResponse({ message: 'Phone number is already verified', alreadyVerified: true });
    }

    // If user exists but not verified, they must have completed step 1 previously
    // Re-generate OTP with fresh registration data
    const { hashPassword } = await import('@/lib/auth');
    const hashedPassword = await hashPassword(password);

    const registrationData = JSON.stringify({
      email: email.toLowerCase(),
      name,
      phone,
      hashedPassword,
      role: 'CUSTOMER',
    });

    const otpCode = await createOTP(null, registrationData, phone, 'phone_verification');

    // Try Supabase Auth SMS
    let otpSent = false;

    try {
      const supabase = getSupabaseAdmin();
      const { error: smsError } = await supabase.auth.signInWithOtp({ phone });

      if (smsError) {
        console.error('[Resend OTP SMS Failed]', smsError.message);
      } else {
        otpSent = true;
      }
    } catch (err) {
      console.error('[Resend OTP SMS Error]', err);
    }

    return successResponse({
      message: otpSent ? 'New verification code sent to your phone' : 'New verification code generated',
      otpSent,
      otpCode: otpSent ? undefined : otpCode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
