import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createOTP } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const resendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters'),
});

// POST /api/auth/resend-otp
// Generates a new OTP code for phone verification and returns it to the frontend.
// No SMS provider is configured, so the code is returned directly for display.
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

    // Generate new OTP
    const otpCode = await createOTP(user.id, user.email, phone, 'phone_verification');

    return successResponse({
      message: 'New verification code generated',
      otpCode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
