import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { resolveDispute, DISPUTE_RESOLUTIONS } from '@/lib/verification';
import { successResponse, handleApiError } from '@/lib/api-utils';

const resolveDisputeSchema = z.object({
  resolution: z
    .string()
    .min(10, 'Resolution description must be at least 10 characters')
    .max(2000, 'Resolution description must be less than 2000 characters'),
  action: z.enum(DISPUTE_RESOLUTIONS, {
    message: 'Action must be RELEASE_TO_PROVIDER, FULL_REFUND, or PARTIAL_REFUND',
  }),
  /** PARTIAL_REFUND only. Omit for a 50/50 split. */
  customerRefundAmount: z.number().positive().optional(),
});

/**
 * PATCH /api/disputes/[id]/resolve
 *
 * Admin resolves a dispute.
 * - Moves the money (release to provider, refund to customer, or split) and updates the
 *   booking status in one transaction.
 * - Stores the admin's written resolution with the dispute.
 * - Notifies both parties.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { action, resolution, customerRefundAmount } = resolveDisputeSchema.parse(body);

    const result = await resolveDispute(id, action, user.id, {
      notes: resolution,
      customerRefundAmount,
    });

    return successResponse({
      dispute: result.dispute,
      message: result.message,
      refundAmount: result.refundAmount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
