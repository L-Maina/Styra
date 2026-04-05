import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/brand-kit - Public endpoint to fetch brand kit for download
 */
export async function GET() {
  try {
    const kits = await db.brandKit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    // Also try to fetch press kit
    let pressKit: Record<string, unknown> | null = null;
    try {
      const pressKits = await db.pressKit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      pressKit = pressKits[0] ? (pressKits[0] as unknown as Record<string, unknown>) : null;
    } catch {
      // Gracefully handle if pressKit table doesn't exist yet
    }

    return successResponse({
      brandKit: kits[0] || null,
      pressKit,
    });
  } catch {
    return successResponse({ brandKit: null, pressKit: null });
  }
}
