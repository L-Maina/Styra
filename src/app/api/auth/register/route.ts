import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createOTP } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { registerSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/auth/register
 *
 * Step 1 of registration — does NOT create a User yet.
 * Validates input, stores registration data in an OTPVerification record,
 * and sends OTP via Supabase Auth SMS (or shows fallback code).
 *
 * The user is only created in Step 2 (POST /api/auth/verify-otp).
 * If the user goes back or abandons, the OTP expires in 10 minutes
 * and no orphan account is left behind.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid registration data', 400);
    }

    const email = validated.data.email.toLowerCase();

    // Check if email is already taken
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(
        'Unable to create account. Please try a different email.',
        409
      );
    }

    if (validated.data.phone) {
      const existingPhone = await db.user.findFirst({
        where: { phone: validated.data.phone },
      });
      if (existingPhone) {
        return errorResponse('This phone number is already registered', 409);
      }
    }

    const hashedPassword = await hashPassword(validated.data.password);

    // Store registration data as JSON in the OTP record's email field.
    // The user is NOT created yet — only after OTP is verified.
    // If abandoned, the OTP expires in 10 minutes and nothing is left behind.
    const registrationData = JSON.stringify({
      email,
      name: validated.data.name,
      phone: validated.data.phone || null,
      hashedPassword,
      role: 'CUSTOMER',
    });

    // Create OTP — the registration payload is stored in the email field
    // so verify-otp can retrieve it and create the user
    const otpCode = await createOTP(
      null,              // no userId yet
      registrationData,  // JSON payload in email field
      validated.data.phone || null,
      'phone_verification'
    );

    // Send OTP via Supabase Auth (real SMS to the phone)
    let otpSent = false;

    if (validated.data.phone) {
      try {
        const supabase = getSupabaseAdmin();
        const { error: smsError } = await supabase.auth.signInWithOtp({
          phone: validated.data.phone,
        });

        if (smsError) {
          console.error('[OTP SMS Failed]', smsError.message);
        } else {
          otpSent = true;
        }
      } catch (err) {
        console.error('[OTP SMS Error]', err);
      }
    }

    return successResponse(
      {
        email,
        name: validated.data.name,
        otpSent,
        otpCode: otpSent ? undefined : otpCode,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
