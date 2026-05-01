import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch active team members ordered by order ASC (public). Use ?admin=true for all (requires admin).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminParam = searchParams.get('admin');

    // SECURITY: Require admin auth to query inactive members
    let includeInactive = false;
    if (adminParam === 'true') {
      await requireAdmin();
      includeInactive = true;
    }

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    const members = await db.teamMember.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    return successResponse({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create team member (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name, role, bio, image, order, isActive } = body;

    if (!name || !role) {
      return errorResponse('Name and role are required', 400);
    }

    const member = await db.teamMember.create({
      data: {
        name,
        role,
        bio: bio || null,
        image: image || null,
        order: order ?? 0,
        isActive: isActive ?? true,
      },
    });

    return successResponse({ member }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
