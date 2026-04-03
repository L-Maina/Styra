import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, clearSession } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';
import { auditLog, extractRequestInfo, AuditAction } from '@/lib/audit-log';

const logoutAllRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many logout-all requests. Please try again later.',
});

// POST /api/auth/logout-all
// Requires authentication. Rate limited to 3 per hour.
// Invalidates ALL sessions by incrementing the user's tokenVersion.
export async function POST(request: NextRequest) {
  const rateLimitResponse = await logoutAllRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const user = await requireAuth();

    // Increment tokenVersion — this invalidates ALL existing JWTs
    // because getSession() checks payload.tokenVersion against DB
    await db.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    // Clear the current session cookie
    await clearSession();

    // Audit log
    const info = extractRequestInfo(request);
    auditLog({
      userId: user.id,
      email: user.email,
      action: 'LOGOUT' as AuditAction,
      ipAddress: info.ipAddress,
      route: info.route,
      method: info.method,
      userAgent: info.userAgent,
      success: true,
    });

    return successResponse({ message: 'All sessions invalidated successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
