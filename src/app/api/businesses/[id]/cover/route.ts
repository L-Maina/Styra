import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/api-utils';

/**
 * Lightweight endpoint that returns only the cover image for a business.
 * Used by BusinessCard for lazy-loading images without fetching the full
 * business detail (which includes services, reviews, portfolio, etc.).
 *
 * Returns: { success: true, data: { id, coverImage } }
 * coverImage is a base64 data URL or null.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      select: {
        id: true,
        coverImage: true,
        boothPhotoUrl: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: business.id,
        coverImage: business.coverImage || business.boothPhotoUrl || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
