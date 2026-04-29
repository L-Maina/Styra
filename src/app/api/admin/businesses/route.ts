import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, handleApiError, parsePagination } from '@/lib/api-utils';

// List all businesses (admin view)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const status = searchParams.get('status');
    const query = searchParams.get('query');

    const where: Record<string, unknown> = {};
    // Business model uses isVerified (boolean), not verificationStatus
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'pending') where.isVerified = false;
    else if (statusLower === 'approved') where.isVerified = true;
    else if (statusLower === 'rejected') { where.isVerified = false; where.isActive = false; }
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

    // Map isVerified to verificationStatus for frontend compatibility
    const mapped = businesses.map(b => ({
      ...b,
      verificationStatus: b.isVerified ? 'APPROVED' : 'PENDING',
      isActive: b.isActive,
      rating: b.rating,
      reviewCount: b.reviewCount,
      owner: b.owner ? {
        id: b.owner.id,
        name: b.owner.name,
        email: b.owner.email,
      } : null,
      _count: b._count,
    }));

    return successResponse({
      data: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
