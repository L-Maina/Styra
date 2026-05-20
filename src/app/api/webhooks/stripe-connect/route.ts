/**
 * Stripe Connect Webhook Handler
 *
 * POST /api/webhooks/stripe-connect
 *
 * Handles Stripe Connect webhook events:
 *   - account.updated:   Update business.stripeOnboardingComplete when account is fully onboarded
 *   - transfer.created:  Log transfer to provider
 *   - transfer.failed:   Alert admin of failed transfer
 *
 * Uses stripe.webhooks.constructEvent() for signature verification.
 * In development mode, if STRIPE_CONNECT_WEBHOOK_SECRET is not set,
 * falls back to parsing the body directly (dev-only, never in production).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { env, isDev } from '@/lib/env';
import Stripe from 'stripe';
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
} from '@/lib/payment-alerts';

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER: WebhookProvider = 'STRIPE_CONNECT';

/** Max allowed age for a Stripe webhook event (seconds). Prevents replay attacks. */
const WEBHOOK_MAX_AGE_SECONDS = 300; // 5 minutes

// ── Lazy Stripe singleton ────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;
  if (!env.stripe.secretKey) return null;
  try {
    _stripe = new Stripe(env.stripe.secretKey, {
      apiVersion: '2023-10-16' as any,
    });
    return _stripe;
  } catch {
    console.error('[Stripe Connect Webhook] Failed to initialize Stripe client');
    return null;
  }
}

/**
 * Get the webhook secret for Stripe Connect webhooks.
 * Uses STRIPE_CONNECT_WEBHOOK_SECRET if set, otherwise falls back to STRIPE_WEBHOOK_SECRET.
 */
function getWebhookSecret(): string | null {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET || env.stripe.webhookSecret || null;
}

