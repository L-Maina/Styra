import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/api-rbac';

/**
 * GET /api/admin/brand-kit - Get latest brand kit + press kit
 * POST /api/admin/brand-kit - Upload new brand kit or press kit
 * DELETE /api/admin/brand-kit - Delete brand kit or press kit
 */

// GET - Retrieve brand kit and press kit info
export async function GET() {
  try {
    let brandKit: any = null;
    let pressKit: any = null;

    // Try to fetch brand kit
    try {
      const kits = await db.brandKit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      brandKit = kits[0] || null;
    } catch {
      // Table might not exist yet
    }

    // Try to fetch press kit
    try {
      const kits = await db.pressKit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      pressKit = kits[0] || null;
    } catch {
      // Table might not exist yet
    }

    return successResponse({ brandKit, pressKit });
  } catch (error) {
    return successResponse({ brandKit: null, pressKit: null });
  }
}

// POST - Upload brand kit or press kit (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { name, fileUrl, fileSize, fileType, type } = body; // type: 'brand' or 'press'

    if (!fileUrl) {
      return errorResponse('File URL is required', 400);
    }

    if (type === 'press') {
      const kit = await db.pressKit.create({
        data: {
          name: name || 'Styra Press Kit',
          fileUrl,
          fileSize: fileSize || 0,
          fileType: fileType || 'application/zip',
          uploadedBy: 'admin',
        },
      });
      return successResponse({ pressKit: kit }, 201);
    }

    const kit = await db.brandKit.create({
      data: {
        name: name || 'Styra Brand Kit',
        fileUrl,
        fileSize: fileSize || 0,
        fileType: fileType || 'application/zip',
        uploadedBy: 'admin',
      },
    });

    return successResponse({ brandKit: kit }, 201);
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return handleApiError(error);
  }
}

// DELETE - Delete brand kit or press kit (admin only)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // 'brand' or 'press'

    if (!id) {
      return errorResponse('ID is required', 400);
    }

    if (type === 'press') {
      await db.pressKit.delete({ where: { id } });
      return successResponse({ message: 'Press kit deleted successfully' });
    }

    await db.brandKit.delete({ where: { id } });
    return successResponse({ message: 'Brand kit deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return handleApiError(error);
  }
}
