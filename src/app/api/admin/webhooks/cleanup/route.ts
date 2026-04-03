/**
 * Automated Webhook Cleanup Script
 * 
 * Runs pruneOldEvents() via the admin API.
 * Designed for cron scheduling (e.g. daily at 3 AM).
 * 
 * Usage:
 *   curl -s -X POST http://localhost:3000/api/admin/webhooks/cleanup \
 *     -H "Authorization: Bearer <admin-token>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"processedDays": 90, "failedDays": 7}'
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { pruneOldEvents } from '@/lib/webhook-store';

/**
 * POST /api/admin/webhooks/cleanup
 * 
 * Manually trigger webhook event cleanup.
 * Protected by requireAdmin().
 * 
 * Body (optional):
 *   processedDays: number (default 90) — Days to keep processed events
 *   failedDays: number (default 7) — Days to keep failed/invalid events
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    let processedDays = 90;
    let failedDays = 7;

    // Parse optional body for custom retention periods
    try {
      const body = await request.json();
      if (body.processedDays && typeof body.processedDays === 'number') {
        processedDays = Math.max(1, Math.min(365, Math.round(body.processedDays)));
      }
      if (body.failedDays && typeof body.failedDays === 'number') {
        failedDays = Math.max(1, Math.min(30, Math.round(body.failedDays)));
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    const deletedCount = await pruneOldEvents(processedDays, failedDays);

    return successResponse({
      cleanupRan: true,
      deletedCount,
      retentionPolicy: {
        processedEventsDays: processedDays,
        failedEventsDays: failedDays,
      },
      runBy: admin.email,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/admin/webhooks/cleanup
 * 
 * Get current cleanup statistics and last run info.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    // Count events that would be deleted with default policy
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const failedCutoffDate = new Date();
    failedCutoffDate.setDate(failedCutoffDate.getDate() - 7);

    const [oldProcessedCount, oldFailedCount, total, oldestEvent] = await Promise.all([
      db.webhookEvent.count({
        where: {
          createdAt: { lt: cutoffDate },
          status: { notIn: ['FAILED', 'INVALID_SIGNATURE'] },
        },
      }),
      db.webhookEvent.count({
        where: {
          status: { in: ['FAILED', 'INVALID_SIGNATURE'] },
          createdAt: { lt: failedCutoffDate },
        },
      }),
      db.webhookEvent.count(),
      db.webhookEvent.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, id: true },
      }),
    ]);

    return successResponse({
      wouldDelete: {
        processed: oldProcessedCount,
        failed: oldFailedCount,
        total: oldProcessedCount + oldFailedCount,
      },
      currentTotal: total,
      oldestEvent: oldestEvent?.createdAt || null,
      defaultPolicy: {
        processedDays: 90,
        failedDays: 7,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
