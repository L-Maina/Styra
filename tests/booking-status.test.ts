import { describe, expect, test } from 'bun:test';
import {
  BookingStatus,
  VERIFICATION_WINDOW_HOURS,
  bookingStatusMeta,
  isDone,
  isUpcoming,
  verificationDeadline,
} from '@/lib/booking-status';

describe('verificationDeadline', () => {
  test('is 24 hours after completedAt', () => {
    const deadline = verificationDeadline({ completedAt: '2026-01-10T08:00:00.000Z' });
    expect(deadline?.toISOString()).toBe('2026-01-11T08:00:00.000Z');
    expect(VERIFICATION_WINDOW_HOURS).toBe(24);
  });

  test('falls back to updatedAt for older rows without completedAt', () => {
    const deadline = verificationDeadline({ completedAt: null, updatedAt: new Date('2026-01-10T08:00:00.000Z') });
    expect(deadline?.toISOString()).toBe('2026-01-11T08:00:00.000Z');
  });

  test('is null when there is no usable date', () => {
    expect(verificationDeadline({})).toBeNull();
    expect(verificationDeadline({ completedAt: 'not a date' })).toBeNull();
  });
});

describe('status groups', () => {
  test('upcoming covers pending, confirmed and in progress, in either case', () => {
    expect(isUpcoming('pending')).toBe(true);
    expect(isUpcoming('CONFIRMED')).toBe(true);
    expect(isUpcoming('in_progress')).toBe(true);
    expect(isUpcoming(BookingStatus.COMPLETED)).toBe(false);
  });

  test('done covers completed and verified only', () => {
    expect(isDone('completed')).toBe(true);
    expect(isDone('VERIFIED')).toBe(true);
    expect(isDone(BookingStatus.DISPUTED)).toBe(false);
    expect(isDone(BookingStatus.CANCELLED)).toBe(false);
  });
});

describe('bookingStatusMeta', () => {
  test('gives every known status a label and tone, including older lowercase rows', () => {
    for (const status of Object.values(BookingStatus)) {
      const meta = bookingStatusMeta(status);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(bookingStatusMeta(status.toLowerCase())).toEqual(meta);
    }
  });

  test('uses customer-friendly words for the escrow states', () => {
    expect(bookingStatusMeta(BookingStatus.COMPLETED).label).toBe('Awaiting confirmation');
    expect(bookingStatusMeta(BookingStatus.VERIFIED).label).toBe('Completed');
    expect(bookingStatusMeta(BookingStatus.DISPUTED).tone).toBe('warning');
  });

  test('falls back to readable text for an unknown status', () => {
    expect(bookingStatusMeta('on_hold')).toEqual({ label: 'On hold', tone: 'neutral' });
    expect(bookingStatusMeta(null)).toEqual({ label: 'Unknown', tone: 'neutral' });
  });
});
