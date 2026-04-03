import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { pruneOldEvents } from '@/lib/webhook-store';
import { env, isDev } from '@/lib/env';

/**
 * POST /api/cron/prune-webhooks
 *
 * Automated cleanup endpoint for old webhook events.
 * Designed to be called by a cron scheduler (e.g., Vercel Cron, GitHub Actions).
 *
 * Security: Requires X-Cron-Secret header matching CRON_SECRET env var.
 * In development mode, allows without secret for local testing.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate cron secret
    const cronSecret = request.headers.get('X-Cron-Secret');

    if (env.cronSecret) {
      // Secret is configured — require it
      if (
        !cronSecret ||
        !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(env.cronSecret))
      ) {
        return errorResponse('Invalid or missing cron secret', 401);
      }
    } else {
      // No secret configured — only allow in development
      if (!isDev()) {
        return errorResponse('CRON_SECRET environment variable is required in non-development environments', 403);
      }
    }

    // Parse optional query params for retention periods
    const url = request.nextUrl;
    const daysToKeep = parseInt(url.searchParams.get('daysToKeep') || '90', 10);
    const daysToKeepFailed = parseInt(url.searchParams.get('daysToKeepFailed') || '7', 10);

    // Validate params
    if (isNaN(daysToKeep) || daysToKeep < 1) {
      return errorResponse('daysToKeep must be a positive integer', 400);
    }
    if (isNaN(daysToKeepFailed) || daysToKeepFailed < 1) {
      return errorResponse('daysToKeepFailed must be a positive integer', 400);
    }

    const pruned = await pruneOldEvents(daysToKeep, daysToKeepFailed);

    return successResponse({
      success: true,
      pruned,
      retention: {
        normalDays: daysToKeep,
        failedDays: daysToKeepFailed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Webhook prune failed:', error instanceof Error ? error.message : String(error));
    return errorResponse('Webhook cleanup failed', 500);
  }
}

// Reject GET requests — this is a mutation, not a query
export async function GET() {
  return errorResponse('Use POST for webhook cleanup', 405);
}
