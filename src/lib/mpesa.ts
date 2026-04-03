/**
 * M-Pesa (Safaricom Daraja) Client
 *
 * Lightweight M-Pesa integration using native fetch() — no third-party SDK.
 * Supports:
 *   - OAuth2 access token from Safaricom Daraja API
 *   - STK Push (Lipa Na M-Pesa Online) for initiating mobile payment
 *   - B2C (Business to Customer) payouts for paying providers
 *
 * All functions return null when env vars are not configured (dev mode fallback).
 *
 * Required environment variables (STK Push):
 *   - MPESA_CONSUMER_KEY       – Daraja app consumer key
 *   - MPESA_CONSUMER_SECRET    – Daraja app consumer secret
 *   - MPESA_BUSINESS_SHORTCODE – Paybill / till number (e.g. 174379)
 *   - MPESA_ONLINE_PASSKEY     – Lipa Na M-Pesa online passkey
 *   - MPESA_CALLBACK_URL       – Base URL for STK callback (webhook)
 *
 * Additional environment variables (B2C Payouts):
 *   - MPESA_B2C_INITIATOR_NAME       – B2C initiator username (default: 'test_api38' for sandbox)
 *   - MPESA_B2C_SECURITY_CREDENTIAL   – Encrypted credential (production only)
 *   - MPESA_B2C_RESULT_URL            – Callback URL for B2C results
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface MpesaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

interface MpesaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaStkPushResult {
  checkoutRequestID: string;
  merchantRequestID: string;
  responseCode: string;
  responseDescription: string;
}

// ── B2C Types ──────────────────────────────────────────────────────────────

interface MpesaB2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface MpesaB2CParams {
  /** Phone number (various formats accepted, will be normalized to 254XXXXXXXXX) */
  phoneNumber: string;
  /** Amount in KES (integer) */
  amount: number;
  /** Remarks / description of the payout */
  remarks: string;
  /** Occasion description (optional) */
  occasion?: string;
  /** B2C command type */
  commandID?: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
}

export interface MpesaB2CResult {
  /** Whether the B2C request was accepted by Safaricom */
  success: boolean;
  /** Transaction reference from M-Pesa (ConversationID) */
  transactionId?: string;
  /** Human-readable message */
  message: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function isConfigured(): boolean {
  return !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_BUSINESS_SHORTCODE &&
    process.env.MPESA_ONLINE_PASSKEY
  );
}

/**
 * Generate the base64-encoded password required for STK Push.
 * Password = Base64(Shortcode + Passkey + Timestamp)
 */
function generateStkPassword(): string {
  const shortcode = process.env.MPESA_BUSINESS_SHORTCODE!;
  const passkey = process.env.MPESA_ONLINE_PASSKEY!;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, ''); // Format: YYYYMMDDHHmmss

  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * Get current timestamp in the format expected by M-Pesa: YYYYMMDDHHmmss
 */
function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// Token cache
let tokenCache: { token: string; expiresAt: number } | null = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Obtain an OAuth2 access token from Safaricom Daraja API.
 * Results are cached in-memory until expiry.
 *
 * @returns Bearer token string, or null if M-Pesa is not configured
 */
