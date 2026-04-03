import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { updateBusinessStatusSchema } from '@/lib/validations';
import { successResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';

// List all businesses (admin view)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const status = searchParams.get('status');
    const query = searchParams.get('query');

    const where: Record<string, unknown> = {};
    if (status) where.verificationStatus = status;
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { city: { contains: query } },
      ];
    }

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { services: true, bookings: true, reviews: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.business.count({ where }),
    ]);

    return paginatedResponse(businesses, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}
