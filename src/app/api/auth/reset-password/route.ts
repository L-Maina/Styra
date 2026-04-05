import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';
import { logPasswordResetCompleted, auditLog, extractRequestInfo } from '@/lib/audit-log';

const resetPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many password reset attempts. Please try again later.',
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await resetPasswordRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = resetPasswordSchema.parse(body);

    const tokenRecord = await db.passwordReset.findUnique({
      where: { token: validated.token },
    });

    if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < new Date()) {
      return errorResponse('Invalid or expired reset token', 400);
    }

    const hashedPassword = await hashPassword(validated.password);

    // Update password AND increment tokenVersion to invalidate all existing sessions
    // IMPORTANT: tokenVersion increment happens BEFORE any session clearing so that
    // even the current request's session is invalidated (defense-in-depth).
    const updatedUser = await db.user.update({
      where: { id: tokenRecord.userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    await db.passwordReset.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    });

    const info = extractRequestInfo(request);
    logPasswordResetCompleted(updatedUser.email, info.ipAddress, info.userAgent);

    // Audit log: PASSWORD_CHANGED tracks tokenVersion invalidation due to password change
    // This is distinct from PASSWORD_RESET_COMPLETED which tracks the flow completion.
    auditLog({
      userId: updatedUser.id,
      email: updatedUser.email,
      action: 'PASSWORD_CHANGED',
      ipAddress: info.ipAddress,
      route: info.route,
      method: info.method,
      userAgent: info.userAgent,
      success: true,
    });

    return successResponse({ message: 'Password reset successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
