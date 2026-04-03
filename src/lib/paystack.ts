/**
 * Paystack API Client
 *
 * Handles all Paystack server-side operations:
 *  - Transaction initialization (generate payment page/authorization URL)
 *  - Transaction verification (confirm payment after webhook)
 *  - Refund processing
 *  - Transfer recipient creation (for payouts)
 *  - Transfer initiation (disburse funds to recipients)
 *  - Webhook signature verification (HMAC-SHA512)
 *
 * Paystack uses HMAC-SHA512 (not SHA256 like Stripe) for webhook signing.
 * The signature header is "x-paystack-signature".
 *
 * IMPORTANT: Paystack Transfers require a funded balance.
 *   Ensure your Paystack balance is topped up before initiating transfers.
 *   Handle transfer callbacks via webhook (events: transfer.success, transfer.failed).
 *
 * Documentation: https://paystack.com/docs/api/
 */

import crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PaystackConfig {
  secretKey: string;
  webhookSecret: string;
  publicKey: string;
}

export interface InitializeTransactionParams {
  /** Amount in base currency unit (e.g. 5000 for $50.00, or 500000 for KES 5,000) */
  amount: number;
  /** ISO 4217 currency code (USD, KES, GHS, ZAR, NGN, etc.) */
  currency: string;
  /** Unique reference for this transaction */
  reference: string;
  /** Customer email (required by Paystack) */
  email: string;
  /** Optional: First name of customer */
  firstName?: string;
  /** Optional: Last name of customer */
  lastName?: string;
  /** Optional: Metadata to attach (max 50 keys, each key max 40 chars) */
  metadata?: Record<string, string>;
  /** Optional: Callback URL after payment */
  callbackUrl?: string;
  /** Optional: Channels to allow (card, bank, ussd, qr, mobile_money, bank_transfer) */
  channels?: string[];
}

export interface InitializeTransactionResult {
  /** Paystack authorization URL — redirect user here */
  authorizationUrl: string;
  /** Paystack access code */
  accessCode: string;
  /** Our reference (echoed back) */
  reference: string;
}

export interface VerifyTransactionResult {
  /** true if payment was successful */
  success: boolean;
  /** Paystack status (success, failed, abandoned, etc.) */
  status: string;
  /** Amount paid (in base unit) */
  amount: number;
  /** Currency used */
  currency: string;
  /** Paystack transaction reference */
  reference: string;
  /** Payment channel used (card, bank, etc.) */
  channel: string;
  /** Card type if card payment (visa, mastercard, etc.) */
  cardType?: string;
  /** Paystack transaction ID */
  transactionId: number;
  /** ISO timestamp of payment */
  paidAt?: string;
  /** Customer email */
  customerEmail: string;
  /** Authorization code for charging later (if stored) */
  authorizationCode?: string;
  /** Raw fees breakdown from Paystack */
  fees?: number;
  /** Full Paystack response for metadata extraction */
  raw: Record<string, unknown>;
}

export interface RefundTransactionParams {
  /** Paystack transaction ID to refund */
  transactionId: number;
  /** Amount to refund in base unit (full amount if omitted) */
  amount?: number;
  /** Reason for the refund */
  reason?: string;
  /** Optional: Our internal reference */
  reference?: string;
}

export interface RefundTransactionResult {
  /** Paystack refund ID */
  id: number;
  /** Refund status (pending, processed) */
  status: string;
  /** Refunded amount in base unit */
  amount: number;
  /** Refund reference */
  refundReference: string;
  /** ISO timestamp */
  createdAt: string;
  raw: Record<string, unknown>;
}

export interface CreateTransferParams {
  /** Amount in base currency unit (e.g. 5000 for $50.00, or 500000 for KES 5,000) */
  amount: number;
  /** Recipient code — created via POST /transferrecipient */
  recipient: string;
  /** Our internal reference for this transfer */
  reference: string;
  /** Reason for the transfer (optional, displayed in dashboard) */
  reason?: string;
  /** Source of funds — 'balance' (default) uses your Paystack balance */
  source?: string;
  /** Currency for the transfer (optional, defaults to NGN) */
  currency?: string;
}

