import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-utils';
import {
  recordReceivedEvent,
  isEventAlreadyProcessed,
  markEventProcessed,
  markEventDuplicate,
  markEventFailed,
  markEventUnhandled,
  markEventInvalidSignature,
  markEventSignatureValid,
  extractClientIp,
  type WebhookProvider,
} from '@/lib/webhook-store';
import {
  alertWebhookProcessingFailed,
  alertWebhookSignatureFailed,
  alertPaymentFailed,
  alertPaymentRefunded,
} from '@/lib/payment-alerts';
import { env, isDev } from '@/lib/env';
import { holdInEscrow, calculatePlatformFee } from '@/lib/escrow';

const PROVIDER: WebhookProvider = 'STRIPE';

/** Max allowed age for a Stripe webhook event (seconds). Prevents replay attacks. */
const WEBHOOK_MAX_AGE_SECONDS = 300; // 5 minutes

let stripe: Stripe | null = null;
if (env.stripe.secretKey) {
  stripe = new Stripe(env.stripe.secretKey, {
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    const clientIp = extractClientIp(request.headers);

    // Step 0: Extract a provisional event ID from body for logging
    // (Can't fully parse until signature is verified)
    let event: Stripe.Event;
    let provisionalEventId = 'unknown';
    let provisionalEventType = 'unknown';
    try {
      const parsed = JSON.parse(body);
      provisionalEventId = parsed.id || 'unknown';
      provisionalEventType = parsed.type || 'unknown';
    } catch {
      // Body isn't valid JSON — will fail signature verification below
    }

    // Step 1: Record the incoming event in DB (before any verification)
    // This ensures we have a forensics record of EVERY webhook delivery attempt
    // The requestBody field stores the EXACT unparsed payload for legal evidence
    const recorded = await recordReceivedEvent({
      provider: PROVIDER,
      providerEventId: provisionalEventId,
      eventType: provisionalEventType,
      requestBody: body,
      headers: request.headers,
      ipAddress: clientIp,
    });

    // Step 2: Validate required headers
    if (!signature) {
      await markEventInvalidSignature(PROVIDER, provisionalEventId, 'Missing Stripe-Signature header');
      // 🔔 ALERT: Signature verification failed — potential spoofing
      alertWebhookSignatureFailed('STRIPE', clientIp);
      return errorResponse('Missing Stripe signature', 400);
    }

    if (!env.stripe.webhookSecret) {
      if (env.features.devPaymentFallback) {
        // Dev mode: parse body as JSON without verification
        event = JSON.parse(body) as Stripe.Event;
      } else {
        alertWebhookProcessingFailed('STRIPE', provisionalEventId, new Error('STRIPE_WEBHOOK_SECRET not configured'));
        await markEventFailed(PROVIDER, provisionalEventId, 'STRIPE_WEBHOOK_SECRET not configured', {
          processingTimeMs: Date.now() - startTime,
          responseCode: 500,
        });
        return errorResponse('Webhook not configured', 500);
      }
    } else {
      // STRICT MODE: Use official Stripe SDK for signature verification
      try {
        event = stripe!.webhooks.constructEvent(body, signature, env.stripe.webhookSecret);
        await markEventSignatureValid(PROVIDER, provisionalEventId);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await markEventInvalidSignature(PROVIDER, provisionalEventId, errorMessage);
        // 🔔 ALERT: Signature verification failed — potential spoofing
        alertWebhookSignatureFailed('STRIPE', clientIp);
        return errorResponse(`Webhook signature verification failed: ${errorMessage}`, 401);
      }
    }

    // Step 3: Timestamp validation — REPLAY ATTACK PREVENTION
    const eventCreated = (event as Stripe.Event).created;
    if (eventCreated && typeof eventCreated === 'number') {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ageSeconds = nowSeconds - eventCreated;

      if (ageSeconds > WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(PROVIDER, event.id, `Replay attack: event age ${ageSeconds}s exceeds ${WEBHOOK_MAX_AGE_SECONDS}s tolerance`);
        // 🔔 ALERT: Potential replay attack
        alertWebhookSignatureFailed('STRIPE', clientIp);
        return errorResponse(`Webhook event too old (${Math.round(ageSeconds)}s). Possible replay attack.`, 401);
      }

      // Also reject events from the future (clock skew > 5 min)
      if (ageSeconds < -WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(PROVIDER, event.id, `Clock skew: event timestamp is ${Math.round(-ageSeconds)}s in the future`);
        return errorResponse('Webhook event timestamp is in the future. Check server clock.', 401);
      }
    }

    // Step 4: Update with verified event ID/type in case provisional was wrong
    if (recorded && (event.id !== provisionalEventId || event.type !== provisionalEventType)) {
      await db.webhookEvent.update({
        where: { id: recorded.id },
        data: {
          providerEventId: event.id,
          eventType: event.type,
        },
      }).catch(() => { /* Non-critical */ });
    }

    // Step 5: Idempotency check via DB
    const alreadyProcessed = await isEventAlreadyProcessed(PROVIDER, event.id);
    if (alreadyProcessed) {
      await markEventDuplicate(PROVIDER, event.id);
      return successResponse({ received: true, idempotent: true });
    }

    // Step 6: Process the event
    const result = await handleWebhookEvent(event);

    // Step 7: Record outcome
    const processingTimeMs = Date.now() - startTime;
    if (result.success) {
      await markEventProcessed(PROVIDER, event.id, {
        processingTimeMs,
        relatedPaymentId: result.paymentId,
        relatedBookingId: result.bookingId,
      });
    } else if (result.unhandled) {
      await markEventUnhandled(PROVIDER, event.id);
    }

    return successResponse(result.responseBody);
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 🔔 ALERT: Webhook processing failed — provider will auto-retry
    alertWebhookProcessingFailed('STRIPE', 'unknown', error);

    // Log the error but return a generic message to Stripe
    // NEVER expose internal error details in webhook responses
    console.error('[Stripe Webhook] Processing error:', errorMessage);

    // Return 500 so Stripe will retry
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', retry: true }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

interface WebhookResult {
  success: boolean;
  unhandled: boolean;
  responseBody: Record<string, unknown>;
  paymentId?: string;
  bookingId?: string;
}

/**
 * Process a verified Stripe webhook event.
 */
async function handleWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return await handlePaymentSucceeded(paymentIntent, event.id);
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return await handlePaymentFailed(paymentIntent, event.id);
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      return await handleCheckoutCompleted(session, event.id);
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      return await handleChargeRefunded(charge, event.id);
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute;
      return await handleDisputeCreated(dispute, event.id);
    }

    default:
      return { success: false, unhandled: true, responseBody: { received: true, event: event.type } };
  }
}

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  eventId: string
): Promise<WebhookResult> {
  const payment = await db.payment.findFirst({
    where: { transactionRef: paymentIntent.id },
  });

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  if (payment.status === 'COMPLETED') {
    return { success: true, unhandled: false, responseBody: { received: true, idempotent: true } };
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        description: JSON.stringify({
          ...(payment.description ? JSON.parse(payment.description) : {}),
          stripeEventId: eventId,
          stripeChargeId: paymentIntent.latest_charge,
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
        title: 'Payment Successful',
        message: `Your payment of ${'KES'} ${payment.amount} was successful`,
        type: 'PAYMENT_SUCCESS',
      },
    });
  });

  // Hold payment in escrow after successful payment
  try {
    const platformFee = await calculatePlatformFee(payment.amount);
    await holdInEscrow(payment.bookingId, payment.id, payment.amount, platformFee, 'KES');
  } catch (escrowError) {
    console.error('Escrow hold failed:', escrowError);
    // Don't fail the webhook — escrow is async/secondary
  }

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'payment_intent.succeeded' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  eventId: string
): Promise<WebhookResult> {
  const payment = await db.payment.findFirst({
    where: { transactionRef: paymentIntent.id },
  });

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  if (payment.status === 'FAILED') {
    return { success: true, unhandled: false, responseBody: { received: true, idempotent: true } };
  }

  const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        description: JSON.stringify({
          ...(payment.description ? JSON.parse(payment.description) : {}),
          stripeEventId: eventId,
          failureMessage,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Failed',
        message: `Your payment of ${'KES'} ${payment.amount} failed: ${failureMessage}`,
        type: 'PAYMENT_FAILED',
      },
    });
  });

  // 🔔 ALERT: Payment failure via webhook
  alertPaymentFailed(payment.id, payment.amount, failureMessage, {
    currency: 'KES',
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'STRIPE',
  });

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'payment_intent.payment_failed' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId: string
): Promise<WebhookResult> {
  const metadata = session.metadata || {};

  if (!metadata.bookingId) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'no_booking_metadata' } };
  }

  const payment = await db.payment.findFirst({
    where: { bookingId: metadata.bookingId },
  });

  if (!payment || payment.status !== 'PENDING') {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'not_pending' } };
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        description: JSON.stringify({
          ...(payment.description ? JSON.parse(payment.description) : {}),
          stripeEventId: eventId,
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
        title: 'Payment Successful',
        message: `Your payment of ${'KES'} ${payment.amount} was successful`,
        type: 'PAYMENT_SUCCESS',
      },
    });
  });

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'checkout.session.completed' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  eventId: string
): Promise<WebhookResult> {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'no_payment_intent' } };
  }

  const payment = await db.payment.findFirst({
    where: { transactionRef: paymentIntentId },
  });

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  if (payment.status === 'REFUNDED') {
    return { success: true, unhandled: false, responseBody: { received: true, idempotent: true } };
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        description: JSON.stringify({
          ...(payment.description ? JSON.parse(payment.description) : {}),
          stripeEventId: eventId,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Refunded',
        message: `Your payment of ${'KES'} ${payment.amount} has been refunded`,
        type: 'PAYMENT_FAILED',
      },
    });
  });

  // 🔔 ALERT: Refund via webhook
  alertPaymentRefunded(payment.id, payment.amount, {
    currency: 'KES',
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'STRIPE',
  });

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'charge.refunded' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}

async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  eventId: string
): Promise<WebhookResult> {
  const chargeId = typeof dispute.charge === 'string'
    ? dispute.charge
    : dispute.charge?.id;

  if (!chargeId) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'no_charge' } };
  }

  const payment = await db.payment.findFirst({
    where: { description: { contains: chargeId } },
  });

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Dispute Filed',
        message: 'A dispute has been filed against your payment. Our team will review it.',
        type: 'SYSTEM_ALERT',
      },
    });
  });

  // 🔔 ALERT: Dispute — critical payment event
  alertPaymentFailed(payment.id, payment.amount, `Stripe dispute created: ${dispute.reason}`, {
    currency: 'KES',
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'STRIPE',
  });

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'charge.dispute.created' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}
