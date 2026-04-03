/**
 * PayPal Payouts API Client
 *
 * Handles PayPal Payouts (separate from PayPal Orders API).
 * Used by the payout engine to disburse provider earnings via PayPal.
 *
 * PayPal Payouts API sends money from your PayPal business account to
 * recipients via their email address or phone number.
 *
 * IMPORTANT:
 *   - The Payouts API uses v1 endpoints (unlike Orders which uses v2).
 *   - Payouts API base URL is different from Orders API:
 *     - Sandbox: https://api-m.sandbox.paypal.com/v1/payments/payouts
 *     - Production: https://api-m.paypal.com/v1/payments/payouts
 *   - Requires PayPal business account with sufficient balance.
 *   - Payouts are asynchronous — the batch status must be polled or
 *     received via webhook (PAYMENT.PAYOUTS-ITEM.COMPLETED).
 *   - Maximum payout items per batch: 500.
 *   - Recipient PayPal accounts must be verified to receive payouts.
 *
 * Required environment variables:
 *   - PAYPAL_CLIENT_ID     – PayPal REST API client ID
 *   - PAYPAL_CLIENT_SECRET  – PayPal REST API client secret
 *   - PAYPAL_MODE           – 'sandbox' or 'live' (defaults to sandbox)
 *
 * @see https://developer.paypal.com/docs/api/payments.payouts/v1/
 */

import { getPayPalAccessToken } from '@/lib/paypal';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PayPalPayoutParams {
  /** Recipient's PayPal email address */
  recipientEmail: string;
  /** Amount to send (decimal, e.g. 50.00) */
  amount: number;
  /** ISO 4217 currency code (e.g. 'USD', 'EUR') */
  currency: string;
  /** Optional unique ID for this payout item (for idempotency) */
  senderItemId?: string;
  /** Optional note to the recipient */
  note?: string;
}

export interface PayPalPayoutResult {
  /** Whether the payout batch was accepted by PayPal */
  success: boolean;
  /** PayPal batch ID (use to check status later) */
  batchId?: string;
  /** Human-readable message */
  message: string;
}

export interface PayPalPayoutBatchStatus {
  /** Whether the status request succeeded */
  success: boolean;
  /** Batch status (e.g. 'PROCESSING', 'SUCCESS', 'DENIED') */
  status?: string;
  /** Human-readable message */
  message: string;
}

interface PayPalPayoutBatchResponse {
  batch_header: {
    payout_batch_id: string;
    batch_status: string;
    time_created: string;
    time_completed?: string;
    sender_batch_header: {
      sender_batch_id: string;
      email_subject: string;
    };
  };
  items: Array<{
    payout_item_id: string;
    payout_item_detail: {
      recipient_type: string;
      amount: {
        value: string;
        currency: string;
      };
      receiver: string;
      note?: string;
      sender_item_id?: string;
    };
    transaction_status: string;
    errors?: {
      name: string;
      message: string;
    }[];
  }>;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Generate a unique batch ID for the payout.
 * Format: STY-PAYPAL-<timestamp>-<random>
 */
function generateBatchId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `STY-PAYPAL-${timestamp}-${random}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a PayPal payout batch.
 *
 * Sends money from the Styra business PayPal account to a provider's PayPal account.
 * The payout is processed asynchronously — check batch status via getPayPalPayoutStatus().
 *
 * @see https://developer.paypal.com/docs/api/payments.payouts/v1/#payouts_post
 *
 * @param params.recipientEmail - Recipient's verified PayPal email
 * @param params.amount         - Amount to send (decimal, e.g. 50.00)
 * @param params.currency       - ISO 4217 currency code
 * @param params.senderItemId   - Optional unique ID for idempotency
 * @param params.note           - Optional note for the recipient
 * @returns PayPalPayoutResult with success status and batch ID
 */
export async function createPayPalPayout(params: PayPalPayoutParams): Promise<PayPalPayoutResult> {
  // 1. Get PayPal access token (reuses the same OAuth flow as Orders)
  const token = await getPayPalAccessToken();
  if (!token) {
    return {
      success: false,
      message: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
    };
  }

  // 2. Build payout batch request body
  const senderBatchId = params.senderItemId || generateBatchId();

  const requestBody = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: 'You have a payout from Styra!',
      email_message: params.note || 'Thank you for your services on Styra.',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: params.amount.toFixed(2),
          currency: params.currency.toUpperCase(),
        },
        receiver: params.recipientEmail,
        note: params.note || '',
        sender_item_id: params.senderItemId || senderBatchId,
      },
    ],
  };

  // 3. POST to Payouts API (v1 — different from Orders v2)
  const payoutUrl = `${getBaseUrl()}/v1/payments/payouts`;

  try {
    console.log(
      `[PayPal Payout] Creating batch: recipient=${params.recipientEmail} ` +
      `amount=${params.amount.toFixed(2)} ${params.currency} batchId=${senderBatchId}`,
    );

    const response = await fetch(payoutUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[PayPal Payout] Request failed (${response.status}): ${responseText}`);
      return {
        success: false,
        message: `PayPal Payouts API returned ${response.status}: ${responseText}`,
      };
    }

    const data: PayPalPayoutBatchResponse = JSON.parse(responseText);
    const batchId = data.batch_header.payout_batch_id;
    const batchStatus = data.batch_header.batch_status;

    console.log(
      `[PayPal Payout] Batch created: batchId=${batchId} status=${batchStatus} ` +
      `items=${data.items.length}`,
    );

    // Log any item-level errors
    for (const item of data.items) {
      if (item.errors && item.errors.length > 0) {
        console.error(
          `[PayPal Payout] Item error: itemId=${item.payout_item_id} ` +
          `status=${item.transaction_status} errors=${JSON.stringify(item.errors)}`,
        );
      }
    }

    return {
      success: true,
      batchId,
      message: `Payout batch ${batchId} created with status: ${batchStatus}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PayPal Payout] Error: ${message}`);
    return {
      success: false,
      message: `PayPal payout failed: ${message}`,
    };
  }
}

/**
 * Get the status of a PayPal payout batch.
 *
 * Use this to check whether a payout has completed, failed, or is still processing.
 * The payout engine should poll this endpoint or rely on webhooks for final status.
 *
 * @see https://developer.paypal.com/docs/api/payments.payouts/v1/#payouts_get
 *
 * @param batchId - The PayPal payout batch ID returned from createPayPalPayout()
 * @returns PayPalPayoutBatchStatus with the current batch status
 */
export async function getPayPalPayoutStatus(batchId: string): Promise<PayPalPayoutBatchStatus> {
  const token = await getPayPalAccessToken();
  if (!token) {
    return {
      success: false,
      message: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
    };
  }

  const statusUrl = `${getBaseUrl()}/v1/payments/payouts/${batchId}`;

  try {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[PayPal Payout] Status check failed (${response.status}): ${responseText}`);
      return {
        success: false,
        message: `PayPal Payouts API returned ${response.status}: ${responseText}`,
      };
    }

    const data: PayPalPayoutBatchResponse = JSON.parse(responseText);

    return {
      success: true,
      status: data.batch_header.batch_status,
      message: `Batch ${batchId} status: ${data.batch_header.batch_status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PayPal Payout] Status check error: ${message}`);
    return {
      success: false,
      message: `Failed to check payout status: ${message}`,
    };
  }
}
