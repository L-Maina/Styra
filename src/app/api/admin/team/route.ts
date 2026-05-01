import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Admin: Fetch all team members (including inactive)
export async function GET() {
  try {
    await requireAdmin();

    const members = await db.teamMember.findMany({
      orderBy: { order: 'asc' },
    });

    return successResponse({ members });
  } catch (error) {
    return handleApiError(error);
  }
}
