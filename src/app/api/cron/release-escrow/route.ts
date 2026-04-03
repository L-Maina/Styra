import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { autoVerifyExpiredBookings } from '@/lib/verification';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { env } from '@/lib/env';

/**
 * GET /api/cron/release-escrow
 *
 * Cron endpoint for auto-releasing escrow funds.
 * Finds all COMPLETED bookings older than 24 hours that haven't been
 * verified by the customer, and auto-verifies them.
 *
 * Security: Requires CRON_SECRET header matching the environment variable.
 * This prevents unauthorized triggering of escrow releases.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = env.cronSecret || process.env.CRON_SECRET;

  if (!expectedSecret) {
    return errorResponse('CRON_SECRET not configured', 500);
  }

  if (
    !cronSecret ||
    !expectedSecret ||
    !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
  ) {
    return errorResponse('Invalid cron secret', 401);
  }

  try {
    const result = await autoVerifyExpiredBookings();

    return successResponse({
      message: 'Escrow release cron completed',
      verifiedCount: result.verifiedCount,
      skippedCount: result.skippedCount,
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
