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
} from '@/lib/payment-alerts';
import { env } from '@/lib/env';
import { holdInEscrow, calculatePlatformFee } from '@/lib/escrow';

/**
 * M-Pesa (Safaricom Daraja) webhook handler with DB-backed idempotency,
 * HMAC signature verification, and automated failure alerting.
 *
 * SECURITY LAYERS:
 * 1. Callback structure validation (Body.stkCallback must exist)
 * 2. HMAC-SHA256 signature verification via x-mpesa-signature (when credentials configured)
 * 3. DB idempotency — unique constraint on (provider, CheckoutRequestID)
 * 4. Forensic raw body storage — unparsed payload for legal evidence
 * 5. Automated alerts on signature failures, processing failures, payment failures
 *
 * NOTE: M-Pesa does not provide a reliable event timestamp for replay attack
 * prevention. The CheckoutRequestID itself is a cryptographic nonce — if
 * Safaricom sends a duplicate, it will be caught by DB idempotency. Replay
 * from an external attacker would fail HMAC verification when credentials are
 * configured.
 *
 * M-Pesa retry behavior:
 * - Timeout after 60 seconds if no response
 * - May retry if endpoint unreachable
 * - We return 200 for duplicates → no retry
 * - We return 500 for processing failures → triggers retry
 */

const PROVIDER: WebhookProvider = 'MPESA';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const clientIp = extractClientIp(request.headers);

    // Parse body for structure validation and event ID extraction
    let parsedBody: Record<string, unknown>;
    let checkoutRequestId: string | undefined;
    let eventType = 'unknown';
    let resultCode: number | undefined;

    try {
      parsedBody = JSON.parse(body);

      const Body = parsedBody.Body as Record<string, unknown> | undefined;
      const stkCallback = Body?.stkCallback as Record<string, unknown> | undefined;
      if (!stkCallback) {
        await markEventInvalidSignature(PROVIDER, `invalid-${Date.now()}`, 'Invalid M-Pesa callback format');
        // 🔔 ALERT: Invalid callback structure — potential spoofing
        alertWebhookSignatureFailed('MPESA', clientIp);
        return errorResponse('Invalid M-Pesa callback format', 400);
      }

      checkoutRequestId = stkCallback.CheckoutRequestID as string;
      resultCode = stkCallback.ResultCode as number;
      eventType = resultCode === 0 ? 'STK_CALLBACK_SUCCESS' : 'STK_CALLBACK_FAILED';
    } catch {
      await markEventInvalidSignature(PROVIDER, `invalid-json-${Date.now()}`, 'Invalid JSON body');
      alertWebhookSignatureFailed('MPESA', clientIp);
      return errorResponse('Invalid request body', 400);
    }

    const eventId = checkoutRequestId || `unknown-${Date.now()}`;

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

    // Step 2: Verify callback origin using HMAC signature
    const mpesaSignature = request.headers.get('x-mpesa-signature');
    const mpesaPasskey = env.mpesa.passkey;
    const shortcode = env.mpesa.shortcode;

    if (mpesaPasskey && shortcode) {
      // Credentials configured — signature verification is MANDATORY
      if (!mpesaSignature) {
        await markEventInvalidSignature(PROVIDER, eventId, 'Missing x-mpesa-signature header');
        // 🔔 ALERT: Missing signature — potential spoofing
        alertWebhookSignatureFailed('MPESA', clientIp);
        return errorResponse('Missing M-Pesa signature', 401);
      }

      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const expectedSig = crypto
        .createHmac('sha256', mpesaPasskey)
        .update(`${checkoutRequestId}${timestamp}`)
        .digest('base64');

      try {
        const sigBuffer = Buffer.from(mpesaSignature);
        const expectedBuffer = Buffer.from(expectedSig);

        if (sigBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
          await markEventInvalidSignature(PROVIDER, eventId, 'HMAC signature mismatch');
          // 🔔 ALERT: Signature mismatch — potential spoofing
          alertWebhookSignatureFailed('MPESA', clientIp);
          return errorResponse('Invalid M-Pesa signature', 401);
        }
      } catch {
        await markEventInvalidSignature(PROVIDER, eventId, 'Signature comparison failed');
        alertWebhookSignatureFailed('MPESA', clientIp);
        return errorResponse('Signature verification failed', 401);
      }

      await markEventSignatureValid(PROVIDER, eventId);
    }
    // If credentials NOT configured (dev mode), allow without signature check

    // Step 3: Idempotency check via DB
    const alreadyProcessed = await isEventAlreadyProcessed(PROVIDER, eventId);
    if (alreadyProcessed) {
      await markEventDuplicate(PROVIDER, eventId);
      return successResponse({ received: true, idempotent: true });
    }

    // Step 4: Process the event
    const result = await processMpesaCallback(body, eventId, checkoutRequestId!, resultCode!);

    // Step 5: Record outcome
    const processingTimeMs = Date.now() - startTime;
    if (result.success) {
      await markEventProcessed(PROVIDER, eventId, {
        processingTimeMs,
        relatedPaymentId: result.paymentId,
        relatedBookingId: result.bookingId,
      });
    }

    return successResponse(result.responseBody);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 🔔 ALERT: Webhook processing failed
    alertWebhookProcessingFailed('MPESA', 'unknown', error);

    console.error('[M-Pesa Webhook] Processing error:', errorMessage);

    // Return 500 so M-Pesa may retry
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', retry: true }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

