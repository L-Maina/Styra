import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// ─── Zod schemas ────────────────────────────────────────────────────────

const analyticsEventSchema = z.object({
  event: z.string().min(1),
  properties: z.string().optional(),
  timestamp: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().min(1),
  device: z.string().optional(),
  page: z.string().optional(),
});

const batchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100),
});

// ─── POST: Batch event ingestion ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { events } = parsed.data;

    const records = events.map((e) => ({
      event: e.event,
      properties: e.properties ?? null,
      userId: e.userId ?? null,
      sessionId: e.sessionId,
      device: e.device ?? null,
      page: e.page ?? null,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    await db.analyticsEvent.createMany({ data: records });

    return NextResponse.json({ success: true, count: records.length });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── GET: Admin analytics data ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Admin gate
    const _user = await requireAdmin();

    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') ?? 'overview';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const whereDate: Record<string, Date> = {};
    if (startDate) whereDate.gte = new Date(startDate);
    if (endDate) whereDate.lte = new Date(endDate);

    const dateFilter = Object.keys(whereDate).length > 0
      ? { timestamp: whereDate }
      : {};

    switch (type) {
      case 'overview': {
        // Total events
        const totalEvents = await db.analyticsEvent.count({ where: dateFilter });

        // Unique users
        const uniqueUsersResult = await db.analyticsEvent.groupBy({
          by: ['userId'],
          where: { ...dateFilter, userId: { not: null } },
          _count: true,
        });

        // Page views count
        const pageViews = await db.analyticsEvent.count({
          where: { ...dateFilter, event: 'page_view' },
        });

        // Top pages (top 10)
        const topPages = await db.analyticsEvent.groupBy({
          by: ['page'],
          where: { ...dateFilter, event: 'page_view', page: { not: null } },
          _count: { page: true },
          orderBy: { _count: { page: 'desc' } },
          take: 10,
        });

        // Daily trend (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyTrend = await db.$queryRaw<
          Array<{ date: string; count: bigint }>
        >`
          SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
          FROM "AnalyticsEvent"
          WHERE "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `;

        return NextResponse.json({
          totalEvents,
          uniqueUsers: uniqueUsersResult.length,
          pageViews,
          topPages: topPages.map((tp) => ({
            page: tp.page,
            count: tp._count.page,
          })),
          dailyTrend: dailyTrend.map((d) => ({
            date: d.date,
            count: Number(d.count),
          })),
        });
      }

      case 'pages': {
        const pages = await db.analyticsEvent.groupBy({
          by: ['page'],
          where: { ...dateFilter, page: { not: null } },
          _count: { page: true },
          orderBy: { _count: { page: 'desc' } },
        });

        return NextResponse.json({
          pages: pages.map((p) => ({
            page: p.page,
            count: p._count.page,
          })),
        });
      }

      case 'events': {
        const events = await db.analyticsEvent.groupBy({
          by: ['event'],
          where: dateFilter,
          _count: { event: true },
          orderBy: { _count: { event: 'desc' } },
        });

        return NextResponse.json({
          events: events.map((e) => ({
            event: e.event,
            count: e._count.event,
          })),
        });
      }

      case 'users': {
        const users = await db.analyticsEvent.groupBy({
          by: ['userId'],
          where: { ...dateFilter, userId: { not: null } },
          _count: { userId: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 50,
        });

        return NextResponse.json({
          users: users.map((u) => ({
            userId: u.userId,
            eventCount: u._count.userId,
          })),
        });
      }

      case 'revenue': {
        const bookingEvents = await db.analyticsEvent.count({
          where: { ...dateFilter, event: { startsWith: 'booking_' } },
        });

        const paymentEvents = await db.analyticsEvent.count({
          where: { ...dateFilter, event: { startsWith: 'payment_' } },
        });

        const revenueByType = await db.analyticsEvent.groupBy({
          by: ['event'],
          where: {
            ...dateFilter,
            event: { startsWith: 'payment_' },
          },
          _count: { event: true },
        });

        return NextResponse.json({
          bookingEvents,
          paymentEvents,
          breakdown: revenueByType.map((r) => ({
            event: r.event,
            count: r._count.event,
          })),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown analytics type: ${type}` },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 });
    }

    console.error('Analytics GET error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
