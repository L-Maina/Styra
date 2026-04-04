import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

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

    // Get users with their business info (single query)
    const users = await db.user.findMany({
      where,
      include: {
        businesses: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get all user IDs for batch queries (avoids N+1)
    const userIds = users.map(u => u.id);

    // Batch query: total spent per user (single aggregate with grouping)
    let paymentAggregates: { userId: string; total: number }[] = [];
    if (userIds.length > 0) {
      const payments = await db.payment.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      paymentAggregates = payments.map(p => ({
        userId: p.userId,
        total: p._sum.amount || 0,
      }));
    }
    const paymentMap = new Map(paymentAggregates.map(p => [p.userId, p.total]));

    // Batch query: banned users (single query)
    let banMap = new Map<string, any>();
    if (userIds.length > 0) {
      const bans = await db.userBan.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, type: true, isPermanent: true },
      });
      banMap = new Map(bans.map(b => [b.userId, b]));
    }

    // Combine everything without N+1
    const usersWithStats = users.map(user => {
      const ban = banMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isBanned: user.isBanned,
        status: ban ? (ban.isPermanent ? 'BANNED' : 'SUSPENDED') : 'ACTIVE',
        totalSpent: paymentMap.get(user.id) || 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        business: user.businesses && user.businesses.length > 0 ? {
          id: user.businesses[0].id,
          name: user.businesses[0].name,
          isVerified: user.businesses[0].isVerified,
        } : undefined,
      };
    });

    const total = await db.user.count({ where });

    return successResponse({
      users: usersWithStats,
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

      // Also set isBanned flag on user
      await db.user.update({
        where: { id: userId },
        data: { isBanned: true, banReason: reason || 'Admin action' },
      });
    } else if (action === 'activate') {
      await db.userBan.delete({
        where: { userId },
      }).catch(() => {
        // User might not have a ban record, ignore error
      });

      await db.user.update({
        where: { id: userId },
        data: { isBanned: false, banReason: null },
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
