import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { slidingWindowRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const banAppealSchema = z.object({
  email: z.string().email('Invalid email address'),
  reason: z.string().min(10, 'Please provide at least 10 characters explaining your appeal').max(2000, 'Appeal reason must be less than 2000 characters'),
});

const appealRateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many appeal submissions. Please try again later.',
};

// Submit ban appeal (public — no auth required since banned users can't authenticate)
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 per hour per IP
    const limiter = slidingWindowRateLimit(appealRateLimitConfig);
    const result = await limiter(request);
    if (result?.limited) {
      return rateLimitResponse(result, appealRateLimitConfig);
    }

    const body = await request.json();
    const parseResult = banAppealSchema.safeParse(body);
    if (!parseResult.success) {
      const messages = parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      return errorResponse(messages.join(', '), 400);
    }
    const validated = parseResult.data;

    // Look up user by email
    const user = await db.user.findUnique({
      where: { email: validated.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return errorResponse('No account found with this email address', 404);
    }

    // Verify user is banned
    const ban = await db.userBan.findUnique({
      where: { userId: user.id },
    });

    if (!ban) {
      return errorResponse('This account is not currently banned or suspended', 400);
    }

    // Only allow appeal if not already pending
    if (ban.appealStatus === 'PENDING') {
      return errorResponse('You already have a pending appeal. Please wait for a response.', 409);
    }

    // Update the ban with the appeal
    const updatedBan = await db.userBan.update({
      where: { userId: user.id },
      data: {
        appealStatus: 'PENDING',
        appealReason: validated.reason,
        appealDate: new Date(),
      },
    });

    return successResponse({
      message: 'Your appeal has been submitted successfully. We will review it and respond within 3-5 business days.',
      ban: {
        id: updatedBan.id,
        appealStatus: updatedBan.appealStatus,
        appealDate: updatedBan.appealDate,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
