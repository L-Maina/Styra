import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyOTP as verifyOTPFromDB } from '@/lib/auth';
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

    // verifyOTPFromDB expects (code, purpose) — NOT (phone, code)
    const result = await verifyOTPFromDB(validated.code, 'phone_verification');
    if (!result) {
      return errorResponse('Invalid or expired verification code. Please try again.', 400);
    }

    // Mark user as verified (using isVerified field — phoneVerified column doesn't exist)
    if (result.userId) {
      await db.user.update({
        where: { id: result.userId },
        data: { isVerified: true },
      });
    }

    return successResponse({ message: 'Phone number verified successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
