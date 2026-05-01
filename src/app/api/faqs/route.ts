import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';

// GET /api/faqs - Fetch published FAQs (PUBLIC)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = { isPublished: true };
    if (category && category !== 'all') {
      where.category = category;
    }

    const faqs = await db.fAQ.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    // Get distinct categories for filter tabs
    const categories = await db.fAQ.findMany({
      where: { isPublished: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    return successResponse({
      faqs,
      categories: categories.map((c) => c.category),
      total: faqs.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
