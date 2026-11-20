import { describe, expect, test } from 'bun:test';
import { commission, formatMoney, parseMoney, settlementShares } from '../../src/core/money';

describe('formatMoney', () => {
  test('whole shillings have no decimals and use KSh', () => {
    expect(formatMoney(150000n)).toBe('KSh 1,500');
  });
  test('cents are shown when present', () => {
    expect(formatMoney(150050n)).toBe('KSh 1,500.50');
  });
  test('zero and large amounts', () => {
    expect(formatMoney(0n)).toBe('KSh 0');
    expect(formatMoney(123456789900n)).toBe('KSh 1,234,567,899');
  });
  test('negative amounts keep the sign in front', () => {
    expect(formatMoney(-2500n)).toBe('-KSh 25');
  });
  test('code style for receipts and the ledger', () => {
    expect(formatMoney(150000n, { style: 'code' })).toBe('KES 1,500.00');
  });
});

describe('parseMoney', () => {
  test('parses shillings with separators into minor units', () => {
    expect(parseMoney('1,500')).toBe(150000n);
    expect(parseMoney('1500.5')).toBe(150050n);
    expect(parseMoney('0.07')).toBe(7n);
  });
  test('rejects more than two decimals, negatives and junk', () => {
    expect(() => parseMoney('1.234')).toThrow();
    expect(() => parseMoney('-5')).toThrow();
    expect(() => parseMoney('abc')).toThrow();
    expect(() => parseMoney('')).toThrow();
  });
});

describe('commission (round half up)', () => {
  test('10% of 1,500', () => expect(commission(150000n, 1000)).toBe(15000n));
  test('rounds half up at the boundary', () => {
    expect(commission(5n, 1000)).toBe(1n); // 0.5 -> 1
    expect(commission(4n, 1000)).toBe(0n); // 0.4 -> 0
    expect(commission(15n, 1000)).toBe(2n); // 1.5 -> 2
  });
  test('zero bps and full bps', () => {
    expect(commission(999n, 0)).toBe(0n);
    expect(commission(999n, 10000)).toBe(999n);
  });
  test('handles amounts beyond Number precision', () => {
    expect(commission(9007199254740993n, 1000)).toBe(900719925474099n);
  });
  test('rejects bps outside 0..10000', () => {
    expect(() => commission(100n, -1)).toThrow();
    expect(() => commission(100n, 10001)).toThrow();
  });
});

describe('settlementShares', () => {
  const P = 150000n;
  const sum = (s: { refund: bigint; fee: bigint; provider: bigint }) => s.refund + s.fee + s.provider;
  test('release: no refund, fee, provider gets the rest', () => {
    expect(settlementShares(P, { kind: 'RELEASE' }, 1000)).toEqual({ refund: 0n, fee: 15000n, provider: 135000n });
  });
  test('refund: everything back to the customer', () => {
    expect(settlementShares(P, { kind: 'REFUND' }, 1000)).toEqual({ refund: P, fee: 0n, provider: 0n });
  });
  test('split: refund share first, fee on the rest', () => {
    expect(settlementShares(P, { kind: 'SPLIT', refundBps: 5000 }, 1000)).toEqual({ refund: 75000n, fee: 7500n, provider: 67500n });
  });
  test('every shape sums to the price, including odd amounts', () => {
    for (const p of [1n, 7n, 99n, 150001n, 9999999n]) {
      for (const shape of [{ kind: 'RELEASE' }, { kind: 'REFUND' }, { kind: 'SPLIT', refundBps: 3333 }, { kind: 'SPLIT', refundBps: 0 }, { kind: 'SPLIT', refundBps: 10000 }] as const) {
        const s = settlementShares(p, shape, 1000);
        expect(sum(s)).toBe(p);
        expect(s.refund >= 0n && s.fee >= 0n && s.provider >= 0n).toBe(true);
      }
    }
  });
  test('rejects a non-positive price', () => {
    expect(() => settlementShares(0n, { kind: 'RELEASE' }, 1000)).toThrow();
  });
});
