import { describe, expect, test } from 'bun:test';
import { formatDate, formatDateTime, formatDuration, formatPhone, formatRating, formatRelative, formatTime, toE164 } from '../../src/core/format';

// 2026-11-22 is a Sunday. Nairobi is UTC+3.
const now = new Date('2026-11-20T09:00:00Z');

describe('time and date (Nairobi)', () => {
  test('12-hour time with lowercase am/pm', () => {
    expect(formatTime(new Date('2026-11-22T11:30:00Z'))).toBe('2:30 pm');
    expect(formatTime(new Date('2026-11-22T06:05:00Z'))).toBe('9:05 am');
    expect(formatTime(new Date('2026-11-22T21:00:00Z'))).toBe('12:00 am');
    expect(formatTime(new Date('2026-11-22T09:00:00Z'))).toBe('12:00 pm');
  });
  test('date without the year in the current year, with it otherwise', () => {
    expect(formatDate(new Date('2026-11-22T11:30:00Z'), now)).toBe('Sun 22 Nov');
    expect(formatDate(new Date('2027-01-02T11:30:00Z'), now)).toBe('Sat 2 Jan 2027');
  });
  test('date and time together', () => {
    expect(formatDateTime(new Date('2026-11-22T11:30:00Z'), now)).toBe('Sun 22 Nov, 2:30 pm');
  });
  test('relative only inside 24 hours', () => {
    expect(formatRelative(new Date(now.getTime() + 2 * 3600_000), now)).toBe('in 2 hours');
    expect(formatRelative(new Date(now.getTime() + 45 * 60_000), now)).toBe('in 45 minutes');
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000), now)).toBe('3 hours ago');
    expect(formatRelative(new Date(now.getTime() + 30 * 3600_000), now)).toBe('Sat 21 Nov, 6:00 pm');
  });
});

describe('durations, phones, ratings', () => {
  test('durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
  });
  test('Kenyan phones on screen and in storage', () => {
    expect(formatPhone('+254712345678')).toBe('0712 345 678');
    expect(formatPhone('0712345678')).toBe('0712 345 678');
    expect(toE164('0712 345 678')).toBe('+254712345678');
    expect(toE164('712345678')).toBe('+254712345678');
    expect(toE164('+254 112 345 678')).toBe('+254112345678');
    expect(toE164('12345')).toBeNull();
  });
  test('rating', () => {
    expect(formatRating(4.8, 120)).toBe('4.8 (120)');
    expect(formatRating(5, 1)).toBe('5.0 (1)');
    expect(formatRating(0, 0)).toBe('New');
  });
});