export interface CreateTransferResult {
  /** Paystack transfer code (e.g., TRF_abc123xyz) */
  transferCode: string;
  /** Transfer status (pending, success, failed, etc.) */
  status: string;
  /** Our reference (echoed back) */
  reference: string;
  /** ISO timestamp of transfer initiation */
  createdAt: string;
  /** Full Paystack response for metadata extraction */
  raw: Record<string, unknown>;
}

export interface CreateTransferRecipientParams {
  /** Recipient type: 'nuban' for Nigerian bank accounts, 'mobile_money' for mobile wallets, 'authorization' for card */
  type: 'nuban' | 'mobile_money' | 'authorization';
  /** Account holder's full name */
  name: string;
  /** Account number or phone number */
  account_number: string;
  /** Bank code (for nuban), or mobile money provider code */
  bank_code: string;
  /** Currency code (optional, defaults to NGN) */
  currency?: string;
}

export interface CreateTransferRecipientResult {
  /** Whether the recipient was created successfully */
  success: boolean;
  /** Paystack recipient code (used in transfer requests) */
  recipientCode?: string;
  /** Human-readable message */
  message: string;
  /** ISO timestamp of creation */
  createdAt?: string;
}

// ── Paystack Client ────────────────────────────────────────────────────────

export class PaystackClient {
  private secretKey: string;
  private baseUrl = 'https://api.paystack.co';

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  /**
   * Initialize a transaction — creates a payment page and returns authorization URL.
   * The user is redirected to this URL to complete payment.
   */
  async initializeTransaction(params: InitializeTransactionParams): Promise<InitializeTransactionResult> {
    const body: Record<string, unknown> = {
      amount: params.amount,
      currency: params.currency,
      reference: params.reference,
      email: params.email,
    };

    if (params.firstName) body.first_name = params.firstName;
    if (params.lastName) body.last_name = params.lastName;
    if (params.metadata) body.metadata = params.metadata;
    if (params.callbackUrl) body.callback_url = params.callbackUrl;
    if (params.channels) body.channels = params.channels;

    const result = await this.request<{ status: boolean; data: Record<string, unknown> }>(
      'POST',
      '/transaction/initialize',
      body,
    );

    if (!result.status || !result.data) {
      throw new Error('Paystack transaction initialization failed');
    }

    return {
      authorizationUrl: result.data.authorization_url as string,
      accessCode: result.data.access_code as string,
      reference: result.data.reference as string,
    };
  }

  /**
   * Verify a transaction — confirms payment status after webhook or redirect.
   * Always call this on the server before marking a payment as completed.
   */
  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const result = await this.request<{ status: boolean; data: Record<string, unknown> }>(
      'GET',
      `/transaction/verify/${reference}`,
    );

    if (!result.status || !result.data) {
      throw new Error('Paystack transaction verification failed');
    }

    const data = result.data;
    const authorization = data.authorization as Record<string, unknown> | undefined;
    const feesBreakdown = data.fees_breakdown as Array<Record<string, unknown>> | undefined;

