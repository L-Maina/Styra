import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { generateCsrfToken } from '@/lib/csrf';
import { sanitizeUser } from '@/lib/response-sanitizer';

export async function POST(request: NextRequest) {
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
      return errorResponse('Invalid email or password', 401);
    }

    const isValid = await verifyPassword(validated.data.password, user.password);
    if (!isValid) {
      return errorResponse('Invalid email or password', 401);
    }

    if (user.isBanned) {
      return errorResponse('Account has been suspended', 403);
    }

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
