/**
 * Every status list in v2. UPPERCASE, and identical to the CHECK constraints in
 * supabase/migrations (tests/db compares them).
 */
export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DISPUTED', 'VERIFIED', 'CANCELLED', 'EXPIRED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ESCROW_STATES = ['NONE', 'HELD', 'SETTLED'] as const;
export type EscrowState = (typeof ESCROW_STATES)[number];

export const USER_ROLES = ['CUSTOMER', 'PROVIDER', 'ADMIN'] as const;
export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export const BUSINESS_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED'] as const;
export const PAYMENT_PROVIDERS = ['MPESA', 'PAYSTACK', 'STRIPE', 'PAYPAL', 'FAKE'] as const;
export const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
export const ACCOUNT_KINDS = ['PSP_CLEARING', 'ESCROW', 'PROVIDER_BALANCE', 'PAYOUT_PENDING', 'REFUND_PENDING', 'PLATFORM_REVENUE'] as const;
export const JOURNAL_KINDS = ['CAPTURE', 'SETTLEMENT', 'REFUND_PAID', 'PAYOUT_REQUEST', 'PAYOUT_PAID', 'PAYOUT_FAILED', 'ADJUSTMENT'] as const;
export const REFUND_STATUSES = ['PENDING', 'SUBMITTED', 'PAID', 'FAILED'] as const;
export const PAYOUT_STATUSES = ['REQUESTED', 'PROCESSING', 'PAID', 'FAILED'] as const;
export const PAYOUT_METHODS = ['MPESA', 'BANK'] as const;
export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED'] as const;
export const DISPUTE_OUTCOMES = ['RELEASE', 'REFUND', 'SPLIT'] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export type JournalKind = (typeof JOURNAL_KINDS)[number];

/** Allowed (status, escrow_state) pairs (blueprint section 4). */
const ALLOWED: Record<BookingStatus, readonly EscrowState[]> = {
  PENDING: ['NONE'],
  EXPIRED: ['NONE'],
  CONFIRMED: ['HELD'],
  COMPLETED: ['HELD'],
  NO_SHOW: ['HELD'],
  DISPUTED: ['HELD'],
  VERIFIED: ['SETTLED'],
  CANCELLED: ['NONE', 'SETTLED'],
};

export function isAllowedCombination(status: BookingStatus, escrow: EscrowState): boolean {
  return ALLOWED[status].includes(escrow);
}

export const ALLOWED_COMBINATIONS = ALLOWED;

/** The escrow state a transition result leaves the booking in. */
export function escrowStateFor(result: { to: BookingStatus; effect: { kind: string } }): EscrowState {
  switch (result.effect.kind) {
    case 'CAPTURE':
      return 'HELD';
    case 'SETTLE':
    case 'CAPTURE_THEN_SETTLE':
      return 'SETTLED';
    default:
      // No money moved: PENDING->EXPIRED/CANCELLED stay NONE; the rest stay HELD.
      return ALLOWED[result.to][0];
  }
}