    return {
      success: (data.status as string) === 'success',
      status: data.status as string,
      amount: data.amount as number,
      currency: data.currency as string,
      reference: data.reference as string,
      channel: data.channel as string,
      cardType: authorization?.card_type as string | undefined,
      transactionId: data.id as number,
      paidAt: data.paid_at as string | undefined,
      customerEmail: (data.customer as Record<string, unknown>)?.email as string,
      authorizationCode: authorization?.authorization_code as string | undefined,
      fees: data.fees as number | undefined,
      raw: data,
    };
  }

  /**
   * Refund a transaction — partially or fully refund a completed payment.
   */
  async refundTransaction(params: RefundTransactionParams): Promise<RefundTransactionResult> {
    const body: Record<string, unknown> = {
      transaction: params.transactionId,
    };

    if (params.amount !== undefined) body.amount = params.amount;
    if (params.reason) body.reason = params.reason;
    if (params.reference) body.reference = params.reference;

    const result = await this.request<{ status: boolean; data: Record<string, unknown> }>(
      'POST',
      '/refund',
      body,
    );

    if (!result.status || !result.data) {
      throw new Error('Paystack refund failed');
    }

    return {
      id: result.data.id as number,
      status: result.data.status as string,
      amount: result.data.amount as number,
      refundReference: result.data.refund_reference as string || '',
      createdAt: result.data.createdAt as string || new Date().toISOString(),
      raw: result.data,
    };
  }

  /**
   * Create a transfer recipient.
   *
   * A recipient must be created before initiating a transfer.
   * The recipient_code returned is used in createTransfer().
   *
   * @see https://paystack.com/docs/api/transfer-recipient/#create
   */
  async createTransferRecipient(params: CreateTransferRecipientParams): Promise<CreateTransferRecipientResult> {
    const body: Record<string, unknown> = {
      type: params.type,
      name: params.name,
      account_number: params.account_number,
      bank_code: params.bank_code,
    };

    if (params.currency) body.currency = params.currency;

    try {
      const result = await this.request<{
        status: boolean;
        message: string;
        data: Record<string, unknown>;
      }>('POST', '/transferrecipient', body);

      if (!result.status || !result.data) {
        return {
          success: false,
          message: result.message || 'Paystack recipient creation failed',
        };
      }

      console.log(
        `[Paystack] Transfer recipient created: code=${result.data.recipient_code} ` +
        `type=${params.type} name=${params.name}`,
      );

      return {
        success: true,
        recipientCode: result.data.recipient_code as string,
        message: result.message || 'Recipient created successfully',
        createdAt: result.data.createdAt as string || new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Paystack] Transfer recipient creation error: ${message}`);
      return { success: false, message };
    }
  }

  /**
   * Initiate a transfer to a recipient's bank account.
   *
   * Prerequisites for production use:
   *   1. Create a Transfer Recipient via createTransferRecipient()
   *   2. Ensure your Paystack balance is funded
   *   3. Handle transfer callbacks via webhook (event: transfer.success / transfer.failed)
   *
   * NOTE: Transfer amounts are in the smallest currency unit (kobo for NGN, cents for USD, etc.).
   *
   * @see https://paystack.com/docs/api/transfer/#create
   */
  async createTransfer(params: CreateTransferParams): Promise<CreateTransferResult> {
    const body: Record<string, unknown> = {
      source: params.source || 'balance',
      amount: params.amount,
      recipient: params.recipient,
      reference: params.reference,
    };

    if (params.reason) body.reason = params.reason;
    if (params.currency) body.currency = params.currency;

    try {
      console.log(
        `[Paystack] Initiating transfer: amount=${params.amount} recipient=${params.recipient} ` +
        `reference=${params.reference}`,
      );

      const result = await this.request<{
        status: boolean;
        message: string;
        data: Record<string, unknown>;
      }>('POST', '/transfer', body);

      if (!result.status || !result.data) {
        throw new Error(result.message || 'Paystack transfer initiation failed');
      }

      console.log(
        `[Paystack] Transfer initiated: code=${result.data.transfer_code} ` +
        `status=${result.data.status}`,
      );

      return {
        transferCode: result.data.transfer_code as string,
        status: result.data.status as string,
        reference: result.data.reference as string,
        createdAt: result.data.createdAt as string || new Date().toISOString(),
        raw: result.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Paystack] Transfer initiation error: ${message}`);
      throw error;
    }
  }

  /**
   * Fetch a single transaction by ID.
   */
  async fetchTransaction(id: number): Promise<Record<string, unknown>> {
    const result = await this.request<{ status: boolean; data: Record<string, unknown> }>(
      'GET',
      `/transaction/${id}`,
    );

    if (!result.status || !result.data) {
      throw new Error('Paystack fetch transaction failed');
    }

    return result.data;
  }

  // ── Internal HTTP request helper ──────────────────────────────────────

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Paystack API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }
}

// ── Webhook Verification ────────────────────────────────────────────────────

/**
 * Verify a Paystack webhook signature.
 *
 * Paystack uses HMAC-SHA512 (not SHA256 like Stripe).
 * The signature is sent in the "x-paystack-signature" header.
 *
 * Algorithm:
 *   hash = HMAC-SHA512(webhookSecret, rawRequestBody)
 *   Compare hash with header value using timing-safe comparison
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  if (!signature || !webhookSecret) return false;

  const expectedHash = crypto
    .createHmac('sha512', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  return timingSafeEqual(expectedHash, signature);
}

/**
 * Constant-time string comparison.
 * Prevents timing attacks on signature verification.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _client: PaystackClient | null = null;

export function getPaystackClient(secretKey?: string): PaystackClient {
  if (!_client && secretKey) {
    _client = new PaystackClient(secretKey);
  }
  if (!_client) {
    throw new Error('Paystack client not initialized. Provide a secret key.');
  }
  return _client;
}
