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

    return successResponse({
      settings: settingsMap,
      raw: settings,
      total: settings.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
