import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { callbackToken, mpesaPassword, mpesaPhone, mpesaTimestamp, parseMpesaCallback } from '../../src/server/payments/mpesa';
import { parsePaystackWebhook } from '../../src/server/payments/paystack';

describe('M-Pesa Daraja', () => {
  test('timestamp is YYYYMMDDHHmmss in Nairobi time', () => {
    expect(mpesaTimestamp(new Date('2026-11-20T09:05:07Z'))).toBe('20261120120507');
  });
  test('password is base64(shortcode + passkey + timestamp)', () => {
    expect(mpesaPassword('174379', 'passkey', '20261120120507')).toBe(Buffer.from('174379passkey20261120120507').toString('base64'));
  });
  test('phones become 2547XXXXXXXX; anything else is refused', () => {
    expect(mpesaPhone('0712 345 678')).toBe('254712345678');
    expect(mpesaPhone('+254112345678')).toBe('254112345678');
    expect(mpesaPhone('12345')).toBeNull();
  });
  test('callback token is an HMAC of the payment id and verifies only for that payment', () => {
    const a = callbackToken('pay-1', 'secret');
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(callbackToken('pay-1', 'secret')).toBe(a);
    expect(callbackToken('pay-2', 'secret')).not.toBe(a);
  });
  const success = {
    Body: {
      stkCallback: {
        MerchantRequestID: '29115-34620561-1',
        CheckoutRequestID: 'ws_CO_191220191020363925',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 600 },
            { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
            { Name: 'TransactionDate', Value: 20191219102115 },
            { Name: 'PhoneNumber', Value: 254708374149 },
          ],
        },
      },
    },
  };
  test('a successful callback parses to a captured payment in minor units', () => {
    expect(parseMpesaCallback(success)).toEqual({ eventId: 'ws_CO_191220191020363925', checkoutRequestId: 'ws_CO_191220191020363925', status: 'SUCCEEDED', receipt: 'NLJ7RT61SV', amountMinor: 60000n, currency: 'KES' });
  });
  test('a cancelled callback parses to failed with the reason', () => {
    const cancelled = { Body: { stkCallback: { MerchantRequestID: 'm', CheckoutRequestID: 'ws_CO_x', ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } };
    expect(parseMpesaCallback(cancelled)).toMatchObject({ eventId: 'ws_CO_x', status: 'FAILED', reason: 'Request cancelled by user' });
  });
  test('junk is refused', () => {
    expect(parseMpesaCallback({ nope: true })).toBeNull();
    expect(parseMpesaCallback(null)).toBeNull();
  });
});

describe('Paystack', () => {
  const secret = 'sk_test_example';
  const body = JSON.stringify({ event: 'charge.success', data: { id: 302961, reference: 'pay-uuid-1', amount: 150000, currency: 'KES', status: 'success' } });
  const sign = (raw: string, key = secret) => createHmac('sha512', key).update(raw).digest('hex');

  test('a correctly signed charge.success parses', () => {
    expect(parsePaystackWebhook({ 'x-paystack-signature': sign(body) }, body, secret)).toEqual({
      eventId: 'charge.success:302961',
      reference: 'pay-uuid-1',
      providerRef: '302961',
      status: 'SUCCEEDED',
      amountMinor: 150000n,
      currency: 'KES',
    });
  });
  test('a bad or missing signature is refused', () => {
    expect(parsePaystackWebhook({ 'x-paystack-signature': sign(body, 'other') }, body, secret)).toBeNull();
    expect(parsePaystackWebhook({}, body, secret)).toBeNull();
  });
  test('a tampered body is refused', () => {
    expect(parsePaystackWebhook({ 'x-paystack-signature': sign(body) }, body.replace('150000', '1'), secret)).toBeNull();
  });
  test('events other than charges are ignored (null)', () => {
    const other = JSON.stringify({ event: 'transfer.success', data: { id: 1 } });
    expect(parsePaystackWebhook({ 'x-paystack-signature': sign(other) }, other, secret)).toBeNull();
  });
});
