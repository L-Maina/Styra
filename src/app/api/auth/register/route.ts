import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken, createOTP } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { registerSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid registration data', 400);
    }

    const email = validated.data.email.toLowerCase();

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

    const user = await db.user.create({
      data: {
        email,
        name: validated.data.name,
        phone: validated.data.phone || null,
        password: hashedPassword,
        role: 'customer',
      },
    });

    // Send OTP via Supabase Auth (real SMS to the phone)
    let otpSent = false;
    let otpFallback: string | null = null;

    if (validated.data.phone) {
      try {
        const supabase = getSupabaseAdmin();
        const { error: smsError } = await supabase.auth.signInWithOtp({
          phone: validated.data.phone,
        });

        if (smsError) {
          console.error('[OTP SMS Failed]', smsError.message);
          // Fallback: generate OTP in DB so user can still verify
          otpFallback = await createOTP(user.id, email, validated.data.phone, 'phone_verification');
        } else {
          otpSent = true;
        }
      } catch (err) {
        // Supabase not configured or auth not enabled — fallback to DB OTP
        console.error('[OTP SMS Error]', err);
        otpFallback = await createOTP(user.id, email, validated.data.phone, 'phone_verification');
      }
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const response = successResponse(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        otpSent,
        // Only include fallback code if SMS failed (for dev/debugging)
        otpCode: otpSent ? undefined : otpFallback,
      },
      201
    );

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
