import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';

// GET blocked users for current user (AUTH REQUIRED)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const blockedUsers = await db.blockedUser.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Get details of blocked users in a single query
    const blockedIds = blockedUsers.map(b => b.blockedId);
    const userDetails = blockedIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: blockedIds } },
          select: { id: true, name: true, avatar: true, email: true },
        })
      : [];
    const userMap = new Map(userDetails.map(u => [u.id, u]));

    const blockedUserDetails = blockedUsers.map(block => ({
      ...block,
      blockedUser: userMap.get(block.blockedId) || null,
    }));

    return successResponse({ blockedUsers: blockedUserDetails });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST to block a user (AUTH REQUIRED - can only block for self)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { blockedId, reason } = body;

    if (!blockedId) {
      return errorResponse('Blocked user ID is required', 400);
    }

    if (blockedId === user.id) {
      return errorResponse('You cannot block yourself', 400);
    }

    const blockedUser = await db.blockedUser.create({
      data: {
        userId: user.id,
        blockedId,
        reason: reason?.substring(0, 500) || null,
      },
    });

    return successResponse({
      message: 'User blocked successfully',
      blockedUser,
    });
  } catch (error) {
    // Handle unique constraint violation (already blocked)
    if (error instanceof Error && error.message.includes('Unique')) {
      return errorResponse('User is already blocked', 409);
    }
    return handleApiError(error);
  }
}

// DELETE to unblock a user (AUTH REQUIRED - can only unblock for self)
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { blockedId } = body;

    if (!blockedId) {
      return errorResponse('Blocked user ID is required', 400);
    }

    await db.blockedUser.delete({
      where: {
        userId_blockedId: { userId: user.id, blockedId },
      },
    });

    return successResponse({
      message: 'User unblocked successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
