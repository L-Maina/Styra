import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';

// Rate limit: 5 subscriptions per hour per IP
const newsletterRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many newsletter subscription attempts. Please try again later.',
});

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimitResult = await newsletterRateLimiter(request);
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return errorResponse('Email is required', 400);
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await db.formSubmission.findFirst({
      where: {
        type: 'NEWSLETTER',
        email: normalizedEmail,
      },
    });

    if (existing) {
      return errorResponse('Email is already subscribed', 409);
    }

    // Use transaction for atomic subscription + notification
    await db.$transaction(async (tx) => {
      await tx.formSubmission.create({
        data: {
          type: 'NEWSLETTER',
          email: normalizedEmail,
          status: 'PENDING',
        },
      });

      await tx.notification.create({
        data: {
          userId: 'admin',
          title: 'New Newsletter Subscription',
          message: `${normalizedEmail} has subscribed to the newsletter`,
          type: 'SYSTEM_ALERT',
          data: JSON.stringify({ email: normalizedEmail }),
        },
      });
    });

    return successResponse({
      message: 'Successfully subscribed to newsletter',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
