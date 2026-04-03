import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPayoutSummary } from '@/lib/payout';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/payouts/summary
 *
 * Admin-only: returns aggregate payout statistics.
 */
export async function GET() {
  try {
    await requireAdmin();

    const summary = await getPayoutSummary();

    return successResponse(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
