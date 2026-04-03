import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { updateBookingSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeResponse } from '@/lib/response-sanitizer';

// Helper: check if user can view/manage a booking
async function canViewBooking(user: any, customerId: string, businessId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
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
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    // Status transition validation — only allowed transitions are permitted
    const VALID_TRANSITIONS: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      // completed, cancelled, disputed are terminal states
    };

    const currentStatus = booking.status.toLowerCase();
    const newStatus = validated.status.toLowerCase();
    if (VALID_TRANSITIONS[currentStatus] && !VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
      return errorResponse(`Cannot transition booking from ${booking.status} to ${validated.status}`, 400);
    }

    const updatedBooking = await db.booking.update({
      where: { id },
      data: {
        status: newStatus,
        ...(validated.notes ? { notes: validated.notes } : {}),
      },
    });

    // Create notification for relevant party
    const notifyUserId = user.userId === booking.customerId
      ? booking.business.ownerId
      : booking.customerId;

    await db.notification.create({
      data: {
        userId: notifyUserId,
        title: 'Booking Updated',
        message: `Booking status changed to ${newStatus}`,
        type: newStatus === 'cancelled' ? 'booking' : 'booking',
        link: `/bookings/${booking.id}`,
      },
    });

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

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        payments: { select: { id: true, status: true } },
        business: { select: { ownerId: true } },
      },
    });

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    const canView = await canViewBooking(user, booking.customerId, booking.businessId);
    if (!canView) {
      return errorResponse('You do not have permission to cancel this booking', 403);
    }

    // Prevent cancellation of already-completed bookings
    if (booking.status === 'completed' || booking.status === 'disputed') {
      return errorResponse('Cannot cancel a completed booking', 400);
    }

    // Prevent cancellation less than 24 hours before the appointment
    const bookingDate = new Date(`${booking.date}T${booking.time}`);
    const now = new Date();
    const hoursUntilAppointment = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilAppointment < 24 && user.role !== 'admin') {
      return errorResponse('Cannot cancel less than 24 hours before your appointment. Please contact support.', 400);
    }

    // If payment exists and is completed, mark it for refund
    const completedPayment = booking.payments.find((p: any) => p.status === 'completed');
    if (completedPayment) {
      await db.payment.update({
        where: { id: completedPayment.id },
        data: { status: 'refunded' },
      });
    }

    const updatedBooking = await db.booking.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    return successResponse({ message: 'Booking cancelled successfully', booking: updatedBooking });
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}
