/**
 * PayPal REST API Client
 *
 * Lightweight PayPal integration using native fetch() — no third-party SDK.
 * Supports:
 *   - OAuth2 client credentials token
 *   - Order creation (CAPTURE intent) with service + platform fee line items
 *   - Order capture
 *
 * All functions return null when env vars are not configured (dev mode fallback).
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface PayPalAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

export interface PayPalOrderResult {
  orderId: string;
  approveUrl: string;
}

export interface PayPalCaptureResult {
  captureId: string;
  status: string;
  amount: string;
  currency: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function isConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// Token cache to avoid requesting a new access token on every call
let tokenCache: { token: string; expiresAt: number } | null = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Obtain an OAuth2 access token from PayPal using client credentials grant.
 * Results are cached in-memory until expiry.
 *
 * @returns Bearer token string, or null if PayPal is not configured
 */
export async function getPayPalAccessToken(): Promise<string | null> {
  if (!isConfigured()) {
    return null;
  }

  // Return cached token if still valid (with 60s safety margin)
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  try {
    const base64 = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${base64}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PayPal] Token request failed (${response.status}): ${errorText}`);
      return null;
    }

    const data: PayPalAccessTokenResponse = await response.json();

    // Cache for the token lifetime minus 60s safety margin
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[PayPal] Token request error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Create a PayPal order with CAPTURE intent.
 *
 * The order contains two line items:
 *   1. Service amount (the actual booking cost)
 *   2. Platform fee (separate line item for transparency)
 *
 * @param amount    - Total service amount (e.g. 50.00)
 * @param currency  - ISO 4217 currency code (e.g. "USD")
 * @param bookingId - Styra booking ID (stored in PayPal order metadata)
 * @param paymentId - Styra payment ID (stored in PayPal order metadata)
 * @returns PayPalOrderResult with orderId + approveUrl, or null if not configured / error
 */
export async function createPayPalOrder(
  amount: number,
  currency: string,
  bookingId: string,
  paymentId: string
): Promise<PayPalOrderResult | null> {
  const token = await getPayPalAccessToken();
  if (!token) {
    return null;
  }

  // Platform fee is 5% of the service amount (minimum $1)
  const platformFee = Math.max(1, parseFloat((amount * 0.05).toFixed(2)));
  const totalAmount = parseFloat((amount + platformFee).toFixed(2));

  try {
    const response = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: bookingId,
            description: `Styra Booking ${bookingId}`,
            custom_id: paymentId,
            amount: {
              currency_code: currency.toUpperCase(),
              value: totalAmount.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: currency.toUpperCase(),
                  value: totalAmount.toFixed(2),
                },
              },
            },
            items: [
              {
                name: 'Service Fee',
                unit_amount: {
                  currency_code: currency.toUpperCase(),
                  value: amount.toFixed(2),
                },
                quantity: '1',
                category: 'DIGITAL_GOODS',
              },
              {
                name: 'Platform Fee',
                unit_amount: {
                  currency_code: currency.toUpperCase(),
                  value: platformFee.toFixed(2),
                },
                quantity: '1',
                category: 'DIGITAL_GOODS',
              },
            ],
          },
        ],
        application_context: {
          brand_name: 'Styra',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/capture-paypal`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PayPal] Order creation failed (${response.status}): ${errorText}`);
      return null;
    }

    const data: PayPalOrderResponse = await response.json();

    // Extract the approval link from the HATEOAS links
    const approveLink = data.links.find((link) => link.rel === 'approve');
    if (!approveLink) {
      console.error('[PayPal] No approval link found in order response');
      return null;
    }

    return {
      orderId: data.id,
      approveUrl: approveLink.href,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[PayPal] Order creation error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Capture an approved PayPal order.
 *
 * Call this after the customer approves payment on the PayPal side.
 * The webhook (PAYMENT.CAPTURE.COMPLETED) will also fire — the capture
 * endpoint provides a synchronous confirmation as a backup.
 *
 * @param orderId - PayPal order ID returned from createPayPalOrder
 * @returns PayPalCaptureResult, or null if not configured / error
 */
export async function capturePayPalOrder(
  orderId: string
): Promise<PayPalCaptureResult | null> {
  const token = await getPayPalAccessToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `${getBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PayPal] Order capture failed (${response.status}): ${errorText}`);
      return null;
    }

    const data: PayPalCaptureResponse = await response.json();

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) {
      console.error('[PayPal] No capture details found in response');
      return null;
    }

    return {
      captureId: capture.id,
      status: capture.status,
      amount: capture.amount.value,
      currency: capture.amount.currency_code,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[PayPal] Order capture error: ${error.message}`);
    }
    return null;
  }
}
