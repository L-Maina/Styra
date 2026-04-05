import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';

// GET /api/site-settings - Fetch site settings (PUBLIC)
// Returns key-value pairs; frontend picks what it needs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keys = searchParams.get('keys');

    const where: Record<string, unknown> = {};
    if (keys) {
      where.key = { in: keys.split(',').map((k) => k.trim()) };
    }

    const settings = await db.platformSetting.findMany({
      where,
      orderBy: { key: 'asc' },
    });

    // Convert array to object for easier frontend use
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    // Compute platform stats in a single parallel call
    let stats: Record<string, unknown> | null = null;
    try {
      const [providers, customers, businesses] = await Promise.all([
        db.user.count({ where: { role: 'business' } }),
        db.user.count({ where: { role: 'customer' } }),
        db.business.findMany({ select: { city: true }, distinct: ['city'] }),
      ]);

      // Get average rating from reviews
      const reviewStats = await db.review.aggregate({
        _avg: { rating: true },
        _count: true,
      });

      stats = {
        total_providers: providers,
        total_customers: customers,
        total_cities: businesses.length,
        avg_rating: reviewStats._avg.rating ?? 0,
        total_reviews: reviewStats._count as number,
      };
    } catch {
      // Stats are best-effort — don't fail the whole request
      stats = null;
    }

    return successResponse({
      settings: settingsMap,
      stats,
      raw: settings,
      total: settings.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
