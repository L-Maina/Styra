import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { verifyWebhookSignature } from '@/lib/paystack';
import { PaystackClient } from '@/lib/paystack';
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
import { holdInEscrow, calculatePlatformFee } from '@/lib/escrow';
import { env, isDev } from '@/lib/env';

const PROVIDER: WebhookProvider = 'PAYSTACK';

/** Max allowed age for a Paystack webhook event (seconds). Prevents replay attacks. */
const WEBHOOK_MAX_AGE_SECONDS = 300; // 5 minutes

let paystack: PaystackClient | null = null;
if (env.paystack.secretKey) {
  paystack = new PaystackClient(env.paystack.secretKey);
}

// ── Paystack Event Body Types ──────────────────────────────────────────────

interface PaystackEventBody {
  event: string;
  data: PaystackEventData;
  created_at?: string;
}

interface PaystackEventData {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  channel: string;
  paid_at?: string;
  customer?: {
    email: string;
  };
  authorization?: {
    card_type?: string;
  };
  fees?: number;
  metadata?: {
    bookingId?: string;
    userId?: string;
    paymentId?: string;
    [key: string]: string | undefined;
  };
  /** Gateway response message */
  gateway_response?: string;
  /** Transfer-specific fields */
  recipient?: {
    recipient_code: string;
  };
  reason?: string;
  source?: {
    type?: string;
  };
  transfers?: Array<{
    recipient: string;
    amount: number;
  }>;
}

// ── Webhook Result ─────────────────────────────────────────────────────────

interface WebhookResult {
  success: boolean;
  unhandled: boolean;
  responseBody: Record<string, unknown>;
  paymentId?: string;
  bookingId?: string;
}

// ── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Step 0: Read raw body FIRST (required for HMAC-SHA512 verification).
    // Must be a raw string — NOT parsed JSON — for signature integrity.
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const clientIp = extractClientIp(request.headers);

    // Extract provisional event ID and type from body for logging
    // (Can't fully parse until signature is verified)
    let provisionalEventId = 'unknown';
    let provisionalEventType = 'unknown';
    let parsedBody: PaystackEventBody | null = null;
    try {
      const parsed = JSON.parse(body) as PaystackEventBody;
      provisionalEventId = String(parsed.data?.id ?? 'unknown');
      provisionalEventType = parsed.event || 'unknown';
    } catch {
      // Body isn't valid JSON — will fail signature verification below
    }

    // Step 1: Record the incoming event in DB (before any verification).
    // This ensures we have a forensics record of EVERY webhook delivery attempt.
    // The requestBody field stores the EXACT unparsed payload for legal evidence.
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
      await markEventInvalidSignature(PROVIDER, provisionalEventId, 'Missing x-paystack-signature header');
      // 🔔 ALERT: Signature verification failed — potential spoofing
      alertWebhookSignatureFailed('PAYSTACK', clientIp);
      return errorResponse('Missing Paystack signature', 400);
    }

    // Step 3: Signature verification
    if (!env.paystack.webhookSecret) {
      if (env.features.devPaymentFallback) {
        // Dev mode: parse body as JSON without verification
        parsedBody = JSON.parse(body) as PaystackEventBody;
      } else {
        alertWebhookProcessingFailed('PAYSTACK', provisionalEventId, new Error('PAYSTACK_WEBHOOK_SECRET not configured'));
        await markEventFailed(PROVIDER, provisionalEventId, 'PAYSTACK_WEBHOOK_SECRET not configured', {
          processingTimeMs: Date.now() - startTime,
          responseCode: 500,
        });
        return errorResponse('Webhook not configured', 500);
      }
    } else {
      // STRICT MODE: Verify HMAC-SHA512 signature
      if (!verifyWebhookSignature(body, signature, env.paystack.webhookSecret)) {
        await markEventInvalidSignature(PROVIDER, provisionalEventId, 'HMAC-SHA512 signature verification failed');
        // 🔔 ALERT: Signature verification failed — potential spoofing
        alertWebhookSignatureFailed('PAYSTACK', clientIp);
        return errorResponse('Webhook signature verification failed', 401);
      }
      await markEventSignatureValid(PROVIDER, provisionalEventId);
      // Parse body after successful verification
      parsedBody = JSON.parse(body) as PaystackEventBody;
    }

    // Step 4: Timestamp validation — REPLAY ATTACK PREVENTION
    // Paystack sends created_at as an ISO timestamp string
    const eventCreated = parsedBody.created_at;
    if (eventCreated) {
      const eventTime = new Date(eventCreated).getTime();
      const ageMs = Date.now() - eventTime;
      const ageSeconds = ageMs / 1000;

      if (ageSeconds > WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(
          PROVIDER,
          provisionalEventId,
          `Replay attack: event age ${Math.round(ageSeconds)}s exceeds ${WEBHOOK_MAX_AGE_SECONDS}s tolerance`,
        );
        // 🔔 ALERT: Potential replay attack
        alertWebhookSignatureFailed('PAYSTACK', clientIp);
        return errorResponse('Webhook event too old. Possible replay attack.', 401);
      }

      // Also reject events from the future (clock skew > 5 min)
      if (ageSeconds < -WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(
          PROVIDER,
          provisionalEventId,
          `Clock skew: event timestamp is ${Math.round(-ageSeconds)}s in the future`,
        );
        return errorResponse('Webhook event timestamp is in the future. Check server clock.', 401);
      }
    }

    // Step 5: Update with verified event ID/type in case provisional was wrong
    const eventId = String(parsedBody.data?.id ?? provisionalEventId);
    const eventType = parsedBody.event ?? provisionalEventType;

    if (recorded && (eventId !== provisionalEventId || eventType !== provisionalEventType)) {
      await db.webhookEvent.update({
        where: { id: recorded.id },
        data: {
          providerEventId: eventId,
          eventType,
        },
      }).catch(() => { /* Non-critical */ });
    }

    // Step 6: Idempotency check via DB
    const alreadyProcessed = await isEventAlreadyProcessed(PROVIDER, eventId);
    if (alreadyProcessed) {
      await markEventDuplicate(PROVIDER, eventId);
      return successResponse({ received: true, idempotent: true });
    }

    // Step 7: Process the event
    const result = await handleWebhookEvent(parsedBody);

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
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 🔔 ALERT: Webhook processing failed — provider will auto-retry
    alertWebhookProcessingFailed('PAYSTACK', 'unknown', error);

    // Log the error but return a generic message to Paystack
    // NEVER expose internal error details in webhook responses
    console.error('[Paystack Webhook] Processing error:', errorMessage);

    // Return 500 so Paystack will retry
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', retry: true }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ── Event Dispatcher ───────────────────────────────────────────────────────

/**
 * Process a verified Paystack webhook event.
 *
 * Paystack event types:
 *   charge.success    → Payment completed successfully
 *   charge.failed     → Payment attempt failed
 *   transfer.success  → Transfer (payout) completed
 *   transfer.failed   → Transfer (payout) failed
 *   All others        → Logged as unhandled
 */
async function handleWebhookEvent(eventBody: PaystackEventBody): Promise<WebhookResult> {
  const eventType = eventBody.event;
  const eventData = eventBody.data;

  switch (eventType) {
    case 'charge.success': {
      return await handleChargeSuccess(eventData, eventBody);
    }

    case 'charge.failed': {
      return await handleChargeFailed(eventData, eventBody);
    }

    case 'transfer.success': {
      return await handleTransferSuccess(eventData, eventBody);
    }

    case 'transfer.failed': {
      return await handleTransferFailed(eventData, eventBody);
    }

    default:
      return {
        success: false,
        unhandled: true,
        responseBody: { received: true, event: eventType },
      };
  }
}

// ── charge.success ─────────────────────────────────────────────────────────

/**
 * Handle charge.success — maps to Stripe payment_intent.succeeded.
 *
 * Marks payment COMPLETED, booking CONFIRMED, sends PAYMENT_SUCCESS notification.
 */
