/**
 * Escrow ledger
 *
 * One ESCROW_HELD PlatformTransaction per booking is the source of truth for where the
 * customer's money is. Its escrowStatus moves through a small state machine:
 *
 *   HELD ──release──▶ RELEASED
 *   HELD ──dispute──▶ DISPUTED ──release──▶ RELEASED
 *   HELD / DISPUTED ──refund──▶ REFUNDED          (or a split: RELEASED with a trimmed amount)
 *   RELEASED ──dispute──▶ DISPUTED                (funds are pulled back into pending)
 *   RELEASED ──refund──▶ REFUNDED                 (clawback from the provider's balance)
 *
 * The provider's wallet follows the state:
 *   HELD / DISPUTED  →  wallet.pendingBalance holds the provider's share
 *   RELEASED         →  wallet.balance holds it (withdrawable)
 *
 * Every transition is ONE database transaction: a compare-and-swap on escrowStatus (so two
 * concurrent requests cannot both win), the wallet move, and the ledger rows. Notifications
 * and TransactionLog entries are written after the commit and never block or undo a transfer.
 *
 * The *InTx functions let a caller (booking verification, dispute resolution) put its own
 * changes in the same transaction, so a booking is never marked VERIFIED while its money is
 * still held.
 *
 * NOTE: refunds here update the ledger only. Nothing in this module sends money back through
 * Stripe, Paystack, PayPal or M-Pesa; admins are alerted to do that (see afterRefund).
 */

import { db } from '@/lib/db';
import { logTransaction } from '@/lib/transaction-log';
import { AppError } from '@/lib/app-error';
import { BookingStatus, isStatus } from '@/lib/booking-status';
import type { Prisma, PlatformTransaction } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

// ── Constants ──────────────────────────────────────────────────────────────

export const ESCROW_STATUS = {
  HELD: 'HELD',
  DISPUTED: 'DISPUTED',
  RELEASED: 'RELEASED',
  REFUNDED: 'REFUNDED',
} as const;

/** Escrow states in which the provider's share sits in wallet.pendingBalance. */
const OPEN_STATUSES: string[] = [ESCROW_STATUS.HELD, ESCROW_STATUS.DISPUTED];

/** Options for interactive transactions (the default 5s timeout is tight on pooled connections). */
export const TX_OPTIONS = { maxWait: 5000, timeout: 20000 };

/** Half a cent: tolerance for floating point drift in wallet balances. */
const EPSILON = 0.005;

const money = (amount: number): number => Math.round(amount * 100) / 100;
const short = (id: string): string => id.slice(0, 8);
export const formatMoney = (currency: string, amount: number): string => `${currency} ${amount.toFixed(2)}`;

// ── Errors ─────────────────────────────────────────────────────────────────

export type EscrowErrorCode =
  | 'NO_ESCROW'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'INCONSISTENT'
  | 'INVALID_INPUT';

const ERROR_STATUS: Record<EscrowErrorCode, number> = {
  NO_ESCROW: 404,
  INVALID_STATE: 409,
  CONFLICT: 409,
  INCONSISTENT: 500,
  INVALID_INPUT: 400,
};

export class EscrowError extends AppError {
  readonly escrowCode: EscrowErrorCode;

  constructor(escrowCode: EscrowErrorCode, message: string) {
    super(message, ERROR_STATUS[escrowCode], escrowCode);
    this.name = 'EscrowError';
    this.escrowCode = escrowCode;
  }
}

