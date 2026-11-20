import { describe, expect, test } from 'bun:test';
import { customerRefundBps, DEFAULT_SETTINGS, verificationDeadline, holdExpiresAt } from '../../src/core/policy';

const policy = DEFAULT_SETTINGS.cancellationPolicy;
const start = new Date('2026-12-01T10:00:00Z');
const hoursBefore = (h: number) => new Date(start.getTime() - h * 3600_000);

describe('customer cancellation tiers', () => {
  test('24 h or more before start: full refund', () => {
    expect(customerRefundBps(policy, start, hoursBefore(24))).toBe(10000);
    expect(customerRefundBps(policy, start, hoursBefore(72))).toBe(10000);
  });
  test('just under 24 h: half', () => {
    expect(customerRefundBps(policy, start, new Date(hoursBefore(24).getTime() + 1))).toBe(5000);
  });
  test('4 h exactly: half; just under: nothing', () => {
    expect(customerRefundBps(policy, start, hoursBefore(4))).toBe(5000);
    expect(customerRefundBps(policy, start, new Date(hoursBefore(4).getTime() + 1))).toBe(0);
  });
  test('at or after the start: nothing', () => {
    expect(customerRefundBps(policy, start, start)).toBe(0);
    expect(customerRefundBps(policy, start, new Date(start.getTime() + 60_000))).toBe(0);
  });
  test('unsorted policies are sorted first', () => {
    const shuffled = [policy[2], policy[0], policy[1]];
    expect(customerRefundBps(shuffled, start, hoursBefore(30))).toBe(10000);
  });
});

describe('windows', () => {
  test('verification deadline is completed + 24 h', () => {
    expect(verificationDeadline(new Date('2026-12-01T10:00:00Z'), 24).toISOString()).toBe('2026-12-02T10:00:00.000Z');
  });
  test('hold expires after 15 minutes', () => {
    expect(holdExpiresAt(new Date('2026-12-01T10:00:00Z'), 15).toISOString()).toBe('2026-12-01T10:15:00.000Z');
  });
  test('defaults match the blueprint', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ commissionBps: 1000, verificationWindowHours: 24, holdMinutes: 15, payoutMinMinor: 10000n });
  });
});
