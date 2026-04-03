import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { triggerBulkPayouts } from '@/lib/payout';
import { successResponse, handleApiError } from '@/lib/api-utils';

const bulkTriggerSchema = z.object({
  bookingIds: z
    .array(z.string().min(1))
    .min(1, 'At least one booking ID is required')
    .max(50, 'Cannot trigger more than 50 payouts at once'),
});

/**
 * POST /api/payouts/bulk-trigger
 *
 * Admin-only: trigger payouts for multiple bookings at once.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { bookingIds } = bulkTriggerSchema.parse(body);

    const result = await triggerBulkPayouts(bookingIds, admin.id);

    return successResponse({
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      results: result.results,
      message: `Bulk payout complete: ${result.succeeded} succeeded, ${result.failed} failed`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