function failInconsistent(bookingId: string, detail: string): never {
  console.error(`[Escrow] Inconsistent state for booking ${bookingId}: ${detail}`);
  throw new EscrowError(
    'INCONSISTENT',
    'This payment needs a manual check by support before funds can move.',
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface EscrowHoldResult {
  success: boolean;
  transaction: PlatformTransaction;
  providerAmount: number;
  platformFee: number;
}

export interface EscrowReleaseResult {
  success: boolean;
  transaction: PlatformTransaction;
  releasedAmount: number;
}

export interface EscrowRefundResult {
  success: boolean;
  transaction: PlatformTransaction;
  /** Gross amount that goes back to the customer. */
  refundAmount: number;
}

export interface EscrowStatusInfo {
  bookingId: string;
  escrowStatus: string | null;
  amount: number;
  providerAmount: number;
  platformFee: number;
  heldAt: Date | null;
  releasedAt: Date | null;
  transaction: PlatformTransaction | null;
}

export interface EscrowSummary {
  totalHeld: number;
  totalReleased: number;
  totalRefunded: number;
  totalDisputed: number;
  heldCount: number;
  releasedCount: number;
  refundedCount: number;
  disputedCount: number;
}

/** What a release, refund or split did to the ledger. */
export interface EscrowSettlement {
  kind: 'RELEASED' | 'REFUNDED' | 'SPLIT';
  /** True when the escrow was already in this state, so nothing moved. */
  alreadySettled: boolean;
  /** The escrow row after the change. */
  transaction: PlatformTransaction;
  providerUserId: string | null;
  /** Provider's share that ended up in their available balance. */
  releasedAmount: number;
  /** Gross money owed back to the customer. It still has to be sent through the payment provider. */
  refundAmount: number;
  /** True when money was taken back from the provider's available balance. */
  clawback: boolean;
  paymentId: string | null;
}

export interface EscrowDispute {
  transaction: PlatformTransaction;
  alreadyDisputed: boolean;
  /** True when released funds were pulled back into the provider's pending balance. */
  pulledBack: boolean;
}

interface HoldTxResult {
  created: boolean;
  duplicatePayment: boolean;
  /** The booking was already cancelled when the payment arrived, so nothing was credited. */
  lateForCancelled: boolean;
  transaction: PlatformTransaction;
  providerUserId: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function loadEscrow(tx: Tx, bookingId: string): Promise<PlatformTransaction | null> {
  return tx.platformTransaction.findFirst({
    where: { bookingId, type: 'ESCROW_HELD' },
    orderBy: { createdAt: 'desc' },
  });
}

function providerOf(row: PlatformTransaction, bookingId: string): string {
  if (!row.userId) failInconsistent(bookingId, 'escrow row has no provider user');
  return row.userId as string;
}

/**
 * Moves the escrow row out of one of the `from` states. The WHERE clause makes this a
 * compare-and-swap: if another request already changed the row, nothing matches and we stop.
 */
async function claimEscrow(
  tx: Tx,
  row: PlatformTransaction,
  from: string[],
  data: {
    escrowStatus: string;
    status?: string;
    amount?: number;
    platformFee?: number;
    providerAmount?: number;
    description: string;
    metadata?: string;
  },
): Promise<void> {
  const claimed = await tx.platformTransaction.updateMany({
    where: { id: row.id, escrowStatus: { in: from } },
    data: { ...data, completedAt: new Date() },
  });

  if (claimed.count !== 1) {
    throw new EscrowError(
      'CONFLICT',
      'This payment was just updated by another request. Please try again.',
    );
  }
}

/**
 * Writing to the wallet row takes a row lock until the transaction ends, so escrow work for
 * the same provider runs one transaction after the other. Also creates the wallet if missing.
 */
async function lockWallet(tx: Tx, userId: string): Promise<void> {
  await tx.wallet.upsert({
    where: { userId },
    create: { userId },
    update: { updatedAt: new Date() },
  });
}

/** Pending → available balance, only if the wallet really holds the amount in pending. */
async function pendingToBalance(
  tx: Tx,
  userId: string,
  amount: number,
  bookingId: string,
): Promise<void> {
  if (amount <= 0) return;
  const moved = await tx.wallet.updateMany({
    where: { userId, pendingBalance: { gte: amount - EPSILON } },
    data: { pendingBalance: { decrement: amount }, balance: { increment: amount } },
  });
  if (moved.count !== 1) {
    failInconsistent(bookingId, `pending balance is lower than the escrow share ${amount}`);
  }
}

/** Takes `amount` out of pending and puts `keep` of it into the available balance. */
async function settlePending(
  tx: Tx,
  userId: string,
  amount: number,
  keep: number,
  bookingId: string,
): Promise<void> {
  if (amount <= 0) return;
  const moved = await tx.wallet.updateMany({
    where: { userId, pendingBalance: { gte: amount - EPSILON } },
    data: {
      pendingBalance: { decrement: amount },
      ...(keep > 0 ? { balance: { increment: keep } } : {}),
    },
  });
  if (moved.count !== 1) {
    failInconsistent(bookingId, `pending balance is lower than the escrow share ${amount}`);
  }
}

/** Writes an in-app notification. Never throws: a failed notification must not undo a money move. */
export async function notifyUser(
  userId: string,
  title: string,
  message: string,
  link?: Record<string, unknown>,
  type: string = 'SYSTEM_ALERT',
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link: link ? JSON.stringify(link) : undefined,
      },
    });
  } catch (error) {
    console.error('[Escrow] Notification failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Keeps the legacy Payment row in step with the escrow ledger. Payment.escrowStatus defaults
 * to "held" and nothing used to update it, so every paid booking looked held forever.
 * A missing payment id or row is fine: updateMany simply matches nothing.
 */
async function syncPayment(
  tx: Tx,
  paymentId: string | null,
  data: { escrowStatus: string; status?: string; releasedAt?: Date; refundedAt?: Date },
): Promise<void> {
  if (!paymentId) return;
  await tx.payment.updateMany({ where: { id: paymentId }, data });
}

export async function alertAdmins(
  title: string,
  message: string,
  link?: Record<string, unknown>,
): Promise<void> {
  try {
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await Promise.all(admins.map((admin) => notifyUser(admin.id, title, message, link)));
  } catch (error) {
    console.error('[Escrow] Could not alert admins:', error instanceof Error ? error.message : error);
  }
}

// ── Hold ───────────────────────────────────────────────────────────────────

async function holdTx(
  tx: Tx,
  input: { bookingId: string; paymentId: string; amount: number; platformFee: number; currency: string },
): Promise<HoldTxResult> {
  const amount = money(input.amount);
  const platformFee = money(input.platformFee);
  const providerAmount = money(amount - platformFee);

  if (!(amount > 0)) {
    throw new EscrowError('INVALID_INPUT', 'Payment amount must be greater than zero.');
  }
  if (platformFee < 0 || providerAmount < 0) {
    throw new EscrowError('INVALID_INPUT', 'Platform fee exceeds payment amount.');
  }

  const booking = await tx.booking.findUnique({
    where: { id: input.bookingId },
    select: { businessId: true, status: true, business: { select: { ownerId: true } } },
  });
  if (!booking) {
    throw new AppError(`Booking not found: ${input.bookingId}`, 404);
  }

  const providerUserId = booking.business.ownerId;

  // Serialise concurrent holds for this provider, then check for an existing escrow row.
  await lockWallet(tx, providerUserId);

  const existing = await loadEscrow(tx, input.bookingId);
  if (existing) {
    return {
      created: false,
      // A different payment for a booking that already has escrow: the customer paid twice.
      duplicatePayment: existing.transactionId !== input.paymentId,
      lateForCancelled: false,
      transaction: existing,
      providerUserId,
    };
  }

  // A payment that clears after the booking was cancelled cannot be held for the provider.
  // It is recorded as refunded so the customer's money is tracked and admins can send it back.
  const late = isStatus(booking.status, BookingStatus.CANCELLED);

  const transaction = await tx.platformTransaction.create({
    data: {
      type: 'ESCROW_HELD',
      bookingId: input.bookingId,
      businessId: booking.businessId,
      userId: providerUserId,
      amount,
      platformFee,
      providerAmount,
      currency: input.currency,
      status: late ? 'REFUNDED' : 'COMPLETED',
      escrowStatus: late ? ESCROW_STATUS.REFUNDED : ESCROW_STATUS.HELD,
      transactionId: input.paymentId,
      description: late
        ? `Payment received after booking ${short(input.bookingId)} was cancelled: refund required`
        : `Escrow hold for booking ${short(input.bookingId)}`,
    },
  });

  if (late) {
    await syncPayment(tx, input.paymentId, {
      escrowStatus: 'refunded',
      status: 'refunded',
      refundedAt: new Date(),
    });
  } else {
    await tx.wallet.update({
      where: { userId: providerUserId },
      data: { pendingBalance: { increment: providerAmount } },
    });
  }

  return { created: true, duplicatePayment: false, lateForCancelled: late, transaction, providerUserId };
}

/**
 * Hold a customer's payment in escrow and credit the provider's pending balance.
 *
 * Idempotent per payment: the same paymentId (webhook retries, a webhook racing a client
 * capture) returns the existing row and never credits twice, whatever state it is in now.
 * A second, different payment for the same booking is NOT credited; admins are alerted
 * so it can be refunded.
 *
 * @param bookingId   - The booking ID
 * @param paymentId   - The payment ID (stored as the escrow row's transactionId)
 * @param amount      - Total payment amount
 * @param platformFee - Platform's fee (already calculated)
 */
export async function holdInEscrow(
  bookingId: string,
  paymentId: string,
  amount: number,
  platformFee: number,
  currency: string = 'KES',
): Promise<EscrowHoldResult> {
  const result = await db.$transaction(
    (tx) => holdTx(tx, { bookingId, paymentId, amount, platformFee, currency }),
    TX_OPTIONS,
  );

  if (result.created && result.lateForCancelled) {
    await alertAdmins(
      'Payment for a cancelled booking needs a refund',
      `Payment ${paymentId} (${formatMoney(currency, amount)}) arrived after booking ${short(bookingId)} was cancelled. The provider was not credited. Send the refund to the customer.`,
      { bookingId, paymentId, amount },
    );
  } else if (result.created) {
    await logTransaction({
      userId: result.providerUserId,
      bookingId,
      amount: result.transaction.providerAmount,
      type: 'ESCROW_HELD',
      status: 'COMPLETED',
      referenceId: result.transaction.id,
      metadata: {
        paymentId,
        totalAmount: result.transaction.amount,
        platformFee: result.transaction.platformFee,
        providerAmount: result.transaction.providerAmount,
      },
    });
  } else if (result.duplicatePayment) {
    await alertAdmins(
      'Duplicate payment needs a refund',
      `Booking ${short(bookingId)} already has escrow from another payment. Payment ${paymentId} (${formatMoney(currency, amount)}) was not credited to the provider and should be refunded to the customer.`,
      { bookingId, paymentId, amount },
    );
  }

  return {
    success: true,
    transaction: result.transaction,
    providerAmount: result.transaction.providerAmount,
    platformFee: result.transaction.platformFee,
  };
}

// ── Release ────────────────────────────────────────────────────────────────

/**
 * Release escrow to the provider inside the caller's transaction.
 * Returns null when the booking has no escrow row at all.
 * Throws when the money cannot be moved (refunded, inconsistent wallet, lost a race).
 */
export async function releaseInTx(
  tx: Tx,
  bookingId: string,
  reason: string,
): Promise<EscrowSettlement | null> {
  const row = await loadEscrow(tx, bookingId);
  if (!row) return null;

  if (row.escrowStatus === ESCROW_STATUS.RELEASED) {
    return {
      kind: 'RELEASED',
      alreadySettled: true,
      transaction: row,
      providerUserId: row.userId,
      releasedAmount: row.providerAmount,
      refundAmount: 0,
      clawback: false,
      paymentId: row.transactionId,
    };
  }

  if (row.escrowStatus === ESCROW_STATUS.REFUNDED) {
    throw new EscrowError(
      'INVALID_STATE',
      'This payment was already refunded to the customer, so it cannot be released.',
    );
  }

  if (row.escrowStatus !== ESCROW_STATUS.HELD && row.escrowStatus !== ESCROW_STATUS.DISPUTED) {
    failInconsistent(bookingId, `unexpected escrow status "${row.escrowStatus}"`);
  }

  const providerUserId = providerOf(row, bookingId);
  const description = `Escrow released: ${reason}`;

  await claimEscrow(tx, row, OPEN_STATUSES, { escrowStatus: ESCROW_STATUS.RELEASED, description });
  await pendingToBalance(tx, providerUserId, row.providerAmount, bookingId);
  await syncPayment(tx, row.transactionId, { escrowStatus: 'released', releasedAt: new Date() });

  // Revenue tracking row. A re-release after a dispute must not count the same revenue twice.
  const alreadyCounted = await tx.platformTransaction.findFirst({
    where: { bookingId, type: 'SERVICE_COMPLETED', status: 'COMPLETED' },
    select: { id: true },
  });
  if (!alreadyCounted) {
    await tx.platformTransaction.create({
      data: {
        type: 'SERVICE_COMPLETED',
        bookingId,
        businessId: row.businessId,
        userId: providerUserId,
        amount: row.amount,
        platformFee: row.platformFee,
        providerAmount: row.providerAmount,
        currency: row.currency,
        status: 'COMPLETED',
        escrowStatus: ESCROW_STATUS.RELEASED,
        description: `Service completed: ${reason}`,
        metadata: JSON.stringify({ escrowTransactionId: row.id, reason }),
      },
    });
  }

  return {
    kind: 'RELEASED',
    alreadySettled: false,
    transaction: { ...row, escrowStatus: ESCROW_STATUS.RELEASED, completedAt: new Date(), description },
    providerUserId,
    releasedAmount: row.providerAmount,
    refundAmount: 0,
    clawback: false,
    paymentId: row.transactionId,
  };
}

/** Logs and notifies after a release has been committed. Never throws. */
export async function afterRelease(
  bookingId: string,
  reason: string,
  settlement: EscrowSettlement,
): Promise<void> {
  if (settlement.alreadySettled || !settlement.providerUserId) return;
  const t = settlement.transaction;

  await logTransaction({
    userId: settlement.providerUserId,
    bookingId,
    amount: settlement.releasedAmount,
    type: 'SERVICE_COMPLETED',
    status: 'COMPLETED',
    referenceId: t.id,
    metadata: { reason, escrowTransactionId: t.id },
  });
  await logTransaction({
    userId: settlement.providerUserId,
    bookingId,
    amount: t.platformFee,
    type: 'PLATFORM_FEE',
    status: 'COMPLETED',
    referenceId: t.id,
    metadata: { reason },
  });
  await notifyUser(
    settlement.providerUserId,
    'Funds Released',
    `Payment for booking ${short(bookingId)} has been released to your wallet. Amount: ${formatMoney(t.currency, settlement.releasedAmount)}`,
    { bookingId, amount: settlement.releasedAmount, reason, transactionId: t.id },
  );
}

/**
 * Release escrow funds to the provider's available balance.
 * Called after verification (customer confirms, auto-verify) or by an admin.
 *
 * Moves wallet.pendingBalance → wallet.balance, atomically with the escrow state change.
 * Calling it again for an already released booking is a no-op that returns the same result.
 *
 * @param bookingId - The booking ID
 * @param reason    - Why the escrow was released (e.g. "Customer confirmed")
 */
export async function releaseFromEscrow(
  bookingId: string,
  reason: string,
): Promise<EscrowReleaseResult> {
  const settlement = await db.$transaction((tx) => releaseInTx(tx, bookingId, reason), TX_OPTIONS);

  if (!settlement) {
    throw new EscrowError('NO_ESCROW', `No escrow found for booking ${short(bookingId)}.`);
  }

  await afterRelease(bookingId, reason, settlement);

  return {
    success: true,
    transaction: settlement.transaction,
    releasedAmount: settlement.releasedAmount,
  };
}

// ── Refund / split ─────────────────────────────────────────────────────────

/**
 * Refund (all or part of) the escrow to the customer inside the caller's transaction.
 *
 *  - Full refund from HELD or DISPUTED: the provider's pending share is removed.
 *  - Full refund from RELEASED: clawback from the provider's available balance, which may go
 *    negative if they already withdrew. A negative balance blocks payouts until it is cleared.
 *  - Partial refund (dispute split) from HELD or DISPUTED: the customer gets `customerRefund`,
 *    the provider keeps the rest minus a proportional platform fee, and the escrow row is
 *    trimmed to what was actually settled so totals still add up.
 *
 * Returns null when the booking has no escrow row at all.
 */
export async function refundInTx(
  tx: Tx,
  bookingId: string,
  reason: string,
  opts: { amount?: number; fraction?: number } = {},
): Promise<EscrowSettlement | null> {
  const row = await loadEscrow(tx, bookingId);
  if (!row) return null;

  if (row.escrowStatus === ESCROW_STATUS.REFUNDED) {
    return {
      kind: 'REFUNDED',
      alreadySettled: true,
      transaction: row,
      providerUserId: row.userId,
      releasedAmount: 0,
      refundAmount: row.amount,
      clawback: false,
      paymentId: row.transactionId,
    };
  }

  const wasReleased = row.escrowStatus === ESCROW_STATUS.RELEASED;
  if (!wasReleased && row.escrowStatus !== ESCROW_STATUS.HELD && row.escrowStatus !== ESCROW_STATUS.DISPUTED) {
    failInconsistent(bookingId, `unexpected escrow status "${row.escrowStatus}"`);
  }

  const providerUserId = providerOf(row, bookingId);
  const total = money(row.amount);
  const requested =
    opts.amount !== undefined
      ? money(opts.amount)
      : opts.fraction !== undefined
        ? money(total * opts.fraction)
        : total;

  if (!(requested > 0) || requested > total + EPSILON) {
    throw new EscrowError('INVALID_INPUT', `Refund must be more than 0 and at most ${total}.`);
  }

  const isFull = requested >= total - EPSILON;
  const refund = isFull ? total : requested;

  if (!isFull && wasReleased) {
    throw new EscrowError(
      'INVALID_STATE',
      'Part of an already released payment cannot be refunded. Open a dispute first.',
    );
  }

  // What stays with the provider and the platform after a split.
  const keepAmount = isFull ? 0 : money(total - refund);
  const keepFee = isFull ? 0 : money(row.platformFee * (keepAmount / total));
  const keepProvider = isFull ? 0 : money(keepAmount - keepFee);
  const providerDeduct = isFull ? row.providerAmount : money(row.providerAmount - keepProvider);

  const now = new Date();
  let updated: PlatformTransaction;

  // Revenue recorded when the payment was released no longer stands once money goes back.
  await tx.platformTransaction.updateMany({
    where: { bookingId, type: 'SERVICE_COMPLETED', status: 'COMPLETED' },
    data: { status: 'REFUNDED' },
  });

  if (wasReleased) {
    // Clawback: the money is already in the provider's available balance.
    const description = `Refunded: ${reason}`;
    await claimEscrow(tx, row, [ESCROW_STATUS.RELEASED], {
      escrowStatus: ESCROW_STATUS.REFUNDED,
      status: 'REFUNDED',
      description,
    });
    await lockWallet(tx, providerUserId);
    await tx.wallet.update({
      where: { userId: providerUserId },
      data: { balance: { decrement: row.providerAmount } },
    });
    await syncPayment(tx, row.transactionId, { escrowStatus: 'refunded', status: 'refunded', refundedAt: now });
    updated = { ...row, escrowStatus: ESCROW_STATUS.REFUNDED, status: 'REFUNDED', completedAt: now, description };
  } else if (isFull) {
    const description = `Refunded: ${reason}`;
    await claimEscrow(tx, row, OPEN_STATUSES, {
      escrowStatus: ESCROW_STATUS.REFUNDED,
      status: 'REFUNDED',
      description,
    });
    await settlePending(tx, providerUserId, row.providerAmount, 0, bookingId);
    await syncPayment(tx, row.transactionId, { escrowStatus: 'refunded', status: 'refunded', refundedAt: now });
    updated = { ...row, escrowStatus: ESCROW_STATUS.REFUNDED, status: 'REFUNDED', completedAt: now, description };
  } else {
    // Split: trim the escrow row to the settled part and release that part to the provider.
    const description = `Partially refunded: ${reason}`;
    const metadata = JSON.stringify({
      originalAmount: total,
      originalPlatformFee: row.platformFee,
      originalProviderAmount: row.providerAmount,
      customerRefund: refund,
      reason,
    });
    await claimEscrow(tx, row, OPEN_STATUSES, {
      escrowStatus: ESCROW_STATUS.RELEASED,
      amount: keepAmount,
      platformFee: keepFee,
      providerAmount: keepProvider,
      description,
      metadata,
    });
    await settlePending(tx, providerUserId, row.providerAmount, keepProvider, bookingId);
    await syncPayment(tx, row.transactionId, { escrowStatus: 'released', releasedAt: now, refundedAt: now });
    await tx.platformTransaction.create({
      data: {
        type: 'SERVICE_COMPLETED',
        bookingId,
        businessId: row.businessId,
        userId: providerUserId,
        amount: keepAmount,
        platformFee: keepFee,
        providerAmount: keepProvider,
        currency: row.currency,
        status: 'COMPLETED',
        escrowStatus: ESCROW_STATUS.RELEASED,
        description: `Service completed (partial): ${reason}`,
        metadata: JSON.stringify({ escrowTransactionId: row.id, reason, customerRefund: refund }),
      },
    });
    updated = {
      ...row,
      escrowStatus: ESCROW_STATUS.RELEASED,
      amount: keepAmount,
      platformFee: keepFee,
      providerAmount: keepProvider,
      completedAt: now,
      description,
      metadata,
    };
  }

  await tx.platformTransaction.create({
    data: {
      type: 'REFUND',
      bookingId,
      businessId: row.businessId,
      userId: providerUserId,
      amount: refund,
      platformFee: 0,
      providerAmount: -providerDeduct,
      currency: row.currency,
      status: 'COMPLETED',
      description: `Refund to customer: ${reason}`,
      metadata: JSON.stringify({
        escrowTransactionId: row.id,
        reason,
        refundAmount: refund,
        split: !isFull,
        clawback: wasReleased,
      }),
    },
  });

  return {
    kind: isFull ? 'REFUNDED' : 'SPLIT',
    alreadySettled: false,
    transaction: updated,
    providerUserId,
    releasedAmount: keepProvider,
    refundAmount: refund,
    clawback: wasReleased,
    paymentId: row.transactionId,
  };
}

/**
 * Logs and alerts after a refund has been committed. Never throws.
 *
 * The ledger is updated, but nothing sends the money back through the payment provider.
 * Admins get an alert with the payment reference so the refund can be sent.
 */
export async function afterRefund(
  bookingId: string,
  reason: string,
  settlement: EscrowSettlement,
): Promise<void> {
  if (settlement.alreadySettled || settlement.refundAmount <= 0) return;
  const t = settlement.transaction;

  if (settlement.providerUserId) {
    await logTransaction({
      userId: settlement.providerUserId,
      bookingId,
      amount: -settlement.refundAmount,
      type: 'REFUND',
      status: 'COMPLETED',
      referenceId: t.id,
      metadata: {
        reason,
        escrowTransactionId: t.id,
        refundAmount: settlement.refundAmount,
        clawback: settlement.clawback,
        providerRefund: 'REQUIRED',
      },
    });

    if (settlement.clawback) {
      await notifyUser(
        settlement.providerUserId,
        'Payment Reversed',
        `A payment for booking ${short(bookingId)} was refunded to the customer after it had been released. ${formatMoney(t.currency, t.providerAmount)} was taken from your available balance.`,
        { bookingId, reason },
      );
    }
  }

  let paymentInfo = '';
  if (settlement.paymentId) {
    try {
      const payment = await db.payment.findUnique({
        where: { id: settlement.paymentId },
        select: { method: true, providerRef: true, transactionRef: true },
      });
      if (payment) {
        paymentInfo = ` Paid with ${payment.method}, reference ${payment.providerRef || payment.transactionRef}.`;
      }
    } catch {
      // The alert is still useful without the reference.
    }
  }

  await alertAdmins(
    'Customer refund to send',
    `Send ${formatMoney(t.currency, settlement.refundAmount)} back to the customer for booking ${short(bookingId)}.${paymentInfo} The escrow ledger is updated; nothing has been sent through the payment provider.`,
    { bookingId, refundAmount: settlement.refundAmount, paymentId: settlement.paymentId },
  );
}

/**
 * Refund escrow funds to the customer.
 *
 * @param bookingId - The booking ID
 * @param reason    - Why the refund was issued
 * @param options   - customerRefundAmount: refund only part of the payment (dispute split)
 */
export async function refundFromEscrow(
  bookingId: string,
  reason: string,
  options: { customerRefundAmount?: number } = {},
): Promise<EscrowRefundResult> {
  const settlement = await db.$transaction(
    (tx) => refundInTx(tx, bookingId, reason, { amount: options.customerRefundAmount }),
    TX_OPTIONS,
  );

  if (!settlement) {
    throw new EscrowError('NO_ESCROW', `No escrow found for booking ${short(bookingId)}.`);
  }

  await afterRefund(bookingId, reason, settlement);

  return {
    success: true,
    transaction: settlement.transaction,
    refundAmount: settlement.refundAmount,
  };
}

// ── Dispute ────────────────────────────────────────────────────────────────

/**
 * Freeze the escrow while a dispute is open, inside the caller's transaction.
 *
 * HELD → DISPUTED changes the status only; the money is already in pending.
 * RELEASED → DISPUTED pulls the provider's share back from available to pending (the
 * available balance may go negative if it was already withdrawn).
 *
 * Returns null when the booking has no escrow row at all.
 */
export async function disputeInTx(tx: Tx, bookingId: string): Promise<EscrowDispute | null> {
  const row = await loadEscrow(tx, bookingId);
  if (!row) return null;

  if (row.escrowStatus === ESCROW_STATUS.DISPUTED) {
    return { transaction: row, alreadyDisputed: true, pulledBack: false };
  }

  if (row.escrowStatus === ESCROW_STATUS.REFUNDED) {
    throw new EscrowError('INVALID_STATE', 'This payment was already refunded, so it cannot be disputed.');
  }

  const fromReleased = row.escrowStatus === ESCROW_STATUS.RELEASED;
  if (!fromReleased && row.escrowStatus !== ESCROW_STATUS.HELD) {
    failInconsistent(bookingId, `unexpected escrow status "${row.escrowStatus}"`);
  }

  const providerUserId = providerOf(row, bookingId);
  const description = 'Disputed: funds frozen until the dispute is resolved';

  await claimEscrow(tx, row, [row.escrowStatus as string], {
    escrowStatus: ESCROW_STATUS.DISPUTED,
    description,
  });

  if (fromReleased) {
    await lockWallet(tx, providerUserId);
    await tx.wallet.update({
      where: { userId: providerUserId },
      data: {
        balance: { decrement: row.providerAmount },
        pendingBalance: { increment: row.providerAmount },
      },
    });
  }
  await syncPayment(tx, row.transactionId, { escrowStatus: 'disputed' });

  return {
    transaction: { ...row, escrowStatus: ESCROW_STATUS.DISPUTED, description },
    alreadyDisputed: false,
    pulledBack: fromReleased,
  };
}

/** Freeze the escrow for a dispute. Returns null when the booking has no escrow. */
export async function disputeEscrow(bookingId: string): Promise<EscrowDispute | null> {
  return db.$transaction((tx) => disputeInTx(tx, bookingId), TX_OPTIONS);
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Get the current escrow status for a booking.
 *
 * @param bookingId - The booking ID
 */
export async function getEscrowStatus(bookingId: string): Promise<EscrowStatusInfo> {
  const transaction = await db.platformTransaction.findFirst({
    where: { bookingId, type: 'ESCROW_HELD' },
    orderBy: { createdAt: 'desc' },
  });

  if (!transaction) {
    return {
      bookingId,
      escrowStatus: null,
      amount: 0,
      providerAmount: 0,
      platformFee: 0,
      heldAt: null,
      releasedAt: null,
      transaction: null,
    };
  }

  return {
    bookingId,
    escrowStatus: transaction.escrowStatus || null,
    amount: transaction.amount,
    providerAmount: transaction.providerAmount,
    platformFee: transaction.platformFee,
    heldAt: transaction.createdAt,
    releasedAt: transaction.completedAt || null,
    transaction,
  };
}

/**
 * Get aggregate escrow summary for admin dashboards.
 */
export async function getEscrowSummary(): Promise<EscrowSummary> {
  const [held, released, refunded, disputed] = await Promise.all([
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: ESCROW_STATUS.HELD },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: ESCROW_STATUS.RELEASED },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: ESCROW_STATUS.REFUNDED },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: ESCROW_STATUS.DISPUTED },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  return {
    totalHeld: held._sum.amount || 0,
    totalReleased: released._sum.amount || 0,
    totalRefunded: refunded._sum.amount || 0,
    totalDisputed: disputed._sum.amount || 0,
    heldCount: held._count.id || 0,
    releasedCount: released._count.id || 0,
    refundedCount: refunded._count.id || 0,
    disputedCount: disputed._count.id || 0,
  };
}

/**
 * Calculate platform fee for a given amount.
 * Reads the platformFee percentage from PlatformSetting (default 15%).
 *
 * @param amount - The gross payment amount
 * @returns The platform fee amount
 */
export async function calculatePlatformFee(amount: number): Promise<number> {
  const setting = await db.platformSetting.findFirst({ where: { key: 'platformFee' } });

  const feePercentage = setting ? parseFloat(setting.value) : 15.0;

  // Validate fee percentage: must be a number between 0 and 50
  if (isNaN(feePercentage) || feePercentage < 0 || feePercentage > 50) {
    throw new Error(
      `Invalid platform fee percentage: ${feePercentage}. Must be between 0 and 50.`
    );
  }

  // Warn about unreasonable fee percentages
  if (feePercentage === 0) {
    console.warn('[Escrow] Platform fee is 0% — no revenue will be collected');
  } else if (feePercentage > 30) {
    console.warn(`[Escrow] Platform fee is ${feePercentage}% — unusually high, expected ≤30%`);
  }

  // Round to 2 decimal places
  return money(amount * (feePercentage / 100));
}
