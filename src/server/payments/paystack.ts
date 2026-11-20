/**
 * Paystack card payments. Webhooks are signed: x-paystack-signature = HMAC-SHA512(secret key, raw body).
 * Env: PAYSTACK_SECRET_KEY, APP_URL.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const paystackConfigured = () => Boolean(process.env.PAYSTACK_SECRET_KEY);

export interface PaystackEvent {
  eventId: string;
  /** Our payment id, sent as the transaction reference */
  reference: string;
  providerRef: string;
  status: 'SUCCEEDED' | 'FAILED';
  amountMinor: bigint;
  currency: string;
}

export function verifyPaystackSignature(signature: string | null | undefined, rawBody: string, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(createHmac('sha512', secret).update(rawBody).digest('hex'));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function parsePaystackWebhook(headers: Record<string, string | null | undefined>, rawBody: string, secret: string): PaystackEvent | null {
  if (!verifyPaystackSignature(headers['x-paystack-signature'], rawBody, secret)) return null;
  let body: { event?: string; data?: { id?: number | string; reference?: string; amount?: number; currency?: string; status?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const d = body.data;
  if (!d || d.id == null || !d.reference) return null;
  if (body.event === 'charge.success') {
    return { eventId: `charge.success:${d.id}`, reference: d.reference, providerRef: String(d.id), status: 'SUCCEEDED', amountMinor: BigInt(d.amount ?? 0), currency: String(d.currency ?? '') };
  }
  if (body.event === 'charge.failed') {
    return { eventId: `charge.failed:${d.id}`, reference: d.reference, providerRef: String(d.id), status: 'FAILED', amountMinor: BigInt(d.amount ?? 0), currency: String(d.currency ?? '') };
  }
  return null;
}

/** Starts a hosted checkout. Returns the URL to send the customer to. */
export async function initializePaystack(a: { paymentId: string; amountMinor: bigint; email: string; currency: string; callbackUrl: string }): Promise<{ authorizationUrl: string; reference: string }> {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: a.email, amount: Number(a.amountMinor), currency: a.currency, reference: a.paymentId, callback_url: a.callbackUrl }),
  });
  const json = (await res.json()) as { status?: boolean; data?: { authorization_url: string; reference: string }; message?: string };
  if (!res.ok || !json.status || !json.data) throw new Error(`paystack init ${res.status} ${json.message ?? ''}`.trim());
  return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
}
