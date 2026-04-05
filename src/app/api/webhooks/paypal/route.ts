import crypto from 'crypto';
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
import { env } from '@/lib/env';

/**
 * PayPal webhook handler with DB-backed idempotency, replay attack prevention,
 * and automated failure alerting.
 *
 * SECURITY LAYERS:
 * 1. HMAC-SHA256 signature verification (timing-safe)
 * 2. Timestamp validation — rejects events older than 5 minutes (replay attack prevention)
 * 3. DB idempotency — unique constraint on (provider, eventId) survives restarts
 * 4. Forensic raw body storage — unparsed payload for legal evidence
 * 5. Automated alerts on signature failures, processing failures, payment failures
 *
 * PayPal retry behavior:
 * - Retries up to 15 times over 3 days
 * - 200 for success/duplicate/unhandled → no retry
 * - 500 for processing failures → triggers retry
 */

const PROVIDER: WebhookProvider = 'PAYPAL';

/** Max allowed age for a PayPal webhook event (seconds). Prevents replay attacks. */
const WEBHOOK_MAX_AGE_SECONDS = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const paypalTransmissionId = request.headers.get('paypal-transmission-id');
    const paypalTransmissionSig = request.headers.get('paypal-transmission-sig');
    const paypalAuthAlgo = request.headers.get('paypal-auth-algo');
    const paypalTransmissionTime = request.headers.get('paypal-transmission-time');

    const eventId = paypalTransmissionId || `unknown-${Date.now()}`;
    const body = await request.text();
    const clientIp = extractClientIp(request.headers);

    // Extract event type for logging
    let eventType = 'unknown';
    try {
      const parsed = JSON.parse(body);
      eventType = parsed.event_type || 'unknown';
    } catch {
      // Body isn't valid JSON — will fail below
    }

    // Step 1: Record the incoming event in DB (before any verification)
    // requestBody stores EXACT unparsed payload for forensic/legal evidence
    await recordReceivedEvent({
      provider: PROVIDER,
      providerEventId: eventId,
      eventType,
      requestBody: body,
      headers: request.headers,
      ipAddress: clientIp,
    });

    // Step 2: Validate required headers
    if (!paypalTransmissionId || !paypalTransmissionSig || !paypalAuthAlgo) {
      await markEventInvalidSignature(PROVIDER, eventId, 'Missing PayPal webhook headers');
      // 🔔 ALERT: Missing headers — potential spoofing
      alertWebhookSignatureFailed('PAYPAL', clientIp);
      return errorResponse('Missing PayPal webhook headers', 400);
    }

    const webhookSecret = env.paypal.webhookSecret;
    if (!webhookSecret) {
      alertWebhookProcessingFailed('PAYPAL', eventId, new Error('PAYPAL_WEBHOOK_SECRET not configured'));
      await markEventFailed(PROVIDER, eventId, 'PAYPAL_WEBHOOK_SECRET not configured', {
        processingTimeMs: Date.now() - startTime,
        responseCode: 500,
      });
      return errorResponse('Webhook verification not configured', 500);
    }

    // Step 3: Verify transmission signature using HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${paypalTransmissionId}|${body}`)
      .digest('base64');

    const sigBuffer = Buffer.from(paypalTransmissionSig);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      await markEventInvalidSignature(PROVIDER, eventId, 'HMAC-SHA256 signature mismatch');
      // 🔔 ALERT: Signature verification failed — potential spoofing
      alertWebhookSignatureFailed('PAYPAL', clientIp);
      return errorResponse('Invalid PayPal webhook signature', 401);
    }

    await markEventSignatureValid(PROVIDER, eventId);

    // Step 4: Timestamp validation — REPLAY ATTACK PREVENTION
    // PayPal sends paypal-transmission-time in ISO 8601 format (round to seconds)
    if (paypalTransmissionTime) {
      const transmissionTimestamp = Math.floor(new Date(paypalTransmissionTime).getTime() / 1000);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ageSeconds = nowSeconds - transmissionTimestamp;

      if (ageSeconds > WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(PROVIDER, eventId, `Replay attack: transmission age ${ageSeconds}s exceeds ${WEBHOOK_MAX_AGE_SECONDS}s tolerance`);
        alertWebhookSignatureFailed('PAYPAL', clientIp);
        return errorResponse(`Webhook too old (${Math.round(ageSeconds)}s). Possible replay attack.`, 401);
      }

      if (ageSeconds < -WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(PROVIDER, eventId, `Clock skew: transmission timestamp is ${Math.round(-ageSeconds)}s in the future`);
        return errorResponse('Webhook timestamp is in the future. Check server clock.', 401);
      }
    }

    // Step 5: Parse the verified event
    const event = JSON.parse(body);

    // Step 6: Idempotency check via DB
    const alreadyProcessed = await isEventAlreadyProcessed(PROVIDER, eventId);
    if (alreadyProcessed) {
      await markEventDuplicate(PROVIDER, eventId);
      return successResponse({ received: true, idempotent: true });
    }

    // Step 7: Process the event
    const result = await processPayPalEvent(event, eventId, clientIp);

    // Step 8: Record outcome
    const processingTimeMs = Date.now() - startTime;
    if (result.success) {
      await markEventProcessed(PROVIDER, eventId, {
        processingTimeMs,
        relatedPaymentId: result.paymentId,
        relatedBookingId: result.bookingId,
      });
    } else if (result.unhandled) {
      await markEventUnhandled(PROVIDER, eventId);
    }

    return successResponse(result.responseBody);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 🔔 ALERT: Webhook processing failed
    alertWebhookProcessingFailed('PAYPAL', 'unknown', error);

    console.error('[PayPal Webhook] Processing error:', errorMessage);

    // Return 500 so PayPal will retry
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', retry: true }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

