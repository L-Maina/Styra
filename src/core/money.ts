/**
 * Money is always an integer number of minor units (cents) held in a `bigint`.
 * Never use floats or `number` for money maths (blueprint R1).
 */

export type Minor = bigint;

const BPS_DENOMINATOR = 10000n;

function assertBps(bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
    throw new RangeError(`basis points must be an integer between 0 and 10000, got ${bps}`);
  }
  return BigInt(bps);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export type FormatStyle = 'display' | 'code';

/**
 * `display`: "KSh 1,500" (no decimals for whole shillings) for screens.
 * `code`: "KES 1,500.00" for receipts, exports and the ledger.
 */
export function formatMoney(minor: Minor, opts: { currency?: string; style?: FormatStyle } = {}): string {
  const currency = opts.currency ?? 'KES';
  const style = opts.style ?? 'display';
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = groupThousands((abs / 100n).toString());
  const cents = (abs % 100n).toString().padStart(2, '0');
  const symbol = style === 'code' ? currency : currency === 'KES' ? 'KSh' : currency;
  const body = style === 'code' || cents !== '00' ? `${whole}.${cents}` : whole;
  return `${negative ? '-' : ''}${symbol} ${body}`;
}

/** Parses a user-entered amount in major units ("1,500", "1500.5") into minor units. */
export function parseMoney(input: string): Minor {
  const cleaned = input.trim().replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new RangeError(`not a valid amount: "${input}"`);
  const whole = BigInt(match[1]);
  const cents = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  return whole * 100n + cents;
}

/** `floor((x * bps + 5000) / 10000)`: round half up (blueprint Appendix E). */
export function commission(amount: Minor, bps: number): Minor {
  const b = assertBps(bps);
  if (amount < 0n) throw new RangeError('commission amount must not be negative');
  return (amount * b + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR;
}

export type SettlementShape =
  | { kind: 'RELEASE' }
  | { kind: 'REFUND' }
  | { kind: 'SPLIT'; refundBps: number };

export interface Shares {
  /** R: owed back to the customer */
  refund: Minor;
  /** F: Styra fee */
  fee: Minor;
  /** V: the provider's share */
  provider: Minor;
}

/** Splits a held price into refund, fee and provider shares. Always sums to the price. */
export function settlementShares(price: Minor, shape: SettlementShape, commissionBps: number): Shares {
  if (price <= 0n) throw new RangeError('price must be positive');
  switch (shape.kind) {
    case 'RELEASE': {
      const fee = commission(price, commissionBps);
      return { refund: 0n, fee, provider: price - fee };
    }
    case 'REFUND':
      return { refund: price, fee: 0n, provider: 0n };
    case 'SPLIT': {
      const refund = (price * assertBps(shape.refundBps)) / BPS_DENOMINATOR;
      const rest = price - refund;
      const fee = commission(rest, commissionBps);
      return { refund, fee, provider: rest - fee };
    }
  }
}
