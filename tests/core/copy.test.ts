import { describe, expect, test } from 'bun:test';
import en from '../../copy/en.json';
import { bookingStatusLabel, t } from '../../src/core/copy';
import { BOOKING_STATUSES } from '../../src/core/statuses';

const BANNED = [/\bplease\b/i, /successfully/i, /!/, /\boops\b/i, /\bpremium\b/i, /\bluxury\b/i, /world-class/i, /\bescrow\b/i, /\bledger\b/i, /\bwebhook/i, /\bsettle/i, /\bidempoten/i];
const flat = (o: any, p = ''): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)));

describe('copy catalogue', () => {
  test('the motto is exact', () => {
    expect(t('brand.motto')).toBe('Your Style, On Demand.');
  });
  test('no banned words, system words or exclamation marks (one allowed at booking confirmed)', () => {
    for (const [key, value] of flat(en)) {
      if (key === 'booking.confirmed.celebrate') continue;
      for (const re of BANNED) expect(value, key).not.toMatch(re);
    }
  });
  test('interpolates variables', () => {
    expect(t('checkout.payNow', { amount: 'KSh 1,500' })).toBe('Pay KSh 1,500 now. We hold it until your service is done.');
  });
  test('missing keys fail loudly in tests', () => {
    expect(() => t('nope.missing' as never)).toThrow();
  });
  test('every booking status has a customer and a provider label', () => {
    for (const s of BOOKING_STATUSES) {
      expect(bookingStatusLabel(s, 'CUSTOMER').length).toBeGreaterThan(0);
      expect(bookingStatusLabel(s, 'PROVIDER').length).toBeGreaterThan(0);
    }
    expect(bookingStatusLabel('COMPLETED', 'CUSTOMER')).toBe('Confirm your service');
    expect(bookingStatusLabel('CONFIRMED', 'PROVIDER')).toBe('Confirmed, payment held');
  });
  test('every API error code has a message', () => {
    const codes = ['VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'FORBIDDEN_ORIGIN', 'NOT_FOUND', 'EMAIL_TAKEN', 'PHONE_TAKEN', 'INVALID_CREDENTIALS', 'ACCOUNT_SUSPENDED', 'BUSINESS_EXISTS', 'NO_BUSINESS', 'SLOT_TAKEN', 'SLOT_IN_PAST', 'HOLD_EXPIRED', 'INVALID_STATE', 'PAYMENT_MISMATCH', 'PROVIDER_UNAVAILABLE', 'ALREADY_REVIEWED', 'INSUFFICIENT_BALANCE', 'BELOW_MINIMUM', 'SERVER_ERROR'];
    for (const c of codes) expect((en as any).errors[c], c).toBeString();
  });
  test('buttons are sentence case and never "Submit" or "OK"', () => {
    for (const [, v] of flat((en as any).actions)) {
      expect(v).not.toMatch(/^(Submit|OK|Click here)$/);
      expect(v[0]).toBe(v[0].toUpperCase());
      expect(v.slice(1)).not.toMatch(/\s[A-Z][a-z]/); // no Title Case after the first word (M-Pesa is fine)
    }
  });
});
