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
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'pending') {
      where.verificationStatus = 'PENDING';
    } else if (statusLower === 'approved') {
      where.verificationStatus = { in: ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'] };
    } else if (statusLower === 'rejected') {
      where.verificationStatus = 'REJECTED';
    }
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
            select: { id: true, name: true, email: true, phone: true },
          },
          _count: {
            select: { services: true, bookings: true, reviews: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.business.count({ where }),
    ]);

    // Use actual verificationStatus from DB, fall back to isVerified-based mapping
    const mapped = businesses.map(b => ({
      ...b,
      verificationStatus: b.verificationStatus || (b.isVerified ? 'APPROVED' : 'PENDING'),
      isActive: b.isActive,
      rating: b.rating,
      reviewCount: b.reviewCount,
      owner: b.owner ? {
        id: b.owner.id,
        name: b.owner.name,
        email: b.owner.email,
        phone: b.owner.phone,
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
