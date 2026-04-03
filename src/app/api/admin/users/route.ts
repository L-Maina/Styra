import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';
import { sanitizeUser, sanitizeUsers } from '@/lib/response-sanitizer';

// GET - Fetch all users with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    
    if (role && role !== 'all') {
      where.role = role;
    }

    // Get users with their business info
    const users = await db.user.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            name: true,
            verificationStatus: true,
            totalEarnings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Calculate total spent for customers
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const totalSpent = await db.payment.aggregate({
          where: {
            userId: user.id,
            status: 'COMPLETED',
          },
          _sum: { amount: true },
        });

        // Check if user is banned
        const ban = await db.userBan.findUnique({
          where: { userId: user.id },
        });

        return {
          ...sanitizeUser(user as unknown as Record<string, unknown>),
          totalSpent: totalSpent._sum.amount || 0,
          totalEarnings: user.business?.totalEarnings || 0,
          status: ban ? (ban.isPermanent ? 'BANNED' : 'SUSPENDED') : 'ACTIVE',
          roles: user.role === 'BUSINESS_OWNER' ? ['CUSTOMER', 'BUSINESS_OWNER'] : [user.role],
        };
      })
    );

    const total = await db.user.count({ where });

    return successResponse({
      users: sanitizeUsers(usersWithStats),
      total,
      hasMore: offset + users.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update user status (suspend/activate)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userId, action, reason, adminId, duration } = body;

    if (!userId || !action) {
      return errorResponse('User ID and action are required', 400);
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    if (action === 'suspend' || action === 'ban') {
      // Create or update ban record
      const endDate = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
      
      await db.userBan.upsert({
        where: { userId },
        create: {
          userId,
          userName: user.name || 'Unknown',
          userEmail: user.email,
          bannedBy: adminId,
          reason: reason || 'No reason provided',
          type: action === 'ban' ? 'BAN' : 'SUSPENSION',
          isPermanent: action === 'ban',
          endDate,
        },
        update: {
          bannedBy: adminId,
          reason: reason || 'No reason provided',
          type: action === 'ban' ? 'BAN' : 'SUSPENSION',
          isPermanent: action === 'ban',
          endDate,
          appealStatus: 'NONE',
        },
      });
    } else if (action === 'activate') {
      // Remove ban record
      await db.userBan.delete({
        where: { userId },
      }).catch(() => {
        // User might not have a ban record, ignore error
      });
    } else if (action === 'updateRole') {
      const { newRole } = body;
      if (!newRole) {
        return errorResponse('New role is required', 400);
      }
      
      await db.user.update({
        where: { id: userId },
        data: { role: newRole },
      });
    }

    return successResponse({ message: `User ${action} successful` });
  } catch (error) {
    return handleApiError(error);
  }
}
