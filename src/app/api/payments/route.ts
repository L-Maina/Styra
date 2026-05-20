import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { createPaymentIntentSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizePaymentsForList } from '@/lib/response-sanitizer';
import { env, isDev } from '@/lib/env';
import { holdInEscrow, calculatePlatformFee } from '@/lib/escrow';

// List payments
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const where: Record<string, unknown> = { userId: user.userId };

    // Admin can see all payments
    if (user.role === 'ADMIN') {
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

// ── Lazy Stripe singleton ────────────────────────────────────────────────────

let _stripe: typeof import('stripe').default | null = null;

async function getStripeClient() {
  if (_stripe) return _stripe;
  if (!env.stripe.secretKey) return null;
  try {
    const Stripe = (await import('stripe')).default;
    _stripe = new Stripe(env.stripe.secretKey, {
      apiVersion: '2023-10-16' as any,
    });
    return _stripe;
  } catch {
    console.error('[Payments] Failed to initialize Stripe client');
    return null;
  }
}

// ── Provider handlers ────────────────────────────────────────────────────────

/**
 * Create a Stripe PaymentIntent for card payments.
 * Returns clientSecret for the frontend to confirm payment.
 */
async function handleStripePayment(
  payment: { id: string; transactionRef: string },
  amount: number,
  currency: string,
  bookingId: string,
  userId: string,
): Promise<{ responseData: Record<string, string>; success: boolean }> {
  const stripe = await getStripeClient();
  if (!stripe) {
    return { responseData: {}, success: false };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: currency.toLowerCase() || 'kes',
      metadata: {
        bookingId,
        paymentId: payment.id,
        userId,
      },
      transfer_group: bookingId, // For Stripe Connect later
      automatic_payment_methods: { enabled: true },
    });

    // Save the client secret and provider ref
    await db.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: paymentIntent.id,
        description: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      },
    });

    return {
      responseData: {
        clientSecret: paymentIntent.client_secret || '',
        providerRef: paymentIntent.id,
        paymentId: payment.id,
        paymentMethod: 'stripe',
      },
      success: true,
    };
  } catch (err) {
    console.error('[Payments] Stripe PaymentIntent creation failed:', err instanceof Error ? err.message : err);
    return { responseData: {}, success: false };
  }
}

/**
 * Initiate M-Pesa STK Push for mobile payments.
 * Returns checkoutRequestID for polling status.
 */
async function handleMpesaPayment(
  payment: { id: string; transactionRef: string },
  amount: number,
  bookingId: string,
  customerPhone: string | null,
): Promise<{ responseData: Record<string, string>; success: boolean }> {
  if (!customerPhone) {
    console.error('[Payments] M-Pesa requires a customer phone number');
    return { responseData: {}, success: false };
  }

  try {
    const { initiateStkPush } = await import('@/lib/mpesa');

    const stkResult = await initiateStkPush(
      customerPhone,
      amount,
      bookingId,
      payment.id,
    );

    if (stkResult) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: stkResult.checkoutRequestID,
          description: JSON.stringify({
            merchantRequestID: stkResult.merchantRequestID,
            checkoutRequestID: stkResult.checkoutRequestID,
          }),
        },
      });

      return {
        responseData: {
          checkoutRequestID: stkResult.checkoutRequestID,
          merchantRequestID: stkResult.merchantRequestID,
          paymentId: payment.id,
          paymentMethod: 'mpesa',
        },
        success: true,
      };
    }

    return { responseData: {}, success: false };
  } catch (err) {
    console.error('[Payments] M-Pesa STK Push failed:', err instanceof Error ? err.message : err);
    return { responseData: {}, success: false };
  }
}

/**
 * Initialize a Paystack transaction for card/bank/mobile money payments.
 * Returns authorizationUrl for the frontend to redirect the user.
 */
async function handlePaystackPayment(
  payment: { id: string; transactionRef: string },
  amount: number,
  currency: string,
  bookingId: string,
  customerEmail: string,
): Promise<{ responseData: Record<string, string>; success: boolean }> {
  if (!env.paystack.secretKey) {
    return { responseData: {}, success: false };
  }

  try {
    const { getPaystackClient } = await import('@/lib/paystack');
    const paystackClient = getPaystackClient(env.paystack.secretKey);

    const result = await paystackClient.initializeTransaction({
      amount: Math.round(amount * 100), // Paystack uses kobo
      currency: currency || 'KES',
      reference: payment.transactionRef,
      email: customerEmail,
      metadata: { bookingId, paymentId: payment.id },
      callbackUrl: `${env.appUrl}/?page=booking&id=${bookingId}`,
    });

    await db.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: result.reference,
        description: JSON.stringify({
          authorizationUrl: result.authorizationUrl,
          accessCode: result.accessCode,
        }),
      },
    });

    return {
      responseData: {
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference,
        paymentId: payment.id,
        paymentMethod: 'paystack',
      },
      success: true,
    };
  } catch (err) {
    console.error('[Payments] Paystack transaction initialization failed:', err instanceof Error ? err.message : err);
    return { responseData: {}, success: false };
  }
}

