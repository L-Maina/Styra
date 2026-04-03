import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateEmailVerificationToken, sendVerificationEmail } from '@/lib/email-verification';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';
import { auditLog, extractRequestInfo } from '@/lib/audit-log';
import { db } from '@/lib/db';

const resendRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many verification email requests. Please try again later.',
});

// POST /api/auth/resend-verification
// Requires authentication. Rate limited to 3 per hour.
// Generates a new verification token and invalidates old ones.
export async function POST(request: NextRequest) {
  const rateLimitResponse = await resendRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const user = await requireAuth();

    // Don't allow re-verification if already verified
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });
    if (fullUser?.emailVerified) {
      return successResponse({ message: 'Email is already verified' });
    }

    // Generate new token (invalidates all previous ones)
    const token = await generateEmailVerificationToken(user.id, user.email);

    // TODO: Send actual email via email service
    await sendVerificationEmail(user.email, token);

    // Audit log
    const info = extractRequestInfo(request);
    auditLog({
      userId: user.id,
      email: user.email,
      action: 'VERIFICATION_EMAIL_RESENT',
      ipAddress: info.ipAddress,
      route: info.route,
      method: info.method,
      userAgent: info.userAgent,
      success: true,
    });

    return successResponse({ message: 'Verification email sent' });
  } catch (error) {
    return handleApiError(error);
  }
}
