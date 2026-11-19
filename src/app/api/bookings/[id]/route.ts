import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { updateBookingSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeResponse } from '@/lib/response-sanitizer';
import {
  BookingStatus,
  isStatus,
  normalizeStatus,
  statusLabel,
  statusVariants,
  type BookingStatusValue,
} from '@/lib/booking-status';
import { cancelBookingWithRefund, markBookingCompleted } from '@/lib/verification';

// Helper: check if user can view/manage a booking
async function canViewBooking(user: any, customerId: string, businessId: string): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (user.userId === customerId) return true;
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (business && business.ownerId === user.userId) return true;
  return false;
}

// Get booking by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, avatar: true, email: true, phone: true },
        },
        business: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            phone: true,
            email: true,
          },
        },
        service: true,
        staff: true,
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            transactionRef: true,
            createdAt: true,
          },
        },
        reviews: true,
      },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    const canView = await canViewBooking(user, booking.customerId, booking.businessId);
    if (!canView) {
      return errorResponse('You do not have permission to view this booking', 403);
    }

    return successResponse(sanitizeResponse(booking));
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}

// ── Status changes ──────────────────────────────────────────────────────────

/** Allowed status moves. Anything not listed (completed, verified, disputed, cancelled) is final here. */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

/** What each side may do. The customer can only cancel; the business runs the rest. */
const OWNER_TARGETS = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const CUSTOMER_TARGETS = ['CANCELLED'];

/** Cancelling is refused inside the last 24 hours before the appointment. */
function cancellationBlocked(date: string, time: string): boolean {
  const appointment = new Date(`${date}T${time}`);
  const hoursUntil = (appointment.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntil < 24;
}

const CANCEL_TOO_LATE = 'Cannot cancel less than 24 hours before your appointment. Please contact support.';

// Update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Block admin from modifying booking status
    const user = await blockRole('admin');
    const { id } = await params;
    const body = await request.json();
    const validated = updateBookingSchema.parse(body);

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, ownerId: true, name: true } },
      },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    // Only the two people on the booking can change it
    const isOwner = booking.business.ownerId === user.userId;
    const isCustomer = booking.customerId === user.userId;
    if (!isOwner && !isCustomer) {
      return errorResponse('You do not have permission to update this booking', 403);
    }

    const current = normalizeStatus(booking.status);
    const target = validated.status;

    // Asking for the status it already has (a double click) is not an error
    if (current === target) {
      return successResponse(sanitizeResponse(booking));
    }

    if (!TRANSITIONS[current]?.includes(target)) {
      return errorResponse(
        `Cannot transition booking from ${statusLabel(current)} to ${statusLabel(target)}`,
        400,
      );
    }

    if (!(isOwner ? OWNER_TARGETS : CUSTOMER_TARGETS).includes(target)) {
      return errorResponse('You do not have permission to make this change', 403);
    }

    let updatedBooking;

    if (target === 'COMPLETED') {
      // Starts the 24 hour verification window and notifies the customer
      updatedBooking = (await markBookingCompleted(id)).booking;
    } else if (target === 'CANCELLED') {
      if (cancellationBlocked(booking.date, booking.time)) {
        return errorResponse(CANCEL_TOO_LATE, 400);
      }
      // Cancels and reverses any payment held in escrow, in one transaction
      updatedBooking = (await cancelBookingWithRefund(id, validated.notes || 'Booking cancelled')).booking;
    } else {
      const claimed = await db.booking.updateMany({
        where: { id, status: { in: statusVariants(current as BookingStatusValue) } },
        data: {
          status: target,
          ...(validated.notes ? { notes: validated.notes } : {}),
        },
      });
      if (claimed.count !== 1) {
        return errorResponse('This booking was just updated. Please refresh and try again.', 409);
      }
      updatedBooking = await db.booking.findUnique({ where: { id } });
    }

    // Tell the other person (completion already notified the customer)
    if (target !== 'COMPLETED') {
      try {
        await db.notification.create({
          data: {
            userId: isCustomer ? booking.business.ownerId : booking.customerId,
            title: 'Booking Updated',
            message: `Booking status changed to ${statusLabel(target)}`,
            type: 'booking',
            link: `/bookings/${booking.id}`,
          },
        });
      } catch {
        // A failed notification must not fail a change that already happened
      }
    }

    return successResponse(sanitizeResponse(updatedBooking));
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}

// Cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Block admin from cancelling bookings
    const user = await blockRole('admin');
    const { id } = await params;

    const booking = await db.booking.findUnique({ where: { id } });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    const canView = await canViewBooking(user, booking.customerId, booking.businessId);
    if (!canView) {
      return errorResponse('You do not have permission to cancel this booking', 403);
    }

    if (isStatus(booking.status, BookingStatus.CANCELLED)) {
      return successResponse({ message: 'Booking already cancelled', booking });
    }

    // Completed, verified and disputed bookings go through confirmation or a dispute instead
    if (isStatus(booking.status, BookingStatus.COMPLETED, BookingStatus.VERIFIED, BookingStatus.DISPUTED)) {
      return errorResponse('Cannot cancel a completed booking', 400);
    }

    if (cancellationBlocked(booking.date, booking.time)) {
      return errorResponse(CANCEL_TOO_LATE, 400);
    }

    // Cancels and reverses any payment held in escrow, in one transaction
    const result = await cancelBookingWithRefund(id, 'Booking cancelled');

    return successResponse({
      message: 'Booking cancelled successfully',
      booking: result.booking,
      refundAmount: result.refundAmount,
    });
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}