/**
 * Create a PayPal order with CAPTURE intent.
 * Returns orderId and approveUrl for the frontend to redirect the user.
 */
async function handlePaypalPayment(
  payment: { id: string; transactionRef: string },
  amount: number,
  currency: string,
  bookingId: string,
): Promise<{ responseData: Record<string, string>; success: boolean }> {
  try {
    const { createPayPalOrder } = await import('@/lib/paypal');

    const result = await createPayPalOrder(
      amount,
      currency || 'USD',
      bookingId,
      payment.id,
    );

    if (result) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: result.orderId,
          description: JSON.stringify({
            orderId: result.orderId,
            approveUrl: result.approveUrl,
          }),
        },
      });

      return {
        responseData: {
          orderId: result.orderId,
          approveUrl: result.approveUrl,
          paymentId: payment.id,
          paymentMethod: 'paypal',
        },
        success: true,
      };
    }

    return { responseData: {}, success: false };
  } catch (err) {
    console.error('[Payments] PayPal order creation failed:', err instanceof Error ? err.message : err);
    return { responseData: {}, success: false };
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
      select: { isVerified: true, phone: true, email: true },
    });
    if (!fullUser?.isVerified && user.role !== 'ADMIN') {
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

      return {
        payment,
        amount,
        booking,
        customerPhone: booking.customerPhone || fullUser?.phone || null,
        customerEmail: booking.customerEmail || fullUser?.email || user.email,
      };
    });

    // Handle payment method — attempt real provider API, fall back to dev mode
    let responseData: Record<string, string> = {};
    const paymentMethod = validated.paymentMethod.toLowerCase();
    const currency = validated.currency || 'KES';

    // Try the real provider API first
    let providerSuccess = false;

    if (!env.features.devPaymentFallback || !isDev()) {
      // Production / non-dev mode: call real payment provider APIs
      switch (paymentMethod) {
        case 'stripe': {
          const result_stripe = await handleStripePayment(
            result.payment,
            result.amount,
            currency,
            validated.bookingId,
            user.userId,
          );
          if (result_stripe.success) {
            responseData = result_stripe.responseData;
            providerSuccess = true;
          }
          break;
        }

        case 'mpesa': {
          const result_mpesa = await handleMpesaPayment(
            result.payment,
            result.amount,
            validated.bookingId,
            result.customerPhone,
          );
          if (result_mpesa.success) {
            responseData = result_mpesa.responseData;
            providerSuccess = true;
          }
          break;
        }

        case 'paystack': {
          const result_paystack = await handlePaystackPayment(
            result.payment,
            result.amount,
            currency,
            validated.bookingId,
            result.customerEmail,
          );
          if (result_paystack.success) {
            responseData = result_paystack.responseData;
            providerSuccess = true;
          }
          break;
        }

        case 'paypal': {
          const result_paypal = await handlePaypalPayment(
            result.payment,
            result.amount,
            currency,
            validated.bookingId,
          );
          if (result_paypal.success) {
            responseData = result_paypal.responseData;
            providerSuccess = true;
          }
          break;
        }
      }
    }

    // If provider call succeeded, return the provider-specific response
    if (providerSuccess) {
      return successResponse(responseData, 201);
    }

    // Provider not configured or call failed — fall back to dev mode
    // The payment record still exists with status "pending" (can be retried)
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

      // Hold payment in escrow after successful payment (fire-and-forget)
      try {
        const platformFee = await calculatePlatformFee(result.amount);
        await holdInEscrow(
          validated.bookingId,
          result.payment.id,
          result.amount,
          platformFee,
          validated.currency || 'KES'
        );
      } catch (escrowError) {
        // Escrow failure should not block the payment flow
        if (process.env.NODE_ENV === 'development') {
          console.error('[Payments] Escrow hold failed (non-blocking):', escrowError);
        }
      }

      responseData = {
        clientSecret: `dev_only_not_a_real_secret_${Date.now()}`,
        paymentId: result.payment.id,
        paymentMethod: paymentMethod,
        devMode: 'true',
      };
    } else {
      // Production mode: provider call failed but no dev fallback
      // The payment is created with `pending` status — a webhook handler should:
      //   1. Confirm payment success and update payment.status to 'completed'
      //   2. Update booking status to 'confirmed'
      //   3. Call holdInEscrow() to place funds in escrow
      console.warn(
        `[Payments] Provider "${paymentMethod}" call failed for payment ${result.payment.id}. ` +
        'Payment record created with pending status — can be retried via webhook.'
      );
      responseData = {
        clientSecret: result.payment.transactionRef,
        paymentId: result.payment.id,
        paymentMethod: paymentMethod,
        providerFailed: 'true',
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
