import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { forgotPasswordSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { randomBytes } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { logPasswordResetRequested, extractRequestInfo } from '@/lib/audit-log';
import { sendEmail, emailTemplates } from '@/lib/email';

const resetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  message: 'Too many password reset attempts. Please try again later.',
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await resetRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = forgotPasswordSchema.parse(body);
    const info = extractRequestInfo(request);

    const user = await db.user.findUnique({ where: { email: validated.email } });

    if (!user) {
      return successResponse({ message: 'If an account exists, you will receive a reset email' });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    await db.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    logPasswordResetRequested(validated.email, info.ipAddress, info.userAgent);

    // Build the frontend reset URL (NOT the API route)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const template = emailTemplates.resetPassword({ name: user.name || user.email || '', resetUrl });
    const emailSent = await sendEmail({ to: user.email, ...template });

    if (!emailSent) {
      // Email not configured (no RESEND_API_KEY) — return reset link directly
      return successResponse({
        message: 'Email not configured. Use the link below to reset your password.',
        resetUrl,
        emailSent: false,
      });
    }

    return successResponse({
      message: 'If an account exists, you will receive a reset email',
      emailSent: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