interface PayPalWebhookResult {
  success: boolean;
  unhandled: boolean;
  responseBody: Record<string, unknown>;
  paymentId?: string;
  bookingId?: string;
}

async function processPayPalEvent(
  event: Record<string, unknown>,
  eventId: string,
  clientIp: string,
): Promise<PayPalWebhookResult> {
  const eventType = event.event_type as string;
  const resource = event.resource as Record<string, unknown>;

  if (!resource) {
    return { success: false, unhandled: true, responseBody: { received: true, status: 'no_resource' } };
  }

  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const transactionId = resource.id as string;
      return await handlePayPalCaptureCompleted(transactionId, eventId);
    }

    case 'PAYMENT.CAPTURE.DENIED': {
      const transactionId = resource.id as string;
      return await handlePayPalCaptureFailed(transactionId, eventId, 'PAYMENT.CAPTURE.DENIED');
    }

    case 'PAYMENT.CAPTURE.REFUNDED': {
      const transactionId = resource.id as string;
      return await handlePayPalCaptureRefunded(transactionId, eventId);
    }

    default:
      return { success: false, unhandled: true, responseBody: { received: true, event: eventType } };
  }
}

async function handlePayPalCaptureCompleted(
  transactionId: string,
  eventId: string
): Promise<PayPalWebhookResult> {
  const payment = await db.payment.findFirst({ where: { transactionRef: transactionId } });

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
          paypalEventId: eventId,
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
        message: 'Your PayPal payment was successful',
        type: 'PAYMENT_SUCCESS',
      },
    });
  });

  // Hold in escrow (fire-and-forget — non-blocking)
  try {
    const { holdInEscrow } = await import('@/lib/escrow');
    const { calculatePlatformFee } = await import('@/lib/escrow');
    const platformFee = await calculatePlatformFee(payment.amount);
    await holdInEscrow(payment.bookingId, payment.id, payment.amount, platformFee, 'KES');
  } catch (escrowError) {
    console.error('[PayPal Webhook] Escrow hold failed:', escrowError);
    // Don't fail the webhook — escrow can be retried
  }

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'PAYMENT.CAPTURE.COMPLETED' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}

async function handlePayPalCaptureFailed(
  transactionId: string,
  eventId: string,
  eventType: string
): Promise<PayPalWebhookResult> {
  const payment = await db.payment.findFirst({ where: { transactionRef: transactionId } });

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  if (payment.status === 'FAILED') {
    return { success: true, unhandled: false, responseBody: { received: true, idempotent: true } };
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        description: JSON.stringify({
          ...(payment.description ? JSON.parse(payment.description) : {}),
          paypalEventId: eventId,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Failed',
        message: 'Your PayPal payment was denied',
        type: 'PAYMENT_FAILED',
      },
    });
  });

  // 🔔 ALERT: Payment failure via webhook
  alertPaymentFailed(payment.id, payment.amount, `PayPal ${eventType}`, {
    currency: 'KES',
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'PAYPAL',
  });

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: eventType },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}

async function handlePayPalCaptureRefunded(
  transactionId: string,
  eventId: string
): Promise<PayPalWebhookResult> {
  const payment = await db.payment.findFirst({ where: { transactionRef: transactionId } });

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
          paypalEventId: eventId,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Refunded',
        message: 'Your PayPal payment has been refunded',
        type: 'PAYMENT_FAILED',
      },
    });
  });

  // 🔔 ALERT: Refund via webhook
  alertPaymentRefunded(payment.id, payment.amount, {
    currency: 'KES',
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'PAYPAL',
  });

  return {
    success: true, unhandled: false,
    responseBody: { received: true, processed: 'PAYMENT.CAPTURE.REFUNDED' },
    paymentId: payment.id, bookingId: payment.bookingId,
  };
}
