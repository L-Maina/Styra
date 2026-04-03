import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { retryFailedPayout } from '@/lib/payout';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/payouts/[id]/retry
 *
 * Admin-only: retry a failed payout.
 * Resets the payout status to PENDING and re-triggers the payout flow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    // Retry the failed payout (validates status internally)
    const result = await retryFailedPayout(id);

    return successResponse({
      payout: result.payout,
      message: result.message || 'Payout retry initiated',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
