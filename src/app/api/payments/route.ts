import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { createPaymentIntentSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizePaymentsForList } from '@/lib/response-sanitizer';
import { env, isDev } from '@/lib/env';

// List payments
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const where: Record<string, unknown> = { userId: user.userId };

    // Admin can see all payments
    if (user.role === 'admin') {
      delete where.userId;
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            business: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse(sanitizePaymentsForList(payments as unknown as Record<string, unknown>[]));
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    return handleApiError(error);
  }
}

// Create Payment Intent
export async function POST(request: NextRequest) {
  try {
    // Block admin from creating payments
    const user = await blockRole('admin');
    const body = await request.json();
    const validated = createPaymentIntentSchema.parse(body);

    // Check email verification before allowing payment
    const fullUser = await db.user.findUnique({
      where: { id: user.userId },
      select: { isVerified: true },
    });
    if (!fullUser?.isVerified && user.role !== 'admin') {
      return errorResponse('Please verify your email first', 403);
    }

    // Idempotency: check if a payment already exists for this booking
    const existingPayment = await db.payment.findFirst({
      where: { bookingId: validated.bookingId },
    });
    if (existingPayment) {
      return successResponse({
        clientSecret: existingPayment.transactionRef || '',
        paymentId: existingPayment.id,
        devMode: 'false',
      });
    }

    // Use transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      // Verify booking exists and belongs to user
      const booking = await tx.booking.findUnique({
        where: { id: validated.bookingId },
        include: { payments: true },
      });

      if (!booking) {
        throw new Error('BOOKING_NOT_FOUND');
      }

      if (booking.customerId !== user.userId) {
        throw new Error('NOT_OWNER');
      }

      if (booking.payments.length > 0) {
        throw new Error('PAYMENT_EXISTS');
      }

      // Verify payment amount matches booking total
      const amount = booking.totalPrice;

      // Create payment record with pending status
      const payment = await tx.payment.create({
        data: {
          bookingId: validated.bookingId,
          userId: user.userId,
          amount: amount,
          method: validated.paymentMethod.toLowerCase(),
          status: 'pending',
          transactionRef: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        },
      });

      // Set booking to pending (confirmed after webhook)
      await tx.booking.update({
        where: { id: validated.bookingId },
        data: { status: 'pending' },
      });

      return { payment, amount, booking };
    });

    // Handle payment method — dev mode fallback since external APIs may not be configured
    let responseData: Record<string, string> = {};

    const paymentMethod = validated.paymentMethod.toLowerCase();

    if (env.features.devPaymentFallback || isDev()) {
      // Dev mode: simulate payment processing
      const devTransactionRef = `${paymentMethod}_dev_${Date.now()}`;

      await db.payment.update({
        where: { id: result.payment.id },
        data: {
          transactionRef: devTransactionRef,
          status: 'completed',
        },
      });

      // Auto-complete in dev mode
      await db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: validated.bookingId },
          data: { status: 'confirmed' },
        });
        await tx.notification.create({
          data: {
            userId: user.userId,
            title: 'Payment Successful (Dev Mode)',
            message: `Payment of KES ${result.amount} completed in dev mode`,
            type: 'payment',
          },
        });
      });

      responseData = {
        clientSecret: `${devTransactionRef}_secret_dev`,
        paymentId: result.payment.id,
        paymentMethod: paymentMethod,
        devMode: 'true',
      };
    } else {
      // Production mode: external payment providers would be called here
      // For now, mark as processing — webhook would complete it
      responseData = {
        clientSecret: result.payment.transactionRef,
        paymentId: result.payment.id,
        paymentMethod: paymentMethod,
      };
    }

    return successResponse(responseData, 201);
  } catch (error) {
    if (error instanceof Response) return error as unknown as ReturnType<typeof errorResponse>;
    if (error instanceof Error) {
      switch (error.message) {
        case 'BOOKING_NOT_FOUND':
          return errorResponse('Booking not found', 404);
        case 'NOT_OWNER':
          return errorResponse('This booking does not belong to you', 403);
        case 'PAYMENT_EXISTS':
          return errorResponse('Payment already exists for this booking', 409);
      }
    }
    return handleApiError(error);
  }
}
