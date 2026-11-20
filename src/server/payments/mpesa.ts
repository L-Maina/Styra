/**
 * Safaricom Daraja: STK push (Lipa na M-Pesa Online). Callbacks are not signed by Safaricom, so the
 * callback URL carries an HMAC token per payment and only known CheckoutRequestIDs are accepted.
 * Env: MPESA_ENV (sandbox | production), MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE,
 * MPESA_PASSKEY, MPESA_CALLBACK_SECRET, APP_URL.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { toE164 } from '../../core/format';

export const mpesaConfigured = () =>
  ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_SECRET'].every((k) => Boolean(process.env[k]));

const base = () => (process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');

/** YYYYMMDDHHmmss in Nairobi time, as Daraja expects. */
export function mpesaTimestamp(d: Date): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d)) p[x.type] = x.value;
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}

export const mpesaPassword = (shortcode: string, passkey: string, timestamp: string) => Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

/** 2547XXXXXXXX / 2541XXXXXXXX, or null. */
export function mpesaPhone(input: string): string | null {
  const e164 = toE164(input);
  return e164 ? e164.slice(1) : null;
}

export const callbackToken = (paymentId: string, secret: string) => createHmac('sha256', secret).update(`mpesa:${paymentId}`).digest('hex');

export function verifyCallbackToken(paymentId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(callbackToken(paymentId, secret));
  const got = Buffer.from(token);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export type MpesaCallback =
  | { eventId: string; checkoutRequestId: string; status: 'SUCCEEDED'; receipt: string; amountMinor: bigint; currency: 'KES' }
  | { eventId: string; checkoutRequestId: string; status: 'FAILED'; reason: string };

export function parseMpesaCallback(body: unknown): MpesaCallback | null {
  const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } } | null)?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== 'string' || typeof cb.ResultCode !== 'number') return null;
  const id = cb.CheckoutRequestID;
  if (cb.ResultCode !== 0) return { eventId: id, checkoutRequestId: id, status: 'FAILED', reason: String(cb.ResultDesc ?? `ResultCode ${cb.ResultCode}`) };
  const items = ((cb.CallbackMetadata as { Item?: { Name: string; Value?: unknown }[] } | undefined)?.Item ?? []).reduce<Record<string, unknown>>(
    (acc, i) => ((acc[i.Name] = i.Value), acc),
    {},
  );
  const amount = Number(items.Amount);
  if (!Number.isFinite(amount) || typeof items.MpesaReceiptNumber !== 'string') return null;
  // Daraja amounts are whole shillings.
  return { eventId: id, checkoutRequestId: id, status: 'SUCCEEDED', receipt: items.MpesaReceiptNumber, amountMinor: BigInt(Math.round(amount)) * 100n, currency: 'KES' };
}

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`mpesa oauth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Sends the STK prompt. Returns the CheckoutRequestID, stored as the payment's provider_ref. */
export async function startStkPush(a: { paymentId: string; amountMinor: bigint; phone: string; reference: string; now: Date }): Promise<{ checkoutRequestId: string }> {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const timestamp = mpesaTimestamp(a.now);
  const callback = `${process.env.APP_URL}/api/v2/webhooks/mpesa?payment=${a.paymentId}&token=${callbackToken(a.paymentId, process.env.MPESA_CALLBACK_SECRET!)}`;
  const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: mpesaPassword(shortcode, process.env.MPESA_PASSKEY!, timestamp),
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(a.amountMinor / 100n),
      PartyA: a.phone,
      PartyB: shortcode,
      PhoneNumber: a.phone,
      CallBackURL: callback,
      AccountReference: a.reference,
      TransactionDesc: `Styra ${a.reference}`,
    }),
  });
  const json = (await res.json()) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string };
  if (!res.ok || json.ResponseCode !== '0' || !json.CheckoutRequestID) throw new Error(`mpesa stk ${res.status} ${json.errorMessage ?? ''}`.trim());
  return { checkoutRequestId: json.CheckoutRequestID };
}
