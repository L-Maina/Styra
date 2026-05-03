import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { successResponse, paginatedResponse, handleApiError } from '@/lib/api-utils';
import type { DisputeStatus } from './_types';

const VALID_STATUSES: DisputeStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

/**
 * GET /api/disputes?status=OPEN&bookingId=...&page=1&limit=20
 *
 * List disputes with optional filters.
 * - Admins see all disputes.
 * - Business owners see disputes for their businesses.
 * - Customers see only their own disputes.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    // Build where clause
    const where: Record<string, unknown> = {};

    // Status filter
    const statusParam = searchParams.get('status');
    if (statusParam && VALID_STATUSES.includes(statusParam as DisputeStatus)) {
      where.status = statusParam;
    }

    // Booking filter
    const bookingId = searchParams.get('bookingId');
    if (bookingId) {
      where.bookingId = bookingId;
    }

    // Role-based filtering
    if (user.role === 'ADMIN') {
      // Admins see everything — no additional filtering
    } else if (user.role === 'BUSINESS_OWNER') {
      // Business owners see disputes where they are the provider
      where.providerId = user.id;
    } else {
      // Customers see only their own disputes
      where.customerId = user.id;
    }

    const queryOptions: any = {
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        provider: { select: { id: true, name: true, email: true } },
        booking: {
          select: {
            id: true,
            date: true,
            totalPrice: true,
            status: true,
            serviceName: true,
            service: { select: { name: true } },
          },
        },
      },
    };
    const [disputes, total] = await Promise.all([
      db.dispute.findMany(queryOptions) as unknown as unknown[],
      db.dispute.count({ where: where as any }),
    ]);

    return paginatedResponse(disputes, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}
