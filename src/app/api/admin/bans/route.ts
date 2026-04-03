import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch all banned/suspended users
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // appeal status
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    
    if (status && status !== 'all') {
      where.appealStatus = status;
    }

    const bans = await db.userBan.findMany({
      where,
      orderBy: { bannedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.userBan.count({ where });

    // Calculate stats
    const stats = {
      total: await db.userBan.count(),
      pendingAppeals: await db.userBan.count({ where: { appealStatus: 'PENDING' } }),
      permanentBans: await db.userBan.count({ where: { isPermanent: true } }),
      temporarySuspensions: await db.userBan.count({ where: { isPermanent: false } }),
    };

    return successResponse({
      bans,
      total,
      stats,
      hasMore: offset + bans.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update ban (handle appeal, unblock, etc.)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { banId, action, adminNotes, newEndDate } = body;

    if (!banId || !action) {
      return errorResponse('Ban ID and action are required', 400);
    }

    const ban = await db.userBan.findUnique({
      where: { id: banId },
    });

    if (!ban) {
      return errorResponse('Ban not found', 404);
    }

    if (action === 'unblock') {
      // Delete the ban record
      await db.userBan.delete({
        where: { id: banId },
      });

      return successResponse({ message: 'User unblocked successfully' });
    }

    const updateData: Record<string, unknown> = {};
    
    if (action === 'approveAppeal') {
      updateData.appealStatus = 'APPROVED';
      updateData.appealResolvedAt = new Date();
      // Also unblock
      await db.userBan.delete({
        where: { id: banId },
      });
      return successResponse({ message: 'Appeal approved and user unblocked' });
    }
    
    if (action === 'rejectAppeal') {
      updateData.appealStatus = 'REJECTED';
      updateData.appealResolvedAt = new Date();
    }
    
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }
    
    if (newEndDate) {
      updateData.endDate = new Date(newEndDate);
    }

    const updatedBan = await db.userBan.update({
      where: { id: banId },
      data: updateData,
    });

    return successResponse({ ban: updatedBan });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Submit an appeal
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userId, appealReason } = body;

    if (!userId || !appealReason) {
      return errorResponse('User ID and appeal reason are required', 400);
    }

    const ban = await db.userBan.findUnique({
      where: { userId },
    });

    if (!ban) {
      return errorResponse('No active ban found for this user', 404);
    }

    const updatedBan = await db.userBan.update({
      where: { userId },
      data: {
        appealStatus: 'PENDING',
        appealReason,
        appealDate: new Date(),
      },
    });

    return successResponse({ ban: updatedBan });
  } catch (error) {
    return handleApiError(error);
  }
}
