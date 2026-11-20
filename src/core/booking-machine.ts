import type { SettlementShape } from './money';
import type { BookingStatus } from './statuses';

export type BookingEvent =
  | { type: 'PAYMENT_CAPTURED' }
  | { type: 'HOLD_EXPIRED' }
  | { type: 'CUSTOMER_CANCELLED'; refundBps: number }
  | { type: 'PROVIDER_DECLINED' }
  | { type: 'PROVIDER_CANCELLED' }
  | { type: 'ADMIN_CANCELLED' }
  | { type: 'PROVIDER_COMPLETED' }
  | { type: 'PROVIDER_NO_SHOW' }
  | { type: 'CUSTOMER_CONFIRMED' }
  | { type: 'WINDOW_ELAPSED' }
  | { type: 'DISPUTE_OPENED' }
  | { type: 'DISPUTE_RESOLVED_RELEASE' }
  | { type: 'DISPUTE_RESOLVED_REFUND' }
  | { type: 'DISPUTE_RESOLVED_SPLIT'; refundBps: number };

export type MoneyEffect =
  | { kind: 'NONE' }
  | { kind: 'CAPTURE' }
  | { kind: 'SETTLE'; shape: SettlementShape }
  | { kind: 'CAPTURE_THEN_SETTLE'; shape: SettlementShape };

export interface TransitionResult {
  to: BookingStatus;
  effect: MoneyEffect;
}

export class InvalidTransition extends Error {
  constructor(readonly from: BookingStatus, readonly event: BookingEvent['type']) {
    super(`invalid booking transition: ${from} --${event}-->`);
    this.name = 'InvalidTransition';
  }
}

const NONE: MoneyEffect = { kind: 'NONE' };
const REFUND: SettlementShape = { kind: 'REFUND' };
const RELEASE: SettlementShape = { kind: 'RELEASE' };

/** Pure booking state machine (blueprint Appendix D). Throws InvalidTransition for anything not listed. */
export function transition(from: BookingStatus, event: BookingEvent): TransitionResult {
  const fail = (): never => {
    throw new InvalidTransition(from, event.type);
  };
  switch (from) {
    case 'PENDING':
      if (event.type === 'PAYMENT_CAPTURED') return { to: 'CONFIRMED', effect: { kind: 'CAPTURE' } };
      if (event.type === 'HOLD_EXPIRED') return { to: 'EXPIRED', effect: NONE };
      if (event.type === 'CUSTOMER_CANCELLED') return { to: 'CANCELLED', effect: NONE };
      return fail();
    case 'EXPIRED':
    case 'CANCELLED':
      if (event.type === 'PAYMENT_CAPTURED') return { to: 'CANCELLED', effect: { kind: 'CAPTURE_THEN_SETTLE', shape: REFUND } };
      return fail();
    case 'CONFIRMED':
      switch (event.type) {
        case 'PROVIDER_DECLINED':
        case 'PROVIDER_CANCELLED':
        case 'ADMIN_CANCELLED':
          return { to: 'CANCELLED', effect: { kind: 'SETTLE', shape: REFUND } };
        case 'CUSTOMER_CANCELLED':
          return { to: 'CANCELLED', effect: { kind: 'SETTLE', shape: { kind: 'SPLIT', refundBps: event.refundBps } } };
        case 'PROVIDER_COMPLETED':
          return { to: 'COMPLETED', effect: NONE };
        case 'PROVIDER_NO_SHOW':
          return { to: 'NO_SHOW', effect: NONE };
        default:
          return fail();
      }
    case 'COMPLETED':
    case 'NO_SHOW':
      if (event.type === 'CUSTOMER_CONFIRMED' || event.type === 'WINDOW_ELAPSED') return { to: 'VERIFIED', effect: { kind: 'SETTLE', shape: RELEASE } };
      if (event.type === 'DISPUTE_OPENED') return { to: 'DISPUTED', effect: NONE };
      return fail();
    case 'DISPUTED':
      if (event.type === 'DISPUTE_RESOLVED_RELEASE') return { to: 'VERIFIED', effect: { kind: 'SETTLE', shape: RELEASE } };
      if (event.type === 'DISPUTE_RESOLVED_REFUND') return { to: 'CANCELLED', effect: { kind: 'SETTLE', shape: REFUND } };
      if (event.type === 'DISPUTE_RESOLVED_SPLIT') return { to: 'VERIFIED', effect: { kind: 'SETTLE', shape: { kind: 'SPLIT', refundBps: event.refundBps } } };
      return fail();
    case 'VERIFIED':
      return fail();
  }
}
