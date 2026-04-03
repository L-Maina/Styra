import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { verifyEmailToken } from '@/lib/email-verification';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { generateCsrfToken } from '@/lib/csrf';

// POST /api/auth/verify-email
// Verifies an email verification token, marks user as verified,
// and creates a session for the newly verified user.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return errorResponse('Verification token is required', 400);
    }

    // Verify token (also marks it as used)
    const result = await verifyEmailToken(token);
    if (!result) {
      return errorResponse('Invalid, expired, or already used verification token', 400);
    }

    const { userId, email } = result;

    // Look up the user
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Verify the email matches (in case it was changed)
    if (user.email !== email) {
      return errorResponse('Token does not match current email', 400);
    }

    // Mark user as email verified
    await db.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });

    // Create a session for the newly verified user
    const updatedUser = await db.user.findUnique({ where: { id: userId } });
    if (updatedUser) {
      await createSession(updatedUser);
    }

    // Set CSRF token
    const response = successResponse({
      message: 'Email verified successfully',
      userId: user.id,
      email: user.email,
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
    return handleApiError(error);
  }
}
