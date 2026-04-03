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
      where: { email: validated.email, isUsed: false },
      data: { isUsed: true },
    });

    await db.passwordReset.create({
      data: { email: validated.email, token, expiresAt },
    });

    logPasswordResetRequested(validated.email, info.ipAddress, info.userAgent);

    // Send password reset email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/api/auth/reset-password?token=${token}`;
    const template = emailTemplates.resetPassword({ name: user.name || user.email || '', resetUrl });
    await sendEmail({ to: user.email, ...template });

    return successResponse({
      message: 'If an account exists, you will receive a reset email',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
