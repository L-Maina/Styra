import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { autoVerifyExpiredBookings } from '@/lib/verification';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { env } from '@/lib/env';

/**
 * Accepts the secret as `Authorization: Bearer <secret>` (what Vercel Cron sends when the
 * CRON_SECRET environment variable is set) or as `x-cron-secret`.
 *
 * Both sides are hashed first so the comparison is constant time and never throws on a
 * length mismatch (timingSafeEqual throws when its inputs differ in length).
 */
function hasValidSecret(request: NextRequest, expected: string): boolean {
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const provided = bearer ?? request.headers.get('x-cron-secret');
  if (!provided) return false;

  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/cron/release-escrow
 *
 * Cron endpoint for auto-releasing escrow funds.
 * Verifies COMPLETED bookings whose 24 hour window has passed without a confirmation or a
 * dispute, releases their payment to the provider, and releases any payment that is still
 * held for a booking that is already VERIFIED.
 *
 * Scheduled in vercel.json. Security: requires the CRON_SECRET, so nobody else can trigger
 * escrow releases.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = env.cronSecret || process.env.CRON_SECRET;

  if (!expectedSecret) {
    return errorResponse('CRON_SECRET not configured', 500);
  }

  if (!hasValidSecret(request, expectedSecret)) {
    return errorResponse('Invalid cron secret', 401);
  }

  try {
    const result = await autoVerifyExpiredBookings();

    return successResponse({
      message: 'Escrow release cron completed',
      verifiedCount: result.verifiedCount,
      skippedCount: result.skippedCount,
      repairedCount: result.repairedCount,
      errorCount: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Cron execution failed',
      500,
    );
  }
}