export async function getMpesaAccessToken(): Promise<string | null> {
  if (!isConfigured()) {
    return null;
  }

  // Return cached token if still valid (with 30s safety margin)
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  try {
    const credentials = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[M-Pesa] Token request failed (${response.status}): ${errorText}`);
      return null;
    }

    const data: MpesaAccessTokenResponse = await response.json();

    // Cache for the token lifetime minus 30s safety margin
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (parseInt(data.expires_in, 10) - 30) * 1000,
    };

    return data.access_token;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[M-Pesa] Token request error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Initiate an STK Push (Lipa Na M-Pesa Online) request.
 *
 * This sends a prompt to the customer's phone asking them to confirm payment
 * via their M-Pesa PIN. The result is asynchronous — use check-mpesa endpoint
 * to poll for status, or rely on the webhook callback.
 *
 * @param phone     - Phone number in format 254XXXXXXXXX (no + or spaces)
 * @param amount    - Amount to charge in KES (integer)
 * @param bookingId - Styra booking ID (used as account reference)
 * @param paymentId - Styra payment ID (used as transaction description)
 * @returns MpesaStkPushResult, or null if not configured / error
 */
export async function initiateStkPush(
  phone: string,
  amount: number,
  bookingId: string,
  paymentId: string
): Promise<MpesaStkPushResult | null> {
  const token = await getMpesaAccessToken();
  if (!token) {
    return null;
  }

  // Normalize phone number: remove +, spaces, leading 0
  let normalizedPhone = phone.replace(/[\s+]/g, '');
  if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
    normalizedPhone = `254${normalizedPhone.slice(1)}`;
  }
  // If starts with 7 or 1 (9 digits), prepend 254
  if (normalizedPhone.length === 9 && (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1'))) {
    normalizedPhone = `254${normalizedPhone}`;
  }

  if (!/^254\d{9}$/.test(normalizedPhone)) {
    console.error(`[M-Pesa] Invalid phone format: ${phone}. Expected 254XXXXXXXXX`);
    return null;
  }

  const timestamp = getTimestamp();
  const password = generateStkPassword();
  const callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/mpesa`;

  try {
    const response = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount), // M-Pesa requires integer amount
        PartyA: normalizedPhone,
        PartyB: process.env.MPESA_BUSINESS_SHORTCODE,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: `STY-${bookingId.slice(0, 8)}`,
        TransactionDesc: `Styra ${paymentId.slice(0, 8)}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[M-Pesa] STK Push failed (${response.status}): ${errorText}`);
      return null;
    }

    const data: MpesaStkPushResponse = await response.json();

    // ResponseCode "0" means the request was accepted
    if (data.ResponseCode !== '0') {
      console.error(`[M-Pesa] STK Push rejected: ${data.ResponseDescription}`);
      return null;
    }

    return {
      checkoutRequestID: data.CheckoutRequestID,
      merchantRequestID: data.MerchantRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[M-Pesa] STK Push error: ${error.message}`);
    }
    return null;
  }
}

// ── B2C Helpers ────────────────────────────────────────────────────────────

/**
 * Check if B2C-specific environment variables are configured.
 * B2C requires the base M-Pesa config plus initiator name and callback URL.
 */
function isB2CConfigured(): boolean {
  if (!isConfigured()) return false;
  return !!(
    process.env.MPESA_B2C_INITIATOR_NAME ||
    process.env.MPESA_ENV === 'sandbox' // Sandbox has default initiator
  ) && !!process.env.MPESA_B2C_RESULT_URL;
}

/**
 * Normalize a Kenyan phone number to the 254XXXXXXXXX format required by M-Pesa.
 */
function normalizeMpesaPhone(phone: string): string | null {
  let normalized = phone.replace(/[\s+\-()]/g, '');

  // 07XXXXXXXX or 01XXXXXXXX (10 digits with leading 0)
  if (normalized.startsWith('0') && normalized.length === 10) {
    normalized = `254${normalized.slice(1)}`;
  }
  // 7XXXXXXXX or 1XXXXXXXX (9 digits without leading 0)
  if (normalized.length === 9 && (normalized.startsWith('7') || normalized.startsWith('1'))) {
    normalized = `254${normalized}`;
  }
  // +254XXXXXXXXX
  if (normalized.startsWith('+254')) {
    normalized = normalized.slice(1);
  }

  if (!/^254\d{9}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

// ── B2C Public API ─────────────────────────────────────────────────────────

/**
 * Initiate an M-Pesa B2C (Business to Customer) payout.
 *
 * This sends money from the business M-Pesa account to a customer's phone.
 * Used by the payout engine to disburse provider earnings.
 *
 * IMPORTANT:
 *   - M-Pesa B2C requires Safaricom production approval — not available in sandbox
 *     without explicit approval. Sandbox will accept the request but won't actually
 *     transfer funds.
 *   - The B2C API is asynchronous. The initial response indicates acceptance;
 *     final result comes via the ResultURL callback.
 *   - SecurityCredential must be generated by encrypting the initiator password
 *     with the M-Pesa public key (production only).
 *
 * @see https://developer.safaricom.co.ke/docs?shell#b2c-api
 *
 * @param params.phoneNumber - Recipient phone number (any common format accepted)
 * @param params.amount      - Amount to send in KES (integer)
 * @param params.remarks     - Description of the payout
 * @param params.occasion    - Optional occasion (e.g. "Salary", "Service payment")
 * @param params.commandID   - B2C command type (default: 'BusinessPayment')
 * @returns MpesaB2CResult with success status and transaction ID (or error message)
 */
export async function initiateMpesaB2C(params: MpesaB2CParams): Promise<MpesaB2CResult> {
  // 1. Validate B2C configuration
  if (!isB2CConfigured()) {
    return {
      success: false,
      message: 'M-Pesa B2C is not configured. Set MPESA_B2C_INITIATOR_NAME and MPESA_B2C_RESULT_URL.',
    };
  }

  // 2. Get access token
  const token = await getMpesaAccessToken();
  if (!token) {
    return { success: false, message: 'Failed to get M-Pesa access token' };
  }

  // 3. Normalize phone to 254XXXXXXXXX format
  const normalizedPhone = normalizeMpesaPhone(params.phoneNumber);
  if (!normalizedPhone) {
    return {
      success: false,
      message: `Invalid phone number format: ${params.phoneNumber}. Expected 254XXXXXXXXX.`,
    };
  }

  // 4. Build request parameters
  const initiatorName = process.env.MPESA_B2C_INITIATOR_NAME || 'test_api38';
  const resultUrl = process.env.MPESA_B2C_RESULT_URL!;
  // SecurityCredential is required in production; sandbox uses a default
  const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL || '';
  const shortcode = process.env.MPESA_BUSINESS_SHORTCODE!;
  const commandID = params.commandID || 'BusinessPayment';

  // Generate a unique conversation ID for tracing
  const originatorConversationID = crypto.randomUUID();

  const requestBody = {
    OriginatorConversationID: originatorConversationID,
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: commandID,
    Amount: Math.round(params.amount),
    PartyA: shortcode,
    PartyB: normalizedPhone,
    Remarks: params.remarks.slice(0, 100), // M-Pesa limits remarks to 100 chars
    QueueTimeOutURL: `${resultUrl}/timeout`,
    ResultURL: `${resultUrl}/result`,
    Occasion: (params.occasion || '').slice(0, 100),
  };

  // 5. Determine API URL based on environment
  const baseUrl = getBaseUrl();
  const b2cEndpoint = `${baseUrl}/mpesa/b2c/v3/paymentrequest`;

  try {
    console.log(
      `[M-Pesa B2C] Initiating payout: ${normalizedPhone} amount=${params.amount} ` +
      `commandID=${commandID} conversationID=${originatorConversationID}`,
    );

    const response = await fetch(b2cEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[M-Pesa B2C] Request failed (${response.status}): ${responseText}`);
      return {
        success: false,
        message: `M-Pesa B2C API returned ${response.status}: ${responseText}`,
      };
    }

    const data: MpesaB2CResponse = JSON.parse(responseText);

    // ResponseCode "0" means the request was accepted for processing
    if (data.ResponseCode !== '0') {
      console.error(
        `[M-Pesa B2C] Rejected: code=${data.ResponseCode} desc=${data.ResponseDescription}`,
      );
      return {
        success: false,
        message: data.ResponseDescription || `M-Pesa B2C rejected with code ${data.ResponseCode}`,
      };
    }

    console.log(
      `[M-Pesa B2C] Accepted: conversationID=${data.ConversationID} ` +
      `originatorConversationID=${data.OriginatorConversationID}`,
    );

    return {
      success: true,
      transactionId: data.ConversationID,
      message: data.ResponseDescription || 'B2C payout request accepted',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[M-Pesa B2C] Error: ${message}`);
    return {
      success: false,
      message: `M-Pesa B2C request failed: ${message}`,
    };
  }
}
