import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { serviceName: { contains: search, mode: 'insensitive' } },
        { staffName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        include: {
          business: { select: { id: true, name: true, category: true } },
          customer: { select: { id: true, name: true, email: true } },
          service: { select: { id: true, name: true, price: true } },
          staff: { select: { id: true, name: true } },
          payments: { select: { id: true, amount: true, status: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.booking.count({ where }),
    ]);

    // Status counts
    const statusCounts = await db.booking.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusSummary = {
      pending: 0, confirmed: 0, completed: 0, cancelled: 0, disputed: 0,
    };
    for (const s of statusCounts) {
      const key = (s.status as string).toLowerCase();
      if (key in statusSummary) {
        (statusSummary as Record<string, number>)[key] = s._count;
      }
    }

    return NextResponse.json({
      bookings,
      total,
      hasMore: offset + bookings.length < total,
      statusSummary,
    });
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}