async function handleChargeSuccess(
  eventData: PaystackEventData,
  eventBody: PaystackEventBody,
): Promise<WebhookResult> {
  const eventId = String(eventData.id);
  const reference = eventData.reference;

  // Look up payment by Paystack reference (stored in transactionId)
  const payment = await db.payment.findFirst({
    where: { transactionId: reference },
  });

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  // Idempotent: skip if already completed
  if (payment.status === 'COMPLETED') {
    return { success: true, unhandled: false, responseBody: { received: true, idempotent: true } };
  }

  // Build enriched metadata
  const existingMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
  const updatedMetadata = {
    ...existingMetadata,
    paystackEventId: eventId,
    paystackReference: reference,
    paystackChannel: eventData.channel,
    paystackCardType: eventData.authorization?.card_type,
    paystackFees: eventData.fees,
    paystackPaidAt: eventData.paid_at,
    paystackCustomerEmail: eventData.customer?.email,
  };

  await db.$transaction(async (tx) => {
    // Mark payment as COMPLETED
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        metadata: JSON.stringify(updatedMetadata),
      },
    });

    // Confirm the associated booking
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'CONFIRMED' },
    });

    // Send payment success notification to the user
    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Successful',
        message: `Your payment of ${payment.currency} ${payment.amount} was successful`,
        type: 'PAYMENT_SUCCESS',
      },
    });
  });

  // ── Escrow: Hold funds after payment completed ──────────────────────────
  // Calculate platform fee and hold the payment in escrow.
  // The escrow library handles idempotency, so it's safe to call on retries.
  try {
    const platformFee = await calculatePlatformFee(payment.amount);
    await holdInEscrow(
      payment.bookingId,
      payment.id,
      payment.amount,
      platformFee,
    );
  } catch (escrowError) {
    // Escrow failure is non-critical — payment is still COMPLETED.
    // Log the error but don't fail the webhook response.
    console.error(
      '[Paystack Webhook] Escrow hold failed for payment',
      payment.id,
      ':',
      escrowError instanceof Error ? escrowError.message : 'unknown',
    );
  }

  return {
    success: true,
    unhandled: false,
    responseBody: { received: true, processed: 'charge.success' },
    paymentId: payment.id,
    bookingId: payment.bookingId,
  };
}

// ── charge.failed ──────────────────────────────────────────────────────────

/**
 * Handle charge.failed — maps to Stripe payment_intent.payment_failed.
 *
 * Marks payment FAILED, sends PAYMENT_FAILED notification, triggers alert.
 */
async function handleChargeFailed(
  eventData: PaystackEventData,
  eventBody: PaystackEventBody,
): Promise<WebhookResult> {
  const eventId = String(eventData.id);
  const reference = eventData.reference;

  // Try to find payment by reference first, then by metadata paymentId
  let payment = await db.payment.findFirst({
    where: { transactionId: reference },
  });

  // Fallback: look up by metadata paymentId if reference lookup fails
  if (!payment && eventData.metadata?.paymentId) {
    payment = await db.payment.findUnique({
      where: { id: eventData.metadata.paymentId },
    });
  }

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  // Idempotent: skip if already failed
  if (payment.status === 'FAILED') {
    return { success: true, unhandled: false, responseBody: { received: true, idempotent: true } };
  }

  const failureMessage = `Paystack charge failed (${eventData.gateway_response || eventData.status || 'unknown reason'})`;

  // Build enriched metadata
  const existingMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
  const updatedMetadata = {
    ...existingMetadata,
    paystackEventId: eventId,
    paystackReference: reference,
    paystackChannel: eventData.channel,
    failureMessage,
  };

  await db.$transaction(async (tx) => {
    // Mark payment as FAILED
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: JSON.stringify(updatedMetadata),
      },
    });

    // Send payment failure notification to the user
    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Failed',
        message: `Your payment of ${payment.currency} ${payment.amount} failed. Please try again.`,
        type: 'PAYMENT_FAILED',
      },
    });
  });

  // 🔔 ALERT: Payment failure via webhook
  alertPaymentFailed(payment.id, payment.amount, failureMessage, {
    currency: payment.currency,
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'PAYSTACK',
  });

  return {
    success: true,
    unhandled: false,
    responseBody: { received: true, processed: 'charge.failed' },
    paymentId: payment.id,
    bookingId: payment.bookingId,
  };
}

