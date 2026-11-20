import { describe, expect, test } from 'bun:test';
import { transition, InvalidTransition, type BookingEvent } from '../../src/core/booking-machine';
import { BOOKING_STATUSES, escrowStateFor, isAllowedCombination, type BookingStatus } from '../../src/core/statuses';

describe('Appendix D transitions', () => {
  const rows: [BookingStatus, BookingEvent, BookingStatus, string][] = [
    ['PENDING', { type: 'PAYMENT_CAPTURED' }, 'CONFIRMED', 'CAPTURE'],
    ['PENDING', { type: 'HOLD_EXPIRED' }, 'EXPIRED', 'NONE'],
    ['PENDING', { type: 'CUSTOMER_CANCELLED', refundBps: 10000 }, 'CANCELLED', 'NONE'],
    ['EXPIRED', { type: 'PAYMENT_CAPTURED' }, 'CANCELLED', 'CAPTURE_THEN_SETTLE'],
    ['CANCELLED', { type: 'PAYMENT_CAPTURED' }, 'CANCELLED', 'CAPTURE_THEN_SETTLE'],
    ['CONFIRMED', { type: 'PROVIDER_DECLINED' }, 'CANCELLED', 'SETTLE'],
    ['CONFIRMED', { type: 'PROVIDER_CANCELLED' }, 'CANCELLED', 'SETTLE'],
    ['CONFIRMED', { type: 'ADMIN_CANCELLED' }, 'CANCELLED', 'SETTLE'],
    ['CONFIRMED', { type: 'CUSTOMER_CANCELLED', refundBps: 5000 }, 'CANCELLED', 'SETTLE'],
    ['CONFIRMED', { type: 'PROVIDER_COMPLETED' }, 'COMPLETED', 'NONE'],
    ['CONFIRMED', { type: 'PROVIDER_NO_SHOW' }, 'NO_SHOW', 'NONE'],
    ['COMPLETED', { type: 'CUSTOMER_CONFIRMED' }, 'VERIFIED', 'SETTLE'],
    ['COMPLETED', { type: 'WINDOW_ELAPSED' }, 'VERIFIED', 'SETTLE'],
    ['NO_SHOW', { type: 'CUSTOMER_CONFIRMED' }, 'VERIFIED', 'SETTLE'],
    ['NO_SHOW', { type: 'WINDOW_ELAPSED' }, 'VERIFIED', 'SETTLE'],
    ['COMPLETED', { type: 'DISPUTE_OPENED' }, 'DISPUTED', 'NONE'],
    ['NO_SHOW', { type: 'DISPUTE_OPENED' }, 'DISPUTED', 'NONE'],
    ['DISPUTED', { type: 'DISPUTE_RESOLVED_RELEASE' }, 'VERIFIED', 'SETTLE'],
    ['DISPUTED', { type: 'DISPUTE_RESOLVED_REFUND' }, 'CANCELLED', 'SETTLE'],
    ['DISPUTED', { type: 'DISPUTE_RESOLVED_SPLIT', refundBps: 2500 }, 'VERIFIED', 'SETTLE'],
  ];
  for (const [from, ev, to, effect] of rows) {
    test(`${from} --${ev.type}--> ${to} (${effect})`, () => {
      const r = transition(from, ev);
      expect(r.to).toBe(to);
      expect(r.effect.kind).toBe(effect);
    });
  }

  test('settlement shapes follow the event', () => {
    expect(transition('CONFIRMED', { type: 'PROVIDER_DECLINED' }).effect).toEqual({ kind: 'SETTLE', shape: { kind: 'REFUND' } });
    expect(transition('COMPLETED', { type: 'CUSTOMER_CONFIRMED' }).effect).toEqual({ kind: 'SETTLE', shape: { kind: 'RELEASE' } });
    expect(transition('CONFIRMED', { type: 'CUSTOMER_CANCELLED', refundBps: 5000 }).effect).toEqual({ kind: 'SETTLE', shape: { kind: 'SPLIT', refundBps: 5000 } });
    expect(transition('DISPUTED', { type: 'DISPUTE_RESOLVED_SPLIT', refundBps: 2500 }).effect).toEqual({ kind: 'SETTLE', shape: { kind: 'SPLIT', refundBps: 2500 } });
    expect(transition('EXPIRED', { type: 'PAYMENT_CAPTURED' }).effect).toEqual({ kind: 'CAPTURE_THEN_SETTLE', shape: { kind: 'REFUND' } });
  });

  test('every resulting status agrees with its escrow state', () => {
    for (const [from, ev] of rows) {
      const r = transition(from, ev);
      expect(isAllowedCombination(r.to, escrowStateFor(r))).toBe(true);
    }
  });
});

describe('invalid transitions', () => {
  const events: BookingEvent[] = [
    { type: 'PAYMENT_CAPTURED' }, { type: 'HOLD_EXPIRED' }, { type: 'CUSTOMER_CANCELLED', refundBps: 10000 },
    { type: 'PROVIDER_DECLINED' }, { type: 'PROVIDER_CANCELLED' }, { type: 'ADMIN_CANCELLED' },
    { type: 'PROVIDER_COMPLETED' }, { type: 'PROVIDER_NO_SHOW' }, { type: 'CUSTOMER_CONFIRMED' },
    { type: 'WINDOW_ELAPSED' }, { type: 'DISPUTE_OPENED' }, { type: 'DISPUTE_RESOLVED_RELEASE' },
    { type: 'DISPUTE_RESOLVED_REFUND' }, { type: 'DISPUTE_RESOLVED_SPLIT', refundBps: 5000 },
  ];
  test('VERIFIED is terminal', () => {
    for (const ev of events) expect(() => transition('VERIFIED', ev)).toThrow(InvalidTransition);
  });
  test('EXPIRED and CANCELLED accept only a late payment', () => {
    for (const s of ['EXPIRED', 'CANCELLED'] as const)
      for (const ev of events.filter((e) => e.type !== 'PAYMENT_CAPTURED')) expect(() => transition(s, ev)).toThrow(InvalidTransition);
  });
  test('a sample of other invalid moves', () => {
    expect(() => transition('PENDING', { type: 'PROVIDER_COMPLETED' })).toThrow(InvalidTransition);
    expect(() => transition('CONFIRMED', { type: 'PAYMENT_CAPTURED' })).toThrow(InvalidTransition);
    expect(() => transition('CONFIRMED', { type: 'CUSTOMER_CONFIRMED' })).toThrow(InvalidTransition);
    expect(() => transition('COMPLETED', { type: 'CUSTOMER_CANCELLED', refundBps: 0 })).toThrow(InvalidTransition);
    expect(() => transition('DISPUTED', { type: 'WINDOW_ELAPSED' })).toThrow(InvalidTransition);
  });
  test('the status list is complete and uppercase', () => {
    expect([...BOOKING_STATUSES].sort()).toEqual(['CANCELLED', 'COMPLETED', 'CONFIRMED', 'DISPUTED', 'EXPIRED', 'NO_SHOW', 'PENDING', 'VERIFIED']);
  });
});