// ── POST /api/webhooks/stripe-connect ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    const clientIp = extractClientIp(request.headers);

    // Step 0: Extract provisional event ID for logging
    let event: Stripe.Event;
    let provisionalEventId = 'unknown';
    let provisionalEventType = 'unknown';
    try {
      const parsed = JSON.parse(body);
      provisionalEventId = parsed.id || 'unknown';
      provisionalEventType = parsed.type || 'unknown';
    } catch {
      // Body isn't valid JSON
    }

    // Step 1: Record the incoming event in DB
    const recorded = await recordReceivedEvent({
      provider: PROVIDER,
      providerEventId: provisionalEventId,
      eventType: provisionalEventType,
      requestBody: body,
      headers: request.headers,
      ipAddress: clientIp,
    });

    // Step 2: Validate signature
    const webhookSecret = getWebhookSecret();

    if (!signature) {
      await markEventInvalidSignature(PROVIDER, provisionalEventId, 'Missing Stripe-Signature header');
      alertWebhookSignatureFailed('STRIPE_CONNECT', clientIp);
      return new Response(
        JSON.stringify({ error: 'Missing Stripe signature' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!webhookSecret) {
      if (env.features.devPaymentFallback && process.env.NODE_ENV !== 'production') {
        // Dev mode: parse body as JSON without verification
        event = JSON.parse(body) as Stripe.Event;
      } else {
        alertWebhookProcessingFailed('STRIPE_CONNECT', provisionalEventId, new Error('Webhook secret not configured'));
        await markEventFailed(PROVIDER, provisionalEventId, 'Webhook secret not configured', {
          processingTimeMs: Date.now() - startTime,
          responseCode: 500,
        });
        return new Response(
          JSON.stringify({ error: 'Webhook not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    } else {
      const stripe = getStripeClient();
      if (!stripe) {
        await markEventFailed(PROVIDER, provisionalEventId, 'Stripe client not initialized', {
          processingTimeMs: Date.now() - startTime,
          responseCode: 500,
        });
        return new Response(
          JSON.stringify({ error: 'Stripe not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        await markEventSignatureValid(PROVIDER, provisionalEventId);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Stripe Connect Webhook] Signature verification failed:', errorMessage);
        await markEventInvalidSignature(PROVIDER, provisionalEventId, errorMessage);
        alertWebhookSignatureFailed('STRIPE_CONNECT', clientIp);
        return new Response(
          JSON.stringify({ error: 'Webhook signature verification failed' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Step 3: Timestamp validation — replay attack prevention
    const eventCreated = event.created;
    if (eventCreated && typeof eventCreated === 'number') {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ageSeconds = nowSeconds - eventCreated;

      if (ageSeconds > WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(
          PROVIDER,
          event.id,
          `Replay attack: event age ${ageSeconds}s exceeds ${WEBHOOK_MAX_AGE_SECONDS}s tolerance`,
        );
        alertWebhookSignatureFailed('STRIPE_CONNECT', clientIp);
        return new Response(
          JSON.stringify({ error: `Webhook event too old (${Math.round(ageSeconds)}s)` }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (ageSeconds < -WEBHOOK_MAX_AGE_SECONDS) {
        await markEventInvalidSignature(
          PROVIDER,
          event.id,
          `Clock skew: event timestamp is ${Math.round(-ageSeconds)}s in the future`,
        );
        return new Response(
          JSON.stringify({ error: 'Webhook event timestamp is in the future' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Step 4: Update with verified event ID if different from provisional
    if (recorded && (event.id !== provisionalEventId || event.type !== provisionalEventType)) {
      await db.webhookEvent.update({
        where: { id: recorded.id },
        data: {
          providerEventId: event.id,
          eventType: event.type,
        },
      }).catch(() => { /* Non-critical */ });
    }

    // Step 5: Idempotency check
    const alreadyProcessed = await isEventAlreadyProcessed(PROVIDER, event.id);
    if (alreadyProcessed) {
      await markEventDuplicate(PROVIDER, event.id);
      return new Response(
        JSON.stringify({ received: true, idempotent: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Step 6: Process the event
    const result = await handleConnectWebhookEvent(event);

    // Step 7: Record outcome
    const processingTimeMs = Date.now() - startTime;
    if (result.success) {
      await markEventProcessed(PROVIDER, event.id, {
        processingTimeMs,
      });
    } else if (result.unhandled) {
      await markEventUnhandled(PROVIDER, event.id);
    } else {
      await markEventFailed(PROVIDER, event.id, result.error || 'Processing failed', {
        processingTimeMs,
      });
    }

    return new Response(
      JSON.stringify(result.responseBody),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    alertWebhookProcessingFailed('STRIPE_CONNECT', 'unknown', error);
    console.error('[Stripe Connect Webhook] Processing error:', errorMessage);

    // Return 500 so Stripe will retry
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', retry: true }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// ── Event Handler ────────────────────────────────────────────────────────────

interface WebhookResult {
  success: boolean;
  unhandled: boolean;
  responseBody: Record<string, unknown>;
  error?: string;
}

async function handleConnectWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      return await handleAccountUpdated(account, event.id);
    }

    case 'transfer.created': {
      const transfer = event.data.object as Stripe.Transfer;
      return await handleTransferCreated(transfer, event.id);
    }

    case 'transfer.failed': {
      const transfer = event.data.object as Stripe.Transfer;
      return await handleTransferFailed(transfer, event.id);
    }

    default:
      return {
        success: false,
        unhandled: true,
        responseBody: { received: true, event: event.type },
      };
  }
}

/**
 * Handle account.updated — Update business.stripeOnboardingComplete
 * when the connected account is fully onboarded.
 */
async function handleAccountUpdated(
  account: Stripe.Account,
  eventId: string,
): Promise<WebhookResult> {
  try {
    // Find the business associated with this Stripe account
    const business = await db.business.findFirst({
      where: { stripeAccountId: account.id },
    });

    if (!business) {
      console.warn(
        `[Stripe Connect Webhook] account.updated: No business found for Stripe account ${account.id}`,
      );
      return {
        success: true,
        unhandled: false,
        responseBody: { received: true, status: 'business_not_found', accountId: account.id },
      };
    }

    const detailsSubmitted = account.details_submitted;
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;

    // Update the business record
    await db.business.update({
      where: { id: business.id },
      data: {
        stripeOnboardingComplete: detailsSubmitted,
      },
    });

    // Create a notification for the business owner
    if (detailsSubmitted && !business.stripeOnboardingComplete) {
      // Onboarding just completed
      try {
        await db.notification.create({
          data: {
            userId: business.ownerId,
            title: 'Stripe Connect Setup Complete',
            message: `Your Stripe account for "${business.name}" is now fully set up. You can receive payouts directly to your bank account.`,
            type: 'SYSTEM_ALERT',
            link: `/?page=dashboard`,
          },
        });
      } catch {
        // Notification failure should not break the webhook
      }
    }

    console.log(
      `[Stripe Connect Webhook] account.updated: business=${business.id} ` +
      `detailsSubmitted=${detailsSubmitted} chargesEnabled=${chargesEnabled} payoutsEnabled=${payoutsEnabled}`,
    );

    return {
      success: true,
      unhandled: false,
      responseBody: {
        received: true,
        processed: 'account.updated',
        accountId: account.id,
        businessId: business.id,
        detailsSubmitted,
        chargesEnabled,
        payoutsEnabled,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Stripe Connect Webhook] account.updated error: ${msg}`);
    return {
      success: false,
      unhandled: false,
      responseBody: { received: true, error: 'Processing failed' },
      error: msg,
    };
  }
}

/**
 * Handle transfer.created — Log transfer to provider.
 */
async function handleTransferCreated(
  transfer: Stripe.Transfer,
  eventId: string,
): Promise<WebhookResult> {
  try {
    const destinationAccountId = transfer.destination as string;

    // Find the business associated with the destination account
    const business = await db.business.findFirst({
      where: { stripeAccountId: destinationAccountId },
    });

    console.log(
      `[Stripe Connect Webhook] transfer.created: transferId=${transfer.id} ` +
      `amount=${transfer.amount} currency=${transfer.currency} ` +
      `destination=${destinationAccountId} business=${business?.id || 'unknown'}`,
    );

    // Log the transfer in the transaction log
    if (business) {
      try {
        await db.transactionLog.create({
          data: {
            userId: business.ownerId,
            bookingId: transfer.metadata?.bookingId || null,
            amount: transfer.amount / 100, // Convert cents to currency units
            type: 'PAYOUT_SENT',
            status: 'COMPLETED',
            provider: 'STRIPE',
            referenceId: transfer.id,
            metadata: JSON.stringify({
              stripeTransferId: transfer.id,
              stripeAccountId: destinationAccountId,
              businessId: business.id,
              amountInCents: transfer.amount,
              currency: transfer.currency,
              transferGroup: transfer.transfer_group,
              eventId,
            }),
          },
        });
      } catch {
        // Transaction log failure should not break the webhook
      }
    }

    return {
      success: true,
      unhandled: false,
      responseBody: {
        received: true,
        processed: 'transfer.created',
        transferId: transfer.id,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Stripe Connect Webhook] transfer.created error: ${msg}`);
    return {
      success: false,
      unhandled: false,
      responseBody: { received: true, error: 'Processing failed' },
      error: msg,
    };
  }
}

/**
 * Handle transfer.failed — Alert admin of failed transfer.
 */
async function handleTransferFailed(
  transfer: Stripe.Transfer,
  eventId: string,
): Promise<WebhookResult> {
  try {
    const destinationAccountId = transfer.destination as string;

    // Find the business associated with the destination account
    const business = await db.business.findFirst({
      where: { stripeAccountId: destinationAccountId },
    });

    console.error(
      `[Stripe Connect Webhook] ⚠️ transfer.failed: transferId=${transfer.id} ` +
      `amount=${transfer.amount} currency=${transfer.currency} ` +
      `destination=${destinationAccountId} business=${business?.id || 'unknown'}`,
    );

    // Alert admin
    alertWebhookProcessingFailed(
      'STRIPE_CONNECT',
      transfer.id,
      new Error(
        `Transfer failed: ${transfer.id}, amount=${transfer.amount / 100} ${transfer.currency}, ` +
        `destination=${destinationAccountId}, business=${business?.name || 'unknown'}`,
      ),
    );

    // Update any related payout record
    if (business) {
      try {
        // Find a payout record that references this Stripe account
        const relatedPayout = await db.payout.findFirst({
          where: {
            businessId: business.id,
            method: 'STRIPE',
            status: { in: ['PENDING', 'PROCESSING'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (relatedPayout) {
          await db.payout.update({
            where: { id: relatedPayout.id },
            data: {
              status: 'FAILED',
              failedReason: `Stripe transfer failed: ${transfer.id}`,
            },
          });
        }
      } catch {
        // Payout update failure should not break the webhook
      }

      // Notify the provider
      try {
        await db.notification.create({
          data: {
            userId: business.ownerId,
            title: 'Payout Failed',
            message: `A Stripe transfer of ${(transfer.amount / 100).toFixed(2)} ${transfer.currency?.toUpperCase()} failed for "${business.name}". Our team has been notified and will investigate.`,
            type: 'PAYMENT_FAILED',
            link: `/?page=dashboard`,
          },
        });
      } catch {
        // Notification failure should not break the webhook
      }
    }

    return {
      success: true,
      unhandled: false,
      responseBody: {
        received: true,
        processed: 'transfer.failed',
        transferId: transfer.id,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Stripe Connect Webhook] transfer.failed error: ${msg}`);
    return {
      success: false,
      unhandled: false,
      responseBody: { received: true, error: 'Processing failed' },
      error: msg,
    };
  }
}
