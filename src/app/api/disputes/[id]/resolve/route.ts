import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { resolveDispute } from '@/lib/verification';
import { successResponse, handleApiError } from '@/lib/api-utils';

const resolveDisputeSchema = z.object({
  resolution: z
    .string()
    .min(10, 'Resolution description must be at least 10 characters')
    .max(2000, 'Resolution description must be less than 2000 characters'),
  action: z.enum(['RELEASE_TO_PROVIDER', 'FULL_REFUND', 'PARTIAL_REFUND'], {
    message: 'Action must be RELEASE_TO_PROVIDER, FULL_REFUND, or PARTIAL_REFUND',
  }),
});

/**
 * PATCH /api/disputes/[id]/resolve
 *
 * Admin resolves a dispute.
 * - Determines fund disposition (release to provider or refund to customer).
 * - Updates booking status accordingly.
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
    const { action } = resolveDisputeSchema.parse(body);

    // Resolve the dispute (validates dispute exists and status)
    const result = await resolveDispute(id, action, user.id);

    return successResponse({
      dispute: result.dispute,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
