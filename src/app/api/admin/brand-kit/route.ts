import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/api-rbac';

/**
 * GET /api/admin/brand-kit - Get latest brand kit
 * POST /api/admin/brand-kit - Upload new brand kit
 * DELETE /api/admin/brand-kit - Delete brand kit
 */

// GET - Retrieve brand kit info
export async function GET() {
  try {
    // @ts-expect-error brandKit table exists in DB but not in generated Prisma client
    const kits = await db.brandKit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (kits.length === 0) {
      return successResponse({ brandKit: null, message: 'No brand kit uploaded yet' });
    }

    return successResponse({ brandKit: kits[0] });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Upload brand kit (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { name, fileUrl, fileSize, fileType } = body;

    if (!fileUrl) {
      return errorResponse('File URL is required', 400);
    }

    // @ts-expect-error brandKit table exists in DB but not in generated Prisma client
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

// DELETE - Delete brand kit (admin only)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Brand kit ID is required', 400);
    }

    // @ts-expect-error brandKit table exists in DB but not in generated Prisma client
    await db.brandKit.delete({ where: { id } });
    return successResponse({ message: 'Brand kit deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return handleApiError(error);
  }
}
