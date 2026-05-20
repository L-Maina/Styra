import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { generateCsrfToken } from '@/lib/csrf';
import { sanitizeUser } from '@/lib/response-sanitizer';
import { rateLimit, authRateLimitConfig } from '@/lib/rate-limit';
import { logFailedLogin, logSuccessfulLogin, extractRequestInfo } from '@/lib/audit-log';

// Max 5 login attempts per 15 minutes per IP
const loginRateLimiter = rateLimit(authRateLimitConfig);

export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await loginRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid email or password format', 400);
    }

    const user = await db.user.findUnique({
      where: { email: validated.data.email.toLowerCase() },
    });

    if (!user || !user.password) {
      // Log failed login attempt (don't reveal whether email exists)
      const info = extractRequestInfo(request);
      logFailedLogin(validated.data.email, info.ipAddress, info.userAgent);
      return errorResponse('Invalid email or password', 401);
    }

    const isValid = await verifyPassword(validated.data.password, user.password);
    if (!isValid) {
      const info = extractRequestInfo(request);
      logFailedLogin(user.email, info.ipAddress, info.userAgent);
      return errorResponse('Invalid email or password', 401);
    }

    if (user.isBanned) {
      return errorResponse('Account has been suspended', 403);
    }

    // Log successful login
    const info = extractRequestInfo(request);
    logSuccessfulLogin(user.id, user.email, info.ipAddress, info.userAgent);

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const response = successResponse(
      sanitizeUser(user as unknown as Record<string, unknown>)
    );
    response.cookies.set('styra-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    response.cookies.set('csrf-token', generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}
