import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Admin: Fetch all FAQs (including unpublished)
export async function GET() {
  try {
    await requireAdmin();

    const faqs = await db.fAQ.findMany({
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
      ],
    });

    return successResponse({ faqs });
  } catch (error) {
    return handleApiError(error);
  }
}
