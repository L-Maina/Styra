import { describe, expect, test } from 'bun:test';
import { captureJournal, settlementJournal, refundPaidJournal, payoutRequestJournal, payoutPaidJournal, payoutFailedJournal, assertBalanced, type Journal } from '../../src/core/ledger';
import { settlementShares } from '../../src/core/money';

const sum = (j: Journal) => j.lines.reduce((a, l) => a + l.amount, 0n);
const B = 'booking-1', BIZ = 'biz-1', P = 150000n;

describe('journal recipes (Appendix C)', () => {
  test('capture: clearing +P, escrow -P, keyed by payment', () => {
    const j = captureJournal({ paymentId: 'pay-1', bookingId: B, amount: P });
    expect(j.kind).toBe('CAPTURE');
    expect(j.idempotencyKey).toBe('capture:pay-1');
    expect(j.lines).toEqual([
      { account: { kind: 'PSP_CLEARING' }, amount: P },
      { account: { kind: 'ESCROW' }, bookingId: B, amount: -P },
    ]);
  });
  test('settlement on release omits the zero refund line', () => {
    const j = settlementJournal({ bookingId: B, businessId: BIZ, shares: settlementShares(P, { kind: 'RELEASE' }, 1000) });
    expect(j.idempotencyKey).toBe('settle:booking-1');
    expect(j.lines).toEqual([
      { account: { kind: 'ESCROW' }, bookingId: B, amount: P },
      { account: { kind: 'PLATFORM_REVENUE' }, amount: -15000n },
      { account: { kind: 'PROVIDER_BALANCE', businessId: BIZ }, amount: -135000n },
    ]);
  });
  test('settlement on full refund has only escrow and refund lines', () => {
    const j = settlementJournal({ bookingId: B, businessId: BIZ, shares: settlementShares(P, { kind: 'REFUND' }, 1000) });
    expect(j.lines.map((l) => l.account.kind)).toEqual(['ESCROW', 'REFUND_PENDING']);
  });
  test('every recipe balances', () => {
    const shapes = [{ kind: 'RELEASE' }, { kind: 'REFUND' }, { kind: 'SPLIT', refundBps: 3333 }] as const;
    const js: Journal[] = [
      captureJournal({ paymentId: 'p', bookingId: B, amount: 7n }),
      ...shapes.map((s) => settlementJournal({ bookingId: B, businessId: BIZ, shares: settlementShares(9999n, s, 1000) })),
      refundPaidJournal({ refundId: 'r', amount: 500n }),
      payoutRequestJournal({ payoutId: 'po', businessId: BIZ, amount: 100n }),
      payoutPaidJournal({ payoutId: 'po', amount: 100n }),
      payoutFailedJournal({ payoutId: 'po', businessId: BIZ, amount: 100n }),
    ];
    for (const j of js) { expect(sum(j)).toBe(0n); expect(() => assertBalanced(j)).not.toThrow(); }
  });
  test('payout keys are distinct per step', () => {
    expect(payoutRequestJournal({ payoutId: 'x', businessId: BIZ, amount: 1n }).idempotencyKey).toBe('payout-request:x');
    expect(payoutPaidJournal({ payoutId: 'x', amount: 1n }).idempotencyKey).toBe('payout-paid:x');
    expect(payoutFailedJournal({ payoutId: 'x', businessId: BIZ, amount: 1n }).idempotencyKey).toBe('payout-failed:x');
  });
  test('assertBalanced rejects unbalanced, single-line and zero lines', () => {
    expect(() => assertBalanced({ kind: 'ADJUSTMENT', idempotencyKey: 'k', lines: [{ account: { kind: 'PSP_CLEARING' }, amount: 1n }, { account: { kind: 'PLATFORM_REVENUE' }, amount: -2n }] })).toThrow();
    expect(() => assertBalanced({ kind: 'ADJUSTMENT', idempotencyKey: 'k', lines: [{ account: { kind: 'PSP_CLEARING' }, amount: 0n }] })).toThrow();
    expect(() => assertBalanced({ kind: 'ADJUSTMENT', idempotencyKey: 'k', lines: [{ account: { kind: 'PSP_CLEARING' }, amount: 0n }, { account: { kind: 'PLATFORM_REVENUE' }, amount: 0n }] })).toThrow();
  });
  test('amounts must be positive', () => {
    expect(() => captureJournal({ paymentId: 'p', bookingId: B, amount: 0n })).toThrow();
    expect(() => refundPaidJournal({ refundId: 'r', amount: -1n })).toThrow();
  });
});
