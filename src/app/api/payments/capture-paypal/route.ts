import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { capturePayPalOrder } from '@/lib/paypal';
import { holdInEscrow, calculatePlatformFee } from '@/lib/escrow';

/**
 * POST /api/payments/capture-paypal
 *
 * Captures an approved PayPal order and updates the payment status.
 * Requires authentication — the user must own the payment.
 *
 * Body: { orderId: string }
 *
 * This endpoint provides a synchronous capture path. The PayPal webhook
 * (PAYMENT.CAPTURE.COMPLETED) will also fire and serves as the primary
 * confirmation mechanism. This endpoint acts as a backup for clients
 * that need an immediate response.
 */
const capturePayPalSchema = z.object({
  orderId: z.string().min(1, 'PayPal order ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Block admin from capturing payments
    const user = await blockRole('admin');
    const body = await request.json();
    const validated = capturePayPalSchema.parse(body);

    // Find the payment associated with this PayPal order
    const payment = await db.payment.findFirst({
      where: {
        transactionId: validated.orderId,
        paymentMethod: 'PAYPAL',
      },
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
      return errorResponse('Payment not found for this PayPal order', 404);
    }

    // Verify the user owns this payment (admin can capture any payment)
    if (payment.userId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('This payment does not belong to you', 403);
    }

    // Don't double-capture already completed payments
    if (payment.status === 'COMPLETED') {
      return successResponse({
        paymentId: payment.id,
        status: payment.status,
        message: 'Payment already captured',
      });
    }

    // Attempt real PayPal capture
    const captureResult = await capturePayPalOrder(validated.orderId);

    if (!captureResult) {
      return errorResponse(
        'Failed to capture PayPal order. The payment may still be processing — check status later.',
        502
      );
    }

    // Check capture status
    if (captureResult.status !== 'COMPLETED') {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: JSON.stringify({
            ...safeJsonParse(payment.metadata),
            captureStatus: captureResult.status,
            captureId: captureResult.captureId,
            captureAttemptedAt: new Date().toISOString(),
          }),
        },
      });

      return errorResponse(
        `PayPal capture returned status: ${captureResult.status}`,
        400
      );
    }

    // Success — update payment, booking, and create notification atomically
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          metadata: JSON.stringify({
            ...safeJsonParse(payment.metadata),
            captureId: captureResult.captureId,
            captureStatus: captureResult.status,
            captureAmount: captureResult.amount,
            captureCurrency: captureResult.currency,
            capturedAt: new Date().toISOString(),
          }),
        },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'CONFIRMED' },
      });

      await tx.notification.create({
        data: {
          userId: payment.userId,
          title: 'PayPal Payment Confirmed',
          message: `Your payment of ${captureResult.currency} ${captureResult.amount} has been confirmed. Booking reference: STY-${payment.bookingId.slice(0, 8)}`,
          type: 'PAYMENT_SUCCESS',
        },
      });
    });

    // Hold payment in escrow after successful PayPal capture
    try {
      const platformFee = await calculatePlatformFee(payment.amount);
      await holdInEscrow(payment.bookingId, payment.id, payment.amount, platformFee, payment.currency);
    } catch (escrowError) {
      console.error('Escrow hold failed:', escrowError);
      // Don't fail the capture — escrow is async/secondary
    }

    return successResponse({
      paymentId: payment.id,
      status: 'COMPLETED',
      captureId: captureResult.captureId,
      amount: captureResult.amount,
      currency: captureResult.currency,
      bookingId: payment.bookingId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Safely parse JSON string, returning empty object on failure.
 */
function safeJsonParse(str: string | null | undefined): Record<string, unknown> {
  if (!str) return {};
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}
