import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { createBookingSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError, parsePagination, paginatedResponse } from '@/lib/api-utils';
import { parseSort } from '@/lib/query-optimization';
import { sanitizeResponse } from '@/lib/response-sanitizer';

// List bookings
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const status = searchParams.get('status');
    const businessId = searchParams.get('businessId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search');
    const sort = parseSort(searchParams, ['date', 'createdAt', 'status']);
    const resolvedSortField = Object.keys(sort)[0];
    const sortOrder = sort[resolvedSortField];

    const where: Record<string, unknown> = {};

    // Filter by user role
    if (session.role === 'CUSTOMER') {
      where.customerId = session.userId;
    } else if (session.role === 'BUSINESS_OWNER') {
      const business = await db.business.findFirst({
        where: { ownerId: session.userId },
        select: { id: true },
      });
      if (business) {
        where.businessId = business.id;
      }
    }
    // Admin sees all

    if (status) {
      where.status = status;
    }

    if (businessId) {
      where.businessId = businessId;
    }

    if (fromDate || toDate) {
      const dateFilter: Record<string, string> = {};
      if (fromDate) dateFilter.gte = fromDate;
      if (toDate) dateFilter.lte = toDate;
      where.date = dateFilter;
    }

    if (search) {
      where.OR = [
        { business: { name: { contains: search } } },
        { serviceName: { contains: search } },
      ];
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            select: { id: true, name: true, avatar: true, email: true, phone: true },
          },
          business: {
            select: { id: true, name: true, address: true },
          },
          service: {
            select: { id: true, name: true, price: true, duration: true },
          },
          staff: {
            select: { id: true, name: true, avatar: true },
          },
          payments: true,
          reviews: true,
        },
        orderBy: { [resolvedSortField]: sortOrder },
      }),
      db.booking.count({ where }),
    ]);

    return paginatedResponse(sanitizeResponse(bookings), page, limit, total);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    return handleApiError(error);
  }
}

// Create booking — uses DB transaction for atomicity
export async function POST(request: NextRequest) {
  try {
    // Block admin from creating bookings
    const session = await blockRole('admin');
    const body = await request.json();
    const validated = createBookingSchema.parse(body);

    // Check email verification before allowing booking
    const fullUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { isVerified: true },
    });
    if (!fullUser?.isVerified && session.role !== 'ADMIN') {
      return errorResponse('Please verify your email first', 403);
    }

    // Get service details for price and business validation
    const service = await db.service.findUnique({
      where: { id: validated.serviceId },
      include: { business: true },
    });

    if (!service) {
      return errorResponse('Service not found', 404);
    }

    // Verify businessId matches the service's business
    if (service.businessId !== validated.businessId) {
      return errorResponse('Service does not belong to the specified business', 400);
    }

    // Verify staffId belongs to this business (if provided)
    if (validated.staffId) {
      const staff = await db.staff.findUnique({
        where: { id: validated.staffId },
        select: { businessId: true },
      });
      if (!staff || staff.businessId !== validated.businessId) {
        return errorResponse('Selected staff member does not belong to this business', 400);
      }
    }

    // Use transaction to prevent double-booking race condition
    const booking = await db.$transaction(async (tx) => {
      // Prevent double-booking: check if another booking already exists
      // for the same service, date, and overlapping time
      const existingBooking = await tx.booking.findFirst({
        where: {
          serviceId: validated.serviceId,
          date: validated.date,
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          OR: [
            {
              time: { lt: validated.endTime },
              endTime: { gt: validated.startTime },
            },
          ],
        },
      });

      if (existingBooking) {
        throw new Error('TIME_SLOT_UNAVAILABLE');
      }

      const newBooking = await tx.booking.create({
        data: {
          customerId: session.userId,
          businessId: validated.businessId,
          serviceId: validated.serviceId,
          staffId: validated.staffId || null,
          date: validated.date,
          time: validated.startTime,
          endTime: validated.endTime || null,
          notes: validated.notes || null,
          totalPrice: service.price,
          status: 'pending',
        },
        include: {
          business: true,
          service: true,
        },
      });

      // Create notification for business owner
      await tx.notification.create({
        data: {
          userId: service.business.ownerId,
          title: 'New Booking',
          message: `New booking request for ${service.name}`,
          type: 'booking',
          link: `/business/${service.business.id}/bookings`,
        },
      });

      return newBooking;
    });

    return successResponse(sanitizeResponse(booking), 201);
  } catch (error) {
    if (error instanceof Response) return error as NextResponse;
    if (error instanceof Error && error.message === 'TIME_SLOT_UNAVAILABLE') {
      return errorResponse(
        'This time slot is no longer available. Please choose a different time.',
        409
      );
    }
    return handleApiError(error);
  }
}
