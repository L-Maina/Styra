import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Serves the cover image as a raw binary response with proper caching headers.
 * This is used by <img src="/api/businesses/{id}/cover-image"> for fast,
 * browser-cacheable image loading — much faster than the JSON + base64 approach.
 *
 * Benefits over /api/businesses/{id}/cover:
 * - ~33% smaller response (no base64 encoding overhead)
 * - Browser-native image caching with Cache-Control headers
 * - Progressive image rendering in <img> tags
 * - No JSON parsing overhead on the client
 * - Works with native browser lazy loading (loading="lazy")
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
      return new NextResponse('Not found', { status: 404 });
    }

    const imageDataUrl = business.coverImage || business.boothPhotoUrl;

    if (!imageDataUrl) {
      return new NextResponse('No image', { status: 404 });
    }

    // Parse the data URL: data:image/jpeg;base64,/9j/4AAQ...
    const match = imageDataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);

    if (!match) {
      // Not a valid data URL — return as-is (could be an external URL)
      // For external URLs, redirect the browser
      if (imageDataUrl.startsWith('http')) {
        return NextResponse.redirect(imageDataUrl);
      }
      return new NextResponse('Invalid image format', { status: 400 });
    }

    const contentType = match[1];
    const base64Data = match[2];

    // Decode base64 to binary buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Return binary response with aggressive caching (images rarely change)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Cover image serve error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
