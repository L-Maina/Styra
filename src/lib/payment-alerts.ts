// ============================================
// PAYMENT FAILURE ALERT INTEGRATION
// ============================================
// Alerts on payment failures, refunds, and webhook processing errors.
// Uses the existing SecurityAlert Prisma model for persistence.
// Uses the error tracker for error logging.
// All alerts are fire-and-forget — never block request handlers.

import { db } from './db';
import { trackError } from './error-tracker';
import { logSecurityAlert } from './audit-log';
import { env } from './env';

// ============================================
// TYPES
// ============================================

interface PaymentAlertContext {
  paymentId: string;
  amount: number;
  currency?: string;
  userId?: string;
  userEmail?: string;
  bookingId?: string;
  provider?: string;
}

interface WebhookAlertContext {
  provider: string;
  eventId: string;
  error: unknown;
}

// ============================================
// PAYMENT FAILURE ALERT
// ============================================

/**
 * Alert when a payment fails.
 * Creates a SecurityAlert record + tracks the error.
 *
 * @param paymentId - The payment ID that failed
 * @param amount - Payment amount
 * @param reason - Failure reason
 * @param context - Additional context (userId, bookingId, etc.)
 */
export function alertPaymentFailed(
  paymentId: string,
  amount: number,
  reason: string,
  context?: Partial<PaymentAlertContext>,
): void {
  try {
    const severity = amount >= 1000 ? 'HIGH' : 'MEDIUM';

    // Fire-and-forget: create security alert
    db.securityAlert.create({
      data: {
        type: 'PAYMENT_FAILED',
        severity,
        ipAddress: 'system',
        userId: context?.userId || null,
        email: context?.userEmail || null,
        title: 'Payment Failed',
        description: `Payment ${paymentId} for ${context?.currency || 'USD'} ${amount.toFixed(2)} failed: ${reason}`,
        metadata: JSON.stringify({
          paymentId,
          amount,
          currency: context?.currency || 'USD',
          reason,
          bookingId: context?.bookingId,
          timestamp: new Date().toISOString(),
        }),
        status: 'OPEN',
      },
    }).catch(() => {});

    // Also track in the error tracker
    trackError(new Error(`Payment failed: ${reason}`), {
      severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      route: '/api/payments',
      method: 'POST',
      userId: context?.userId,
    });

    // Log to security audit trail
    logSecurityAlert('PAYMENT_FAILED', 'system', {
      paymentId,
      amount,
      reason,
      severity,
    });
  } catch {
    // Alerting must NEVER break the application
  }
}

// ============================================
// PAYMENT REFUND ALERT
// ============================================

/**
 * Log a refund for monitoring.
 * Creates a SecurityAlert record for tracking.
 *
 * @param paymentId - The payment ID that was refunded
 * @param amount - Refund amount
 * @param context - Additional context
 */
export function alertPaymentRefunded(
  paymentId: string,
  amount: number,
  context?: Partial<PaymentAlertContext>,
): void {
  try {
    const severity = amount >= 1000 ? 'HIGH' : 'MEDIUM';

    db.securityAlert.create({
      data: {
        type: 'PAYMENT_REFUNDED',
        severity,
        ipAddress: 'system',
        userId: context?.userId || null,
        email: context?.userEmail || null,
        title: 'Payment Refunded',
        description: `Payment ${paymentId} was refunded for ${context?.currency || 'USD'} ${amount.toFixed(2)}`,
        metadata: JSON.stringify({
          paymentId,
          amount,
          currency: context?.currency || 'USD',
          bookingId: context?.bookingId,
          timestamp: new Date().toISOString(),
        }),
        status: 'OPEN',
      },
    }).catch(() => {});

    // Log to security audit trail
    logSecurityAlert('PAYMENT_REFUNDED', 'system', {
      paymentId,
      amount,
      severity,
    });
  } catch {
    // Alerting must NEVER break the application
  }
}

// ============================================
// WEBHOOK PROCESSING FAILURE ALERT
// ============================================

/**
 * Alert when webhook processing fails.
 * Creates a SecurityAlert record + tracks the error.
 *
 * @param provider - Payment provider (STRIPE, PAYPAL, MPESA)
 * @param eventId - Event ID from the provider
 * @param error - The error that occurred
 */
export function alertWebhookProcessingFailed(
  provider: string,
  eventId: string,
  error: unknown,
): void {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);

    db.securityAlert.create({
      data: {
        type: 'WEBHOOK_PROCESSING_FAILED',
        severity: 'HIGH',
        ipAddress: 'system',
        title: `Webhook Processing Failed (${provider})`,
        description: `Failed to process ${provider} webhook event ${eventId}: ${errorMessage}`,
        metadata: JSON.stringify({
          provider,
          eventId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
        status: 'OPEN',
      },
    }).catch(() => {});

    // Track the error
    trackError(error, {
      severity: 'HIGH',
      route: `/api/webhooks/${provider.toLowerCase()}`,
      method: 'POST',
    });

    // Log to security audit trail
    logSecurityAlert('WEBHOOK_PROCESSING_FAILED', 'system', {
      provider,
      eventId,
      error: errorMessage,
    });
  } catch {
    // Alerting must NEVER break the application
  }
}

// ============================================
// WEBHOOK SIGNATURE FAILURE ALERT
// ============================================

/**
 * Alert when a webhook signature verification fails.
 * This is a security concern — potentially spoofed webhook.
 *
 * @param provider - Payment provider
 * @param ipAddress - Source IP of the webhook call
 */
export function alertWebhookSignatureFailed(
  provider: string,
  ipAddress: string,
): void {
  try {
    db.securityAlert.create({
      data: {
        type: 'WEBHOOK_SIGNATURE_FAILED',
        severity: 'CRITICAL',
        ipAddress,
        title: `Webhook Signature Verification Failed (${provider})`,
        description: `Received a webhook from ${provider} with invalid signature. This may be a spoofing attempt.`,
        metadata: JSON.stringify({
          provider,
          timestamp: new Date().toISOString(),
        }),
        status: 'OPEN',
      },
    }).catch(() => {});

    logSecurityAlert('WEBHOOK_SIGNATURE_FAILED', ipAddress, {
      provider,
      severity: 'CRITICAL',
    });
  } catch {
    // Alerting must NEVER break the application
  }
}