interface MpesaWebhookResult {
  success: boolean;
  responseBody: Record<string, unknown>;
  paymentId?: string;
  bookingId?: string;
}

async function processMpesaCallback(
  body: string,
  eventId: string,
  checkoutRequestId: string,
  resultCode: number
): Promise<MpesaWebhookResult> {
  const parsedBody = JSON.parse(body);
  const { Body } = parsedBody;
  const { stkCallback } = Body;
  const { ResultDesc, CallbackMetadata } = stkCallback;

  const payment = await db.payment.findFirst({
    where: { transactionId: checkoutRequestId },
  });

  if (!payment) {
    // Don't reveal whether payment was found or not (prevents enumeration)
    return { success: true, responseBody: { received: true } };
  }

  await db.$transaction(async (tx) => {
    if (resultCode === 0) {
      // Payment successful
      const metadata = (CallbackMetadata?.Item || []) as Array<{ Name: string; Value: unknown }>;
      const mpesaReceiptNumber = metadata.find((item) => item.Name === 'MpesaReceiptNumber')?.Value as string | undefined;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          transactionId: mpesaReceiptNumber || checkoutRequestId,
          metadata: JSON.stringify({
            resultCode,
            receipt: mpesaReceiptNumber,
            mpesaEventId: eventId,
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
          title: 'M-Pesa Payment Successful',
          message: `Your M-Pesa payment of KES ${payment.amount} was successful`,
          type: 'PAYMENT_SUCCESS',
        },
      });
    } else {
      // Payment failed
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: JSON.stringify({
            resultCode,
            resultDesc: ResultDesc,
            mpesaEventId: eventId,
          }),
        },
      });

      await tx.notification.create({
        data: {
          userId: payment.userId,
          title: 'M-Pesa Payment Failed',
          message: 'Your M-Pesa payment failed. Please try again.',
          type: 'PAYMENT_FAILED',
        },
      });

      // 🔔 ALERT: M-Pesa payment failure
      alertPaymentFailed(payment.id, payment.amount, String(ResultDesc || `M-Pesa result code ${resultCode}`), {
        currency: payment.currency,
        userId: payment.userId,
        bookingId: payment.bookingId,
        provider: 'MPESA',
      });
    }
  });

  // Hold payment in escrow after successful M-Pesa payment
  if (resultCode === 0) {
    try {
      const platformFee = await calculatePlatformFee(payment.amount);
      await holdInEscrow(payment.bookingId, payment.id, payment.amount, platformFee, payment.currency);
    } catch (escrowError) {
      console.error('Escrow hold failed:', escrowError);
      // Don't fail the webhook — escrow is async/secondary
    }
  }

  return {
    success: true,
    responseBody: {
      received: true,
      processed: resultCode === 0 ? 'STK_CALLBACK_SUCCESS' : 'STK_CALLBACK_FAILED',
    },
    paymentId: payment.id,
    bookingId: payment.bookingId,
  };
}
