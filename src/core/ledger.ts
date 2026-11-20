import type { Shares } from './money';
import type { AccountKind, JournalKind } from './statuses';

export interface AccountRef {
  kind: AccountKind;
  /** Only for PROVIDER_BALANCE */
  businessId?: string;
}

export interface Line {
  account: AccountRef;
  /** Required on ESCROW lines */
  bookingId?: string;
  /** Debit positive, credit negative, never zero */
  amount: bigint;
}

export interface Journal {
  kind: JournalKind;
  idempotencyKey: string;
  lines: Line[];
}

function positive(amount: bigint, what: string): bigint {
  if (amount <= 0n) throw new RangeError(`${what} must be positive`);
  return amount;
}

export function assertBalanced(j: Journal): void {
  if (j.lines.length < 2) throw new Error(`journal ${j.idempotencyKey} needs at least two lines`);
  if (j.lines.some((l) => l.amount === 0n)) throw new Error(`journal ${j.idempotencyKey} has a zero line`);
  const total = j.lines.reduce((a, l) => a + l.amount, 0n);
  if (total !== 0n) throw new Error(`journal ${j.idempotencyKey} is unbalanced by ${total}`);
}

function journal(kind: JournalKind, idempotencyKey: string, lines: Line[]): Journal {
  const j = { kind, idempotencyKey, lines };
  assertBalanced(j);
  return j;
}

export function captureJournal(a: { paymentId: string; bookingId: string; amount: bigint }): Journal {
  const p = positive(a.amount, 'capture amount');
  return journal('CAPTURE', `capture:${a.paymentId}`, [
    { account: { kind: 'PSP_CLEARING' }, amount: p },
    { account: { kind: 'ESCROW' }, bookingId: a.bookingId, amount: -p },
  ]);
}

export function settlementJournal(a: { bookingId: string; businessId: string; shares: Shares }): Journal {
  const { refund, fee, provider } = a.shares;
  const price = positive(refund + fee + provider, 'settlement price');
  const lines: Line[] = [{ account: { kind: 'ESCROW' }, bookingId: a.bookingId, amount: price }];
  if (refund > 0n) lines.push({ account: { kind: 'REFUND_PENDING' }, amount: -refund });
  if (fee > 0n) lines.push({ account: { kind: 'PLATFORM_REVENUE' }, amount: -fee });
  if (provider > 0n) lines.push({ account: { kind: 'PROVIDER_BALANCE', businessId: a.businessId }, amount: -provider });
  return journal('SETTLEMENT', `settle:${a.bookingId}`, lines);
}

export function refundPaidJournal(a: { refundId: string; amount: bigint }): Journal {
  const r = positive(a.amount, 'refund amount');
  return journal('REFUND_PAID', `refund-paid:${a.refundId}`, [
    { account: { kind: 'REFUND_PENDING' }, amount: r },
    { account: { kind: 'PSP_CLEARING' }, amount: -r },
  ]);
}

export function payoutRequestJournal(a: { payoutId: string; businessId: string; amount: bigint }): Journal {
  const x = positive(a.amount, 'payout amount');
  return journal('PAYOUT_REQUEST', `payout-request:${a.payoutId}`, [
    { account: { kind: 'PROVIDER_BALANCE', businessId: a.businessId }, amount: x },
    { account: { kind: 'PAYOUT_PENDING' }, amount: -x },
  ]);
}

export function payoutPaidJournal(a: { payoutId: string; amount: bigint }): Journal {
  const x = positive(a.amount, 'payout amount');
  return journal('PAYOUT_PAID', `payout-paid:${a.payoutId}`, [
    { account: { kind: 'PAYOUT_PENDING' }, amount: x },
    { account: { kind: 'PSP_CLEARING' }, amount: -x },
  ]);
}

export function payoutFailedJournal(a: { payoutId: string; businessId: string; amount: bigint }): Journal {
  const x = positive(a.amount, 'payout amount');
  return journal('PAYOUT_FAILED', `payout-failed:${a.payoutId}`, [
    { account: { kind: 'PAYOUT_PENDING' }, amount: x },
    { account: { kind: 'PROVIDER_BALANCE', businessId: a.businessId }, amount: -x },
  ]);
}
