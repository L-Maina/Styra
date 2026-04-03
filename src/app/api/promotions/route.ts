import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// ============================================
// PROMOTIONS API
// Handles: Premium listings, featured providers, advertising
// SECURITY: POST/PATCH require authentication + business ownership.
// GET for featured/packages is public (marketing data).
// ============================================

// GET /api/promotions - Fetch promotions data
// SECURITY: Some types are public (featured, packages) for marketing,
// but business-sensitive types (listings, active, expired, business) require auth.
const PUBLIC_PROMOTION_TYPES = new Set(['featured', 'packages']);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'listings';
    const businessId = searchParams.get('businessId');
    const promotionType = searchParams.get('promotionType');

    // Require authentication for business-sensitive promotion types
    if (!PUBLIC_PROMOTION_TYPES.has(type)) {
      await requireAuth();
    }

    switch (type) {
      case 'listings':
        return await getPromotionListings(promotionType);
      case 'active':
        return await getActivePromotions(businessId);
      case 'expired':
        return await getExpiredPromotions();
      case 'business':
        return await getBusinessPromotions(businessId);
      case 'featured':
        return await getFeaturedProviders();
      case 'packages':
        return await getPromotionPackages();
      default:
        return await getPromotionListings(promotionType);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/promotions - Purchase a promotion (AUTH REQUIRED)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { 
      businessId, 
      promotionType, 
      duration, 
      price,
      boostLevel,
      section,
      channels,
      targetAudience,
      paymentMethod,
    } = body;

    // Validate required fields
    if (!businessId || !promotionType || !duration || !price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SECURITY: Verify user owns the business being promoted
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, name: true },
    });
    if (!business || (business.ownerId !== user.id && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'You can only create promotions for your own business' },
        { status: 403 }
      );
    }

    const promotion = await db.promotion.create({
      data: {
        businessId,
        businessName: business?.name || 'Unknown',
        type: (promotionType as any),
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + (duration || 30) * 24 * 60 * 60 * 1000),
        price: price || 0,
        boostLevel: promotionType === 'PROMOTED' ? (boostLevel || 3) : null,
        section: promotionType === 'FEATURED' ? (section || 'HOMEPAGE') : null,
        channels: promotionType === 'MARKETING_BOOST' ? (channels ? JSON.stringify(channels) : '[["EMAIL"]]') : null,
        targetAudience: promotionType === 'MARKETING_BOOST' ? (targetAudience ? JSON.stringify(targetAudience) : null) : null,
        autoRenew: false,
        analytics: JSON.stringify({ views: 0, clicks: 0, bookings: 0, revenue: 0 }),
      },
    });

    return NextResponse.json({
      success: true,
      promotion,
      message: 'Promotion purchased successfully',
      transactionId: promotion.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/promotions - Update promotion (AUTH REQUIRED + OWNERSHIP CHECK)
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { promotionId, action, data } = body;

    if (!promotionId || !action) {
      return errorResponse('Promotion ID and action are required', 400);
    }

    // SECURITY: Verify user owns the business linked to the promotion
    const promotion = await db.promotion.findUnique({
      where: { id: promotionId },
      select: { businessId: true },
    });
    if (!promotion) {
      return errorResponse('Promotion not found', 404);
    }
    const business = await db.business.findUnique({
      where: { id: promotion.businessId },
      select: { ownerId: true },
    });
    if (!business || (business.ownerId !== user.id && user.role !== 'ADMIN')) {
      return errorResponse('You can only modify your own promotions', 403);
    }

    switch (action) {
      case 'cancel':
        return await cancelPromotion(promotionId);
      case 'renew':
        return await renewPromotion(promotionId, data);
      case 'update':
        return await updatePromotion(promotionId, data);
      case 'toggle-auto-renew':
        return await toggleAutoRenew(promotionId);
      default:
        return errorResponse('Invalid action', 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getPromotionListings(promotionType: string | null) {
  try {
    const where: any = {};
    if (promotionType) where.type = promotionType as any;

    const promotions = await db.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const listings = promotions.map(p => {
      let analytics = { views: 0, clicks: 0, bookings: 0, revenue: 0 };
      try { analytics = p.analytics ? JSON.parse(p.analytics) : analytics; } catch {}

      const daysRemaining = Math.max(0, Math.ceil(
        (new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ));

      return {
        id: p.id,
        businessId: p.businessId,
        businessName: p.businessName,
        type: p.type,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        price: p.price,
        section: p.section,
        boostLevel: p.boostLevel,
        channels: p.channels ? (() => { try { return JSON.parse(p.channels); } catch { return null; } })() : null,
        analytics,
        daysRemaining,
      };
    });

    return NextResponse.json({ success: true, data: listings, total: listings.length });
  } catch (error) {
    return errorResponse('Failed to fetch promotion listings', 500);
  }
}

async function getActivePromotions(businessId: string | null) {
  try {
    const where: any = { status: 'ACTIVE' };
    if (businessId) where.businessId = businessId;

    const promotions = await db.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const result = promotions.map(p => {
      let analytics = { views: 0, clicks: 0, bookings: 0, revenue: 0 };
      try { analytics = p.analytics ? JSON.parse(p.analytics) : analytics; } catch {}

      const totalDays = Math.max(1, Math.ceil(
        (new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const daysRemaining = Math.max(0, Math.ceil(
        (new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ));
      const progress = Math.min(100, Math.round(((totalDays - daysRemaining) / totalDays) * 100));

      return {
        id: p.id,
        businessId: p.businessId,
        businessName: p.businessName,
        type: p.type,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        price: p.price,
        daysRemaining,
        progress,
        analytics,
      };
    });

    return NextResponse.json({ success: true, data: result, total: result.length });
  } catch (error) {
    return errorResponse('Failed to fetch active promotions', 500);
  }
}

async function getExpiredPromotions() {
  try {
    const promotions = await db.promotion.findMany({
      where: { status: 'EXPIRED' },
      orderBy: { endDate: 'desc' },
    });

    const result = promotions.map(p => {
      let analytics = { views: 0, clicks: 0, bookings: 0, revenue: 0 };
      try { analytics = p.analytics ? JSON.parse(p.analytics) : analytics; } catch {}

      return {
        id: p.id,
        businessId: p.businessId,
        businessName: p.businessName,
        type: p.type,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        price: p.price,
        analytics,
        canRenew: true,
      };
    });

    return NextResponse.json({ success: true, data: result, total: result.length });
  } catch (error) {
    return errorResponse('Failed to fetch expired promotions', 500);
  }
}

async function getBusinessPromotions(businessId: string | null) {
  if (!businessId) {
    return NextResponse.json(
      { error: 'Business ID is required' },
      { status: 400 }
    );
  }

  try {
    const [activePromotions, allPromotions] = await Promise.all([
      db.promotion.findMany({
        where: { businessId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
      db.promotion.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const historyPromotions = allPromotions.filter(p => p.status !== 'ACTIVE');
    const totalSpent = allPromotions.reduce((s, p) => s + p.price, 0);
    let totalRevenue = 0;
    for (const p of allPromotions) {
      try {
        const a = p.analytics ? JSON.parse(p.analytics) : null;
        if (a?.revenue) totalRevenue += a.revenue;
      } catch {}
    }
    const currentROI = totalSpent > 0 ? Math.round((totalRevenue / totalSpent) * 100) / 100 : 0;

    const parsePromo = (p: any) => {
      let analytics = { views: 0, clicks: 0, bookings: 0, revenue: 0 };
      try { analytics = p.analytics ? JSON.parse(p.analytics) : analytics; } catch {}
      const daysRemaining = Math.max(0, Math.ceil(
        (new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ));
      return {
        id: p.id, type: p.type, status: p.status,
        startDate: p.startDate, endDate: p.endDate, price: p.price,
        daysRemaining, analytics,
      };
    };

    const businessPromotions = {
      businessId,
      active: activePromotions.map(parsePromo),
      history: historyPromotions.map(parsePromo),
      totalSpent,
      currentROI,
      availablePackages: getAvailablePackages(),
    };

    return NextResponse.json({ success: true, data: businessPromotions });
  } catch (error) {
    return errorResponse('Failed to fetch business promotions', 500);
  }
}

async function getFeaturedProviders() {
  try {
    // Get businesses with active promotions (FEATURED or PROMOTED)
    const activePromotions = await db.promotion.findMany({
      where: { status: 'ACTIVE', type: { in: ['FEATURED', 'PROMOTED'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (activePromotions.length === 0) {
      return NextResponse.json({ success: true, data: [], total: 0 });
    }

    const businessIds = activePromotions.map(p => p.businessId);
    const businesses = await db.business.findMany({
      where: { id: { in: businessIds }, isActive: true },
      select: {
        id: true, name: true, logo: true, coverImage: true,
        rating: true, reviewCount: true,
        services: { select: { category: true }, take: 1 },
      },
    });
    const bizMap = new Map(businesses.map(b => [b.id, b]));
    const promoMap = new Map(activePromotions.map(p => [p.businessId, p]));

    const featured = businesses
      .map(b => {
        const promo = promoMap.get(b.id);
        if (!promo) return null;
        return {
          businessId: b.id,
          businessName: b.name,
          category: b.services[0]?.category || '',
          rating: b.rating,
          reviewCount: b.reviewCount,
          image: b.logo || b.coverImage || null,
          promotedUntil: promo.endDate,
          badge: promo.type,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data: featured, total: featured.length });
  } catch (error) {
    return errorResponse('Failed to fetch featured providers', 500);
  }
}

async function getPromotionPackages() {
  const packages = [
    {
      id: 'PROMOTED',
      name: 'Promoted Listing',
      price: 29.99,
      duration: 30,
      description: 'Boost your visibility in search results',
      features: [
        'Up to 5x search ranking boost',
        'Priority placement in category',
        'Promoted badge on profile',
        'Basic analytics dashboard',
        'Target specific categories',
      ],
      icon: 'TrendingUp',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'FEATURED',
      name: 'Featured Spot',
      price: 59.99,
      duration: 30,
      description: 'Premium homepage and category spotlight',
      features: [
        'Homepage spotlight rotation',
        'Top 3 in category listings',
        'Featured badge with glow effect',
        'Advanced analytics & insights',
        'Unlimited category targeting',
        'Priority customer support',
      ],
      icon: 'Crown',
      gradient: 'from-amber-500 to-orange-500',
      popular: true,
    },
    {
      id: 'MARKETING_BOOST',
      name: 'Marketing Boost',
      price: 99.99,
      duration: 7,
      description: 'Multi-channel marketing campaign',
      features: [
        'Email blast to local customers',
        'Social media promotion',
        'Push notification campaign',
        'Detailed campaign analytics',
        'Audience targeting options',
        'A/B testing included',
      ],
      icon: 'Rocket',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return NextResponse.json({
    success: true,
    data: packages,
  });
}

async function cancelPromotion(promotionId: string) {
  try {
    await db.promotion.update({
      where: { id: promotionId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Promotion cancelled successfully',
      promotionId,
      refundedAmount: 0,
      cancelledAt: new Date(),
    });
  } catch (error) {
    return errorResponse('Failed to cancel promotion', 500);
  }
}

async function renewPromotion(promotionId: string, data: any) {
  try {
    const { duration } = data || {};
    const newEndDate = new Date(Date.now() + (duration || 30) * 24 * 60 * 60 * 1000);

    await db.promotion.update({
      where: { id: promotionId },
      data: { endDate: newEndDate, status: 'ACTIVE' },
    });

    return NextResponse.json({
      success: true,
      message: 'Promotion renewed successfully',
      promotionId,
      newEndDate,
      renewedAt: new Date(),
    });
  } catch (error) {
    return errorResponse('Failed to renew promotion', 500);
  }
}

async function updatePromotion(promotionId: string, data: any) {
  try {
    const updateData: any = { updatedAt: new Date() };
    if (data?.boostLevel !== undefined) updateData.boostLevel = data.boostLevel;
    if (data?.section !== undefined) updateData.section = data.section;
    if (data?.channels !== undefined) updateData.channels = JSON.stringify(data.channels);
    if (data?.targetAudience !== undefined) updateData.targetAudience = JSON.stringify(data.targetAudience);

    await db.promotion.update({
      where: { id: promotionId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Promotion updated successfully',
      promotionId,
      updatedAt: updateData.updatedAt,
      changes: data,
    });
  } catch (error) {
    return errorResponse('Failed to update promotion', 500);
  }
}

async function toggleAutoRenew(promotionId: string) {
  try {
    // Get current state then toggle
    const current = await db.promotion.findUnique({
      where: { id: promotionId },
      select: { autoRenew: true },
    });

    const newAutoRenew = !(current?.autoRenew ?? false);
    await db.promotion.update({
      where: { id: promotionId },
      data: { autoRenew: newAutoRenew },
    });

    return NextResponse.json({
      success: true,
      message: 'Auto-renew toggled',
      promotionId,
      autoRenew: newAutoRenew,
      updatedAt: new Date(),
    });
  } catch (error) {
    return errorResponse('Failed to toggle auto-renew', 500);
  }
}

function getFeaturesForType(type: string) {
  const features: Record<string, { name: string; description: string; included: boolean }[]> = {
    PROMOTED: [
      { name: 'Search Boost', description: 'Up to 5x ranking boost', included: true },
      { name: 'Promoted Badge', description: 'Promoted badge on profile', included: true },
      { name: 'Basic Analytics', description: 'View basic performance metrics', included: true },
      { name: 'Category Targeting', description: 'Target up to 3 categories', included: true },
    ],
    FEATURED: [
      { name: 'Homepage Spotlight', description: 'Rotation on homepage', included: true },
      { name: 'Top 3 Placement', description: 'Top 3 in category listings', included: true },
      { name: 'Featured Badge', description: 'Premium featured badge', included: true },
      { name: 'Advanced Analytics', description: 'Detailed performance insights', included: true },
      { name: 'Priority Support', description: '24/7 priority support', included: true },
    ],
    MARKETING_BOOST: [
      { name: 'Email Campaign', description: 'Email blast to local customers', included: true },
      { name: 'Social Promotion', description: 'Social media promotion', included: true },
      { name: 'Push Notifications', description: 'Mobile push notifications', included: true },
      { name: 'Campaign Analytics', description: 'Detailed campaign metrics', included: true },
      { name: 'A/B Testing', description: 'Test different creatives', included: true },
    ],
  };
  
  return features[type] || features.PROMOTED;
}

function getAvailablePackages() {
  return [
    { id: 'weekly', name: 'Weekly', duration: 7, discount: 0 },
    { id: 'monthly', name: 'Monthly', duration: 30, discount: 10 },
    { id: 'quarterly', name: 'Quarterly', duration: 90, discount: 20 },
  ];
}
