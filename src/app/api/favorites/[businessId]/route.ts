import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

/** DELETE /api/favorites/:businessId: remove a saved business. Removing one that is not saved is fine. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await requireAuth();
    const { businessId } = await params;

    await db.favorite.deleteMany({ where: { userId: session.userId, businessId } });

    return successResponse({ businessId, isFavorite: false });
  } catch (error) {
    return handleApiError(error);
  }
}
