import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';
import { parseSort } from '@/lib/query-optimization';
import { performAutoVerify } from '@/lib/auto-verify';

// Search/list businesses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const query = searchParams.get('query');
    const category = searchParams.get('category');
    const city = searchParams.get('city');
    const minRating = searchParams.get('minRating');
    const sort = parseSort(searchParams, ['rating', 'name', 'createdAt']);
    const resolvedSortField = Object.keys(sort)[0];
    const sortOrder = sort[resolvedSortField];
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = searchParams.get('radius');
    const ownerId = searchParams.get('ownerId');

    const where: Record<string, unknown> = {
      isActive: true,
    };

    // Filter by owner to allow users to fetch their own businesses
    // When filtering by owner, show all their businesses (including unapproved)
    // Otherwise, only show verified/approved businesses to the public
    if (ownerId) {
      where.ownerId = ownerId;
    } else {
      where.verificationStatus = { in: ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'] };
    }

    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (city) {
      where.city = { contains: city };
    }

    if (minRating) {
      where.rating = { gte: parseFloat(minRating) };
    }

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        skip,
        take: limit,
        include: {
          services: {
            where: { isActive: true },
            take: 5,
          },
          _count: {
            select: { reviews: true },
          },
        },
        orderBy: { [resolvedSortField]: sortOrder },
      }),
      db.business.count({ where }),
    ]);

    // Map _count.reviews to reviewCount for frontend compatibility
    const mappedBusinesses = businesses.map((b) => ({
      ...b,
      reviewCount: b._count.reviews,
      reviews: [],
    }));

    // Filter by distance if coordinates provided
    let filteredBusinesses = mappedBusinesses;
    if (lat && lng && radius) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      filteredBusinesses = mappedBusinesses
        .filter((b) => {
          if (!b.latitude || !b.longitude) return false;
          const distance = calculateDistance(userLat, userLng, b.latitude, b.longitude);
          (b as Record<string, unknown>)._distance = distance;
          return distance <= radiusKm;
        })
        .sort((a, b) => {
          const distA = (a as Record<string, unknown>)._distance as number;
          const distB = (b as Record<string, unknown>)._distance as number;
          return sortOrder === 'asc' ? distA - distB : distB - distA;
        });
    }

    return paginatedResponse(filteredBusinesses, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}

// Create new business
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    // Check if user already has a business
    const existingBusiness = await db.business.findFirst({
      where: { ownerId: session.userId },
    });

    if (existingBusiness) {
      return errorResponse('You already have a business registered', 409);
    }

    const business = await db.business.create({
      data: {
        ownerId: session.userId,
        name: body.name,
        description: body.description || null,
        category: body.category || 'general',
        phone: body.phone || null,
        email: body.email || null,
        website: body.website || null,
        address: body.address || null,
        city: body.city || null,
        country: body.country || null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        // ID verification fields
        idType: body.idType || null,
        idNumber: body.idNumber || null,
        idDocumentUrl: body.idDocumentUrl || null,
        boothPhotoUrl: body.boothPhotoUrl || null,
      },
      include: {
        services: true,
      },
    });

    // Notify the business owner that their application was received
    try {
      await db.notification.create({
        data: {
          userId: session.userId,
          title: 'Application Received',
          message: `Your business "${body.name}" has been submitted for review. You will be notified once it is approved.`,
          type: 'VERIFICATION_UPDATE',
          link: `/business/${business.id}`,
        },
      });
    } catch (notificationError) {
      console.error('Failed to create applicant notification:', notificationError);
    }

    // Notify all admin users about new business application
    try {
      const admins = await db.user.findMany({
        where: {
          role: 'ADMIN',
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await db.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            title: 'New Business Application',
            message: `${body.name} has submitted a new business application and is awaiting review.`,
            type: 'SYSTEM_ALERT',
            link: `/admin?tab=businesses`,
          })),
        });
      }
    } catch (notificationError) {
      console.error('Failed to create admin notifications:', notificationError);
      // Don't fail the business creation if notification fails
    }

    // Trigger auto-verification directly (no HTTP fetch — avoids CSRF & URL issues)
    let autoVerifyResult: Awaited<ReturnType<typeof performAutoVerify>> | null = null;
    try {
      autoVerifyResult = await performAutoVerify(business.id);
    } catch (autoVerifyError) {
      console.error('Failed to run auto-verification:', autoVerifyError);
      // Don't fail the business creation if auto-verify fails
    }

    // If auto-verified, refresh the business data to reflect updated status
    const responseBusiness = autoVerifyResult?.autoVerified
      ? await db.business.findUnique({
          where: { id: business.id },
          include: { services: true },
        })
      : business;

    return successResponse({
      ...responseBusiness,
      _autoVerify: autoVerifyResult
        ? {
            autoVerified: autoVerifyResult.autoVerified,
            verificationStatus: autoVerifyResult.verificationStatus,
            message: autoVerifyResult.message,
          }
        : undefined,
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}

// Helper function for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
