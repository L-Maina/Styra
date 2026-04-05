import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const checkMpesaSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = checkMpesaSchema.parse(body);

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

    if (payment.userId !== user.id && user.role !== 'ADMIN') {
      return errorResponse('This payment does not belong to you', 403);
    }

    if (payment.method !== 'MPESA') {
      return errorResponse('This is not an M-Pesa payment', 400);
    }

    return successResponse({
      paymentId: payment.id,
      status: payment.status,
      transactionId: payment.transactionRef,
      amount: payment.amount,
      currency: 'KES',
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      booking: payment.booking
        ? {
            id: payment.booking.id,
            status: payment.booking.status,
            date: payment.booking.date,
            time: payment.booking.time,
            businessName: payment.booking.business?.name || null,
            serviceName: payment.booking.service?.name || null,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
