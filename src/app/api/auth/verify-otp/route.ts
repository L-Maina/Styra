import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyOTP } from '@/lib/auth';
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

    const isValid = await verifyOTP(validated.phone, validated.code);
    if (!isValid) {
      return errorResponse('Invalid or expired OTP', 400);
    }

    await db.user.update({
      where: { phone: validated.phone },
      data: { phoneVerified: new Date() },
    });

    return successResponse({ message: 'Phone number verified successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
