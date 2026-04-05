import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { capturePayPalOrder } from '@/lib/paypal';
import { holdInEscrow, calculatePlatformFee } from '@/lib/escrow';

const capturePayPalSchema = z.object({
  orderId: z.string().min(1, 'PayPal order ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await blockRole('admin');
    const body = await request.json();
    const validated = capturePayPalSchema.parse(body);

    const payment = await db.payment.findFirst({
      where: {
        providerRef: validated.orderId,
        method: 'PAYPAL',
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

    if (payment.userId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('This payment does not belong to you', 403);
    }

    if (payment.status === 'COMPLETED') {
      return successResponse({
        paymentId: payment.id,
        status: payment.status,
        message: 'Payment already captured',
      });
    }

    const captureResult = await capturePayPalOrder(validated.orderId);

    if (!captureResult) {
      return errorResponse(
        'Failed to capture PayPal order. The payment may still be processing — check status later.',
        502,
      );
    }

    if (captureResult.status !== 'COMPLETED') {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          description: JSON.stringify({
            captureStatus: captureResult.status,
            captureId: captureResult.captureId,
            captureAttemptedAt: new Date().toISOString(),
          }),
        },
      });

      return errorResponse(
        `PayPal capture returned status: ${captureResult.status}`,
        400,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          providerRef: captureResult.captureId,
          description: JSON.stringify({
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

    try {
      const platformFee = await calculatePlatformFee(payment.amount);
      await holdInEscrow(payment.bookingId, payment.id, payment.amount, platformFee, 'KES');
    } catch (escrowError) {
      console.error('Escrow hold failed:', escrowError);
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

function safeJsonParse(str: string | null | undefined): Record<string, unknown> {
  if (!str) return {};
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}
