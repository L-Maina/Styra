import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/payments/check-mpesa
 *
 * Polls the current status of an M-Pesa payment.
 * M-Pesa payment status is updated asynchronously via the webhook callback
 * (STK Push result is sent to /api/webhooks/mpesa). This endpoint allows
 * the frontend to poll for status updates without waiting for a webhook.
 *
 * Body: { paymentId: string }
 *
 * Returns the current payment status, which can be:
 *   - PROCESSING — STK Push sent, awaiting customer PIN confirmation
 *   - COMPLETED  — Payment confirmed via webhook
 *   - FAILED     — Payment failed (customer cancelled, insufficient funds, etc.)
 *   - PENDING    — Initial state (should transition to PROCESSING quickly)
 */
const checkMpesaSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = checkMpesaSchema.parse(body);

    // Find the payment
    const payment = await db.payment.findUnique({
      where: { id: validated.paymentId },
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

    // Verify ownership (admin can check any payment)
    if (payment.userId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('This payment does not belong to you', 403);
    }

    // Verify it's an M-Pesa payment
    if (payment.paymentMethod !== 'MPESA') {
      return errorResponse('This is not an M-Pesa payment', 400);
    }

    // Parse metadata for additional M-Pesa details
    let metadata: Record<string, unknown> = {};
    try {
      metadata = payment.metadata ? JSON.parse(payment.metadata) as Record<string, unknown> : {};
    } catch {
      // Ignore parse errors
    }

    return successResponse({
      paymentId: payment.id,
      status: payment.status,
      transactionId: payment.transactionId,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      checkoutRequestID: metadata.checkoutRequestID || null,
      merchantRequestID: metadata.merchantRequestID || null,
      mpesaReceiptNumber: metadata.receipt || null,
      resultCode: metadata.resultCode || null,
      resultDesc: metadata.resultDesc || null,
      isDevMode: metadata.devMode === true,
      booking: payment.booking
        ? {
            id: payment.booking.id,
            status: payment.booking.status,
            date: payment.booking.date,
            startTime: payment.booking.startTime,
            businessName: payment.booking.business?.name || null,
            serviceName: payment.booking.service?.name || null,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