// ── transfer.success ───────────────────────────────────────────────────────

/**
 * Handle transfer.success — new Paystack-specific event (no Stripe equivalent).
 *
 * Logs successful transfer for record-keeping. Transfers are typically payouts
 * to business owners from the platform.
 */
async function handleTransferSuccess(
  eventData: PaystackEventData,
  eventBody: PaystackEventBody,
): Promise<WebhookResult> {
  const eventId = String(eventData.id);
  const reference = eventData.reference;

  // Try to find payment by reference (transfers may use the payment reference)
  let payment = await db.payment.findFirst({
    where: { transactionId: reference },
  });

  // Fallback: look up by metadata paymentId
  if (!payment && eventData.metadata?.paymentId) {
    payment = await db.payment.findUnique({
      where: { id: eventData.metadata.paymentId },
    });
  }

  if (payment) {
    // Build enriched metadata to record the transfer
    const existingMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
    const updatedMetadata = {
      ...existingMetadata,
      paystackTransferId: eventId,
      paystackTransferReference: reference,
      paystackTransferAmount: eventData.amount,
      paystackTransferRecipient: eventData.recipient?.recipient_code,
      paystackTransferReason: eventData.reason,
      paystackTransferPaidAt: eventData.paid_at,
    };

    await db.payment.update({
      where: { id: payment.id },
      data: {
        metadata: JSON.stringify(updatedMetadata),
      },
    }).catch(() => {
      // Non-critical: just logging the transfer reference on the payment
    });
  }

  return {
    success: true,
    unhandled: false,
    responseBody: { received: true, processed: 'transfer.success' },
    paymentId: payment?.id,
  };
}

// ── transfer.failed ────────────────────────────────────────────────────────

/**
 * Handle transfer.failed — maps to Stripe charge.dispute.created behavior.
 *
 * Marks payment as disputed (FAILED), sends SYSTEM_ALERT notification, triggers alert.
 * Transfer failures indicate payout issues that require attention.
 */
async function handleTransferFailed(
  eventData: PaystackEventData,
  eventBody: PaystackEventBody,
): Promise<WebhookResult> {
  const eventId = String(eventData.id);
  const reference = eventData.reference;

  // Try to find payment by reference first, then by metadata paymentId
  let payment = await db.payment.findFirst({
    where: { transactionId: reference },
  });

  // Fallback: look up by metadata paymentId
  if (!payment && eventData.metadata?.paymentId) {
    payment = await db.payment.findUnique({
      where: { id: eventData.metadata.paymentId },
    });
  }

  if (!payment) {
    return { success: true, unhandled: false, responseBody: { received: true, status: 'payment_not_found' } };
  }

  const failureReason = `Paystack transfer failed: ${eventData.reason || 'unknown reason'}`;

  // Build enriched metadata
  const existingMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
  const updatedMetadata = {
    ...existingMetadata,
    paystackTransferId: eventId,
    paystackTransferReference: reference,
    paystackTransferFailedAt: new Date().toISOString(),
    paystackTransferFailureReason: eventData.reason,
    transferStatus: 'FAILED',
  };

  await db.$transaction(async (tx) => {
    // Mark payment as FAILED (disputed)
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: JSON.stringify(updatedMetadata),
      },
    });

    // Send system alert notification to the user
    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: 'Payment Dispute Filed',
        message: 'A dispute has been filed against your payment. Our team will review it.',
        type: 'SYSTEM_ALERT',
      },
    });
  });

  // 🔔 ALERT: Transfer/dispute — critical payment event
  alertPaymentFailed(payment.id, payment.amount, failureReason, {
    currency: payment.currency,
    userId: payment.userId,
    bookingId: payment.bookingId,
    provider: 'PAYSTACK',
  });

  return {
    success: true,
    unhandled: false,
    responseBody: { received: true, processed: 'transfer.failed' },
    paymentId: payment.id,
    bookingId: payment.bookingId,
  };
}
