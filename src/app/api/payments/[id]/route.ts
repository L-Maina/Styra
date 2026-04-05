import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizePayment } from '@/lib/response-sanitizer';

/**
 * GET /api/payments/[id] — Get payment status
 * Auth required + ownership verification
 * Returns current payment status (useful for frontend polling)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            business: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!payment) {
      return errorResponse('Payment not found', 404);
    }

    // Ownership check: user must be the payment owner OR an admin
    if (payment.userId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('You do not have permission to view this payment', 403);
    }

    return successResponse(sanitizePayment({
      id: payment.id,
      bookingId: payment.bookingId,
      amount: payment.amount,
      currency: 'KES',
      paymentMethod: payment.method,
      status: payment.status,
      transactionId: payment.transactionRef,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      booking: payment.booking,
    }));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/payments/[id] — Update payment (admin only)
 * For manual payment confirmation in edge cases
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const { newStatus, adminNotes } = body as { newStatus?: string; adminNotes?: string };

    // Validate status transition
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const payment = await db.payment.findUnique({
      where: { id },
      include: { booking: true },
    });

    if (!payment) {
      return errorResponse('Payment not found', 404);
    }

    // Use transaction for atomic status update + booking sync + notification
    const updatedPayment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: newStatus as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED',
          description: JSON.stringify({
            adminUpdatedBy: admin.id,
            adminUpdatedByName: admin.name || admin.email,
            adminNotes: adminNotes || '',
            adminUpdatedAt: new Date().toISOString(),
          }),
        },
      });

      // Sync booking status with payment status
      if (newStatus === 'COMPLETED' && payment.booking) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CONFIRMED' },
        });

        await tx.notification.create({
          data: {
            userId: payment.userId,
            title: 'Payment Confirmed',
            message: `Your payment of KES ${payment.amount} has been manually confirmed by an administrator`,
            type: 'PAYMENT_SUCCESS',
          },
        });
      } else if (newStatus === 'REFUNDED' && payment.booking) {
        await tx.notification.create({
          data: {
            userId: payment.userId,
            title: 'Payment Refunded',
            message: `Your payment of KES ${payment.amount} has been refunded`,
            type: 'PAYMENT_FAILED',
          },
        });
      } else if (newStatus === 'FAILED' && payment.booking) {
        await tx.notification.create({
          data: {
            userId: payment.userId,
            title: 'Payment Failed',
            message: `Your payment of KES ${payment.amount} has been marked as failed`,
            type: 'PAYMENT_FAILED',
          },
        });
      }

      return updated;
    });

    return successResponse({
      id: updatedPayment.id,
      status: updatedPayment.status,
      updatedAt: updatedPayment.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
