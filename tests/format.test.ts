import { describe, expect, test } from 'bun:test';
import { formatRating, pluralNoun, pluralize } from '@/lib/format';

describe('pluralize', () => {
  test('uses the singular only for exactly one', () => {
    expect(pluralize(1, 'service')).toBe('1 service');
    expect(pluralize(0, 'service')).toBe('0 services');
    expect(pluralize(2, 'service')).toBe('2 services');
  });

  test('takes an explicit plural when adding an s is wrong', () => {
    expect(pluralize(1, 'business', 'businesses')).toBe('1 business');
    expect(pluralize(3, 'business', 'businesses')).toBe('3 businesses');
  });

  test('pluralNoun gives the word without the number', () => {
    expect(pluralNoun(1, 'Service Provider', 'Service Providers')).toBe('Service Provider');
    expect(pluralNoun(8, 'Booking Made', 'Bookings Made')).toBe('Bookings Made');
  });
});

describe('formatRating', () => {
  test('always shows one decimal', () => {
    expect(formatRating(4)).toBe('4.0');
    expect(formatRating(4.26)).toBe('4.3');
    expect(formatRating('3.5')).toBe('3.5');
  });

  test('falls back to 0.0 for anything that is not a number', () => {
    expect(formatRating(null)).toBe('0.0');
    expect(formatRating(undefined)).toBe('0.0');
    expect(formatRating(Number.NaN)).toBe('0.0');
    expect(formatRating('n/a')).toBe('0.0');
  });
});
