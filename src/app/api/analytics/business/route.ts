import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// ─── GET: Business-specific analytics ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = request.nextUrl;
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 },
      );
    }

    // Verify the authenticated user owns this business
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, name: true, slug: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 },
      );
    }

    if (business.ownerId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build date filter
    const whereDate: Record<string, Date> = {};
    if (startDate) whereDate.gte = new Date(startDate);
    if (endDate) whereDate.lte = new Date(endDate);

    const dateFilter = Object.keys(whereDate).length > 0
      ? { timestamp: whereDate }
      : {};

    // Page views for the business page
    const businessSlug = business.slug;
    const pageViews = await db.analyticsEvent.count({
      where: {
        ...dateFilter,
        event: 'page_view',
        page: { contains: businessSlug },
      },
    });

    // Booking-related events
    const bookingEvents = await db.analyticsEvent.groupBy({
      by: ['event'],
      where: {
        ...dateFilter,
        event: { startsWith: 'booking_' },
        page: { contains: businessSlug },
      },
      _count: { event: true },
    });

    // Revenue trend — booking_completed events with properties
    const revenueEvents = await db.analyticsEvent.findMany({
      where: {
        ...dateFilter,
        event: 'booking_completed',
        page: { contains: businessSlug },
      },
      select: { properties: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    // Parse amounts from properties for revenue trend
    const revenueTrend = revenueEvents.map((e) => {
      let amount = 0;
      try {
        const props = e.properties ? JSON.parse(e.properties) : {};
        amount = typeof props.amount === 'number' ? props.amount : 0;
      } catch {
        // ignore malformed JSON
      }
      return {
        date: e.timestamp.toISOString().split('T')[0],
        amount,
      };
    });

    // Popular services — from page_view with service in properties
    const serviceViews = await db.analyticsEvent.findMany({
      where: {
        ...dateFilter,
        event: 'page_view',
        page: { contains: businessSlug },
        properties: { contains: 'service' },
      },
      select: { properties: true },
      take: 200,
    });

    const serviceCounts: Record<string, number> = {};
    for (const ev of serviceViews) {
      try {
        const props = ev.properties ? JSON.parse(ev.properties) : {};
        if (props.service && typeof props.service === 'string') {
          serviceCounts[props.service] = (serviceCounts[props.service] || 0) + 1;
        }
      } catch {
        // ignore
      }
    }

    const popularServices = Object.entries(serviceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([service, views]) => ({ service, views }));

    // Engagement metrics
    const totalMessages = await db.analyticsEvent.count({
      where: {
        ...dateFilter,
        event: 'message_sent',
        page: { contains: businessSlug },
      },
    });

    const totalFavorites = await db.analyticsEvent.count({
      where: {
        ...dateFilter,
        event: 'favorite_added',
        page: { contains: businessSlug },
      },
    });

    const totalReviews = await db.analyticsEvent.count({
      where: {
        ...dateFilter,
        event: 'review_submitted',
        page: { contains: businessSlug },
      },
    });

    return NextResponse.json({
      businessId,
      businessName: business.name,
      pageViews,
      bookingEvents: bookingEvents.map((be) => ({
        event: be.event,
        count: be._count.event,
      })),
      revenueTrend,
      popularServices,
      engagementMetrics: {
        messages: totalMessages,
        favorites: totalFavorites,
        reviews: totalReviews,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 });
    }

    console.error('Business analytics error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
