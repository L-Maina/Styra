/**
 * Service verification and disputes
 *
 * Booking path (provider marks done, customer confirms or the clock runs out):
 *
 *   IN_PROGRESS ──markBookingCompleted──▶ COMPLETED ──customerConfirm / auto-verify──▶ VERIFIED
 *   COMPLETED | VERIFIED ──raiseDispute──▶ DISPUTED ──resolveDispute──▶ VERIFIED | CANCELLED
 *
 * Every step that touches money runs in ONE database transaction together with the booking
 * status change (see escrow.ts), so a booking can never read VERIFIED while its payment is
 * still held, and two requests cannot both settle the same booking.
 *
 * Verification window: 24 hours from Booking.completedAt. If the customer does nothing in that
 * time, the cron job verifies the booking and releases the payment.
 */

import { db } from '@/lib/db';
import { AppError } from '@/lib/app-error';
import { BookingStatus, isStatus, statusLabel, statusVariants } from '@/lib/booking-status';
import {
  ESCROW_STATUS,
  EscrowError,
  TX_OPTIONS,
  afterRefund,
  afterRelease,
  disputeInTx,
  formatMoney,
  notifyUser,
  refundInTx,
  releaseInTx,
  type EscrowSettlement,
  type Tx,
} from '@/lib/escrow';
import { logTransaction } from '@/lib/transaction-log';
import type { Booking, Dispute } from '@prisma/client';

// ── Constants ──────────────────────────────────────────────────────────────

/** Verification window in milliseconds (24 hours) */
export const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Bookings handled per cron run, so one run stays well inside the function time limit. */
const AUTO_VERIFY_BATCH = 100;
const REPAIR_BATCH = 200;

const OPEN_DISPUTE_STATUSES = ['OPEN', 'IN_PROGRESS'];

export const DISPUTE_RESOLUTIONS = ['RELEASE_TO_PROVIDER', 'FULL_REFUND', 'PARTIAL_REFUND'] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

const short = (id: string): string => id.slice(0, 8);

// ── Types ──────────────────────────────────────────────────────────────────

export interface MarkCompletedResult {
  booking: Booking;
  /** False when the booking was already completed or verified. */
  changed: boolean;
  /** When the customer's 24 hour window ends. */
  deadline: Date;
}

export interface CustomerConfirmResult {
  success: boolean;
  booking: Booking;
  message?: string;
  /** Provider's share that moved to their available balance. 0 if nothing moved. */
  releasedAmount: number;
}

export interface AutoVerifyResult {
  verifiedCount: number;
  skippedCount: number;
  /** Verified bookings whose payment was still held and has now been released. */
  repairedCount: number;
  errors: string[];
}

export interface DisputeResult {
  success: boolean;
  dispute: Dispute;
  booking: Booking;
}

export interface ResolveDisputeOptions {
  /** The admin's written explanation. Stored with the resolution. */
  notes?: string;
  /** PARTIAL_REFUND only: how much the customer gets back. Defaults to half of the payment. */
  customerRefundAmount?: number;
}

export interface ResolveDisputeResult {
  success: boolean;
  dispute: Dispute;
  message: string;
  /** Gross amount owed back to the customer. It still has to be sent through the payment provider. */
  refundAmount: number;
}

export interface AdminSettleResult {
  action: 'released' | 'refunded';
  amount: number;
  transactionId: string;
}

export interface VerificationStatusInfo {
  bookingId: string;
  status: string;
  completedAt: Date | null;
  verifiedAt: Date | null;
  disputedAt: Date | null;
  deadline: Date | null;
  isExpired: boolean;
  canConfirm: boolean;
  canDispute: boolean;
  escrowStatus: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** The 24 hour window starts at completedAt. Older rows without it fall back to updatedAt. */
function deadlineFor(booking: { completedAt: Date | null; updatedAt: Date }): Date {
  const start = booking.completedAt ?? booking.updatedAt;
  return new Date(start.getTime() + VERIFICATION_WINDOW_MS);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

// ── Provider marks the service done ────────────────────────────────────────

/**
 * IN_PROGRESS → COMPLETED. Starts the customer's 24 hour verification window and asks the
 * customer to confirm. Authorisation (is this the business owner?) is the caller's job.
 */
export async function markBookingCompleted(bookingId: string): Promise<MarkCompletedResult> {
  const claimed = await db.booking.updateMany({
    where: { id: bookingId, status: { in: statusVariants(BookingStatus.IN_PROGRESS) } },
    data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
  });

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { business: { select: { name: true } }, service: { select: { name: true } } },
  });
  if (!booking) throw new AppError('Booking not found', 404);

  const deadline = deadlineFor(booking);

  if (claimed.count === 1) {
    await notifyUser(
      booking.customerId,
      'Service Completed',
      `Your ${booking.service?.name || 'service'} at ${booking.business.name} has been marked as completed. Please confirm the service within 24 hours to release payment to the provider.`,
      {
        bookingId,
        businessName: booking.business.name,
        serviceName: booking.service?.name,
        verificationDeadline: deadline.toISOString(),
      },
      'VERIFICATION_UPDATE',
    );
    return { booking, changed: true, deadline };
  }

  if (isStatus(booking.status, BookingStatus.COMPLETED, BookingStatus.VERIFIED)) {
    return { booking, changed: false, deadline };
  }

  throw new AppError(
    `Cannot complete a booking that is ${statusLabel(booking.status)}. Only in-progress bookings can be completed.`,
    409,
  );
}

// ── Cancellation ───────────────────────────────────────────────────────────

/**
 * Cancels a booking that has not been completed and reverses any payment held for it, in one
 * transaction. If the refund cannot be recorded, the booking stays as it was.
 *
 * Who may cancel, and the 24 hour rule before the appointment, are the caller's job.
 * The refund is recorded in the ledger only; admins are alerted to send the money back
 * through the payment provider.
 */
export async function cancelBookingWithRefund(
  bookingId: string,
  reason: string,
): Promise<{ booking: Booking; refundAmount: number }> {
  const outcome = await db.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: {
          in: statusVariants(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS),
        },
      },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: reason },
    });
    if (claimed.count !== 1) {
      throw new AppError('This booking can no longer be cancelled.', 409);
    }

    // null when nothing was ever paid for this booking
    const settlement = await refundInTx(tx, bookingId, reason);
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    return { settlement, booking };
  }, TX_OPTIONS);

  if (!outcome.booking) throw new AppError('Booking not found', 404);

  if (outcome.settlement) await afterRefund(bookingId, reason, outcome.settlement);

  const refunded = outcome.settlement && !outcome.settlement.alreadySettled;
  return { booking: outcome.booking, refundAmount: refunded ? outcome.settlement!.refundAmount : 0 };
}

// ── Verification (customer confirm, auto-verify) ───────────────────────────

interface VerifyOutcome {
  changed: boolean;
  booking: Booking | null;
  settlement: EscrowSettlement | null;
}

/**
 * COMPLETED → VERIFIED and escrow release, in the caller's transaction.
 *
 * The status update is a compare-and-swap (it only matches a COMPLETED booking), which also
 * locks the booking row: a dispute or a second confirm running at the same time waits, then
 * sees the new status. If the release fails, the status change is rolled back with it.
 */
async function verifyInTx(tx: Tx, bookingId: string, reason: string): Promise<VerifyOutcome> {
  const claimed = await tx.booking.updateMany({
    where: { id: bookingId, status: { in: statusVariants(BookingStatus.COMPLETED) } },
    data: { status: BookingStatus.VERIFIED },
  });
  if (claimed.count !== 1) return { changed: false, booking: null, settlement: null };

  const settlement = await releaseInTx(tx, bookingId, reason);
  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  return { changed: true, booking, settlement };
}

/**
 * Customer confirms that the service was done. Releases the payment to the provider.
 *
 * @param bookingId - The booking ID
 * @param userId    - The customer's user ID (for authorisation)
 */
export async function customerConfirm(
  bookingId: string,
  userId: string,
): Promise<CustomerConfirmResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { business: { select: { ownerId: true, name: true } } },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId !== userId) {
    throw new AppError('Only the customer who made this booking can confirm it', 403);
  }

  if (isStatus(booking.status, BookingStatus.VERIFIED)) {
    return { success: true, booking, message: 'Booking already verified', releasedAmount: 0 };
  }
  if (isStatus(booking.status, BookingStatus.DISPUTED)) {
    throw new AppError('Cannot confirm a disputed booking. Wait for the dispute to be resolved.', 409);
  }
  if (!isStatus(booking.status, BookingStatus.COMPLETED)) {
    throw new AppError(
      `This booking cannot be confirmed yet (status: ${statusLabel(booking.status)}).`,
      409,
    );
  }

  const reason = 'Customer confirmed service completion';
  const outcome = await db.$transaction((tx) => verifyInTx(tx, bookingId, reason), TX_OPTIONS);

  if (!outcome.changed || !outcome.booking) {
    // The auto-verify job or a double click got there first. Report where it ended up.
    const current = await db.booking.findUnique({ where: { id: bookingId } });
    if (current && isStatus(current.status, BookingStatus.VERIFIED)) {
      return { success: true, booking: current, message: 'Booking already verified', releasedAmount: 0 };
    }
    throw new AppError('This booking was just updated. Please refresh and try again.', 409);
  }

  const moved = outcome.settlement && !outcome.settlement.alreadySettled ? outcome.settlement : null;
  if (moved) await afterRelease(bookingId, reason, moved);

  const label = `booking ${short(bookingId)}`;
  if (!moved) {
    await notifyUser(
      booking.business.ownerId,
      'Booking Verified',
      `The customer confirmed ${label}.`,
      { bookingId },
    );
  }
  await notifyUser(
    userId,
    'Confirmation Recorded',
    `Your confirmation for ${label} has been recorded. Thank you!`,
    { bookingId },
  );

  return { success: true, booking: outcome.booking, releasedAmount: moved?.releasedAmount ?? 0 };
}

/**
 * Cron job entry point. Does two things:
 *
 *  1. Verifies bookings that have been COMPLETED for more than 24 hours with no customer action
 *     (confirmation or dispute), and releases their payment.
 *  2. Repairs bookings that are already VERIFIED but whose payment is still held, which can
 *     happen when the payment arrived after the booking was verified.
 *
 * Each booking is handled on its own, so one failure never blocks the rest. Failures are
 * returned in `errors` and the booking is retried on the next run.
 */
export async function autoVerifyExpiredBookings(
  limit: number = AUTO_VERIFY_BATCH,
): Promise<AutoVerifyResult> {
  const cutoff = new Date(Date.now() - VERIFICATION_WINDOW_MS);

  const expired = await db.booking.findMany({
    where: {
      status: { in: statusVariants(BookingStatus.COMPLETED) },
      OR: [
        { completedAt: { lte: cutoff } },
        { completedAt: null, updatedAt: { lte: cutoff } },
      ],
    },
    select: {
      id: true,
      customerId: true,
      business: { select: { ownerId: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });

  const result: AutoVerifyResult = { verifiedCount: 0, skippedCount: 0, repairedCount: 0, errors: [] };
  const reason = 'Auto-verified after 24h timeout';

  for (const booking of expired) {
    try {
      const outcome = await db.$transaction((tx) => verifyInTx(tx, booking.id, reason), TX_OPTIONS);

      if (!outcome.changed) {
        // The customer confirmed or disputed while this run was going.
        result.skippedCount++;
        continue;
      }

      const moved = outcome.settlement && !outcome.settlement.alreadySettled ? outcome.settlement : null;
      if (moved) await afterRelease(booking.id, reason, moved);

      await notifyUser(
        booking.business.ownerId,
        'Booking Auto-Verified',
        moved
          ? `Booking ${short(booking.id)} was verified automatically after 24 hours and your payment has been released.`
          : `Booking ${short(booking.id)} was verified automatically after 24 hours.`,
        { bookingId: booking.id, autoVerified: true },
      );
      await notifyUser(
        booking.customerId,
        'Booking Auto-Verified',
        `Booking ${short(booking.id)} was verified automatically because there was no response within 24 hours.`,
        { bookingId: booking.id, autoVerified: true },
      );

      result.verifiedCount++;
    } catch (error) {
      result.errors.push(`${short(booking.id)}: ${errorText(error)}`);
    }
  }

  await repairVerifiedBookings(result);
  return result;
}

/** Releases payments that are still held for bookings that are already VERIFIED. */
async function repairVerifiedBookings(result: AutoVerifyResult): Promise<void> {
  try {
    const verified = await db.booking.findMany({
      where: { status: { in: statusVariants(BookingStatus.VERIFIED) } },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: REPAIR_BATCH,
    });
    if (verified.length === 0) return;

    const stuck = await db.platformTransaction.findMany({
      where: {
        type: 'ESCROW_HELD',
        escrowStatus: ESCROW_STATUS.HELD,
        bookingId: { in: verified.map((booking) => booking.id) },
      },
      select: { bookingId: true },
    });

    const reason = 'Released by repair: booking was verified but the payment was still held';

    for (const { bookingId } of stuck) {
      if (!bookingId) continue;
      try {
        const settlement = await db.$transaction(async (tx) => {
          // Lock the booking and make sure no dispute started since the list was read.
          const stillVerified = await tx.booking.updateMany({
            where: { id: bookingId, status: { in: statusVariants(BookingStatus.VERIFIED) } },
            data: { status: BookingStatus.VERIFIED },
          });
          if (stillVerified.count !== 1) return null;
          return releaseInTx(tx, bookingId, reason);
        }, TX_OPTIONS);

        if (settlement && !settlement.alreadySettled) {
          await afterRelease(bookingId, reason, settlement);
          result.repairedCount++;
        }
      } catch (error) {
        result.errors.push(`repair ${short(bookingId)}: ${errorText(error)}`);
      }
    }
  } catch (error) {
    result.errors.push(`repair: ${errorText(error)}`);
  }
}

// ── Disputes ───────────────────────────────────────────────────────────────

/**
 * Customer raises a dispute. Freezes the payment until an admin resolves it.
 *
 * Allowed while the booking is COMPLETED or VERIFIED, once per booking. If the payment was
 * already released it is pulled back into the provider's pending balance.
 *
 * @param bookingId - The booking ID
 * @param userId    - The customer's user ID
 * @param reason    - Description of the dispute
 */
export async function raiseDispute(
  bookingId: string,
  userId: string,
  reason: string,
): Promise<DisputeResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { business: { select: { ownerId: true, name: true } } },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId !== userId) {
    throw new AppError('Only the customer who made this booking can raise a dispute', 403);
  }

  // One dispute per booking. An open one is returned as is, so a double click is harmless.
  const earlier = await db.dispute.findFirst({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
  });
  if (earlier) {
    if (OPEN_DISPUTE_STATUSES.includes(earlier.status)) {
      return { success: true, dispute: earlier, booking };
    }
    throw new AppError('A dispute for this booking has already been resolved.', 409);
  }

  if (!isStatus(booking.status, BookingStatus.COMPLETED, BookingStatus.VERIFIED)) {
    throw new AppError(
      `Only completed bookings can be disputed (this one is ${statusLabel(booking.status)}).`,
      409,
    );
  }

  const providerId = booking.business.ownerId;

  const outcome = await db.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: { in: statusVariants(BookingStatus.COMPLETED, BookingStatus.VERIFIED) },
      },
      data: { status: BookingStatus.DISPUTED, disputeReason: reason },
    });
    if (claimed.count !== 1) {
      throw new AppError('This booking was just updated. Please refresh and try again.', 409);
    }

    const escrow = await disputeInTx(tx, bookingId);
    const dispute = await tx.dispute.create({
      data: {
        bookingId,
        customerId: userId,
        providerId,
        description: reason,
        reason,
        status: 'OPEN',
      },
    });
    const updated = await tx.booking.findUnique({ where: { id: bookingId } });
    return { dispute, escrow, booking: updated ?? booking };
  }, TX_OPTIONS);

  const frozen = outcome.escrow?.transaction;
  const label = `booking ${short(bookingId)}`;

  if (frozen && outcome.escrow?.pulledBack) {
    await logTransaction({
      userId: providerId,
      bookingId,
      amount: frozen.providerAmount,
      type: 'DISPUTE_HOLD',
      status: 'COMPLETED',
      referenceId: outcome.dispute.id,
      metadata: { disputeId: outcome.dispute.id, reason, pulledBackFromBalance: true },
    });
  }

  await notifyUser(
    providerId,
    'Dispute Raised',
    frozen
      ? `A dispute was raised for ${label}. ${formatMoney(frozen.currency, frozen.providerAmount)} is on hold until it is resolved. Reason: ${reason}`
      : `A dispute was raised for ${label}. Reason: ${reason}`,
    { bookingId, disputeId: outcome.dispute.id },
  );
  await notifyUser(
    userId,
    'Dispute Submitted',
    `Your dispute for ${label} has been submitted. Our team will review it within 48 hours.`,
    { bookingId, disputeId: outcome.dispute.id },
  );

  return { success: true, dispute: outcome.dispute, booking: outcome.booking };
}

function isResolution(value: string): value is DisputeResolution {
  return (DISPUTE_RESOLUTIONS as readonly string[]).includes(value);
}

/**
 * Admin resolves a dispute. The status change, the money move and the booking status all
 * happen in one transaction; if any part fails, the dispute stays open.
 *
 *  - RELEASE_TO_PROVIDER: the provider is paid, booking becomes VERIFIED.
 *  - FULL_REFUND: the customer gets everything back, booking becomes CANCELLED.
 *  - PARTIAL_REFUND: the customer gets `customerRefundAmount` (default half), the provider keeps
 *    the rest minus a proportional platform fee, booking becomes VERIFIED.
 *
 * Refunds are recorded in the ledger only. The money still has to be sent back through the
 * payment provider; admins are alerted with the payment reference.
 *
 * @param disputeId  - The dispute ID
 * @param resolution - RELEASE_TO_PROVIDER, FULL_REFUND or PARTIAL_REFUND
 * @param resolvedBy - Admin user ID
 */
export async function resolveDispute(
  disputeId: string,
  resolution: string,
  resolvedBy: string,
  options: ResolveDisputeOptions = {},
): Promise<ResolveDisputeResult> {
  if (!isResolution(resolution)) {
    throw new AppError(
      `Unknown resolution type: ${resolution}. Expected ${DISPUTE_RESOLUTIONS.join(', ')}.`,
      400,
    );
  }

  const dispute = await db.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new AppError('Dispute not found', 404);

  if (dispute.status === 'RESOLVED') {
    return { success: true, dispute, message: 'Dispute already resolved', refundAmount: 0 };
  }
  if (!OPEN_DISPUTE_STATUSES.includes(dispute.status)) {
    throw new AppError(`Cannot resolve a dispute with status ${dispute.status}.`, 409);
  }

  const { bookingId, providerId, customerId } = dispute;
  const admin = short(resolvedBy);

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: { in: OPEN_DISPUTE_STATUSES } },
      data: { status: 'RESOLVED' },
    });
    if (claimed.count !== 1) {
      throw new AppError('This dispute was just updated by someone else. Please refresh.', 409);
    }

    let settlement: EscrowSettlement | null;
    if (resolution === 'RELEASE_TO_PROVIDER') {
      settlement = await releaseInTx(tx, bookingId, `Dispute resolved in the provider's favour (admin ${admin})`);
    } else if (resolution === 'FULL_REFUND') {
      settlement = await refundInTx(tx, bookingId, `Dispute resolved with a full refund (admin ${admin})`);
    } else {
      // Older disputes may have left the payment released. Freeze it again before splitting.
      await disputeInTx(tx, bookingId);
      settlement = await refundInTx(
        tx,
        bookingId,
        `Dispute resolved with a partial refund (admin ${admin})`,
        options.customerRefundAmount !== undefined
          ? { amount: options.customerRefundAmount }
          : { fraction: 0.5 },
      );
    }

    const cancelled = resolution === 'FULL_REFUND' || settlement?.kind === 'REFUNDED';
    const now = new Date();
    await tx.booking.updateMany({
      where: { id: bookingId },
      data: cancelled
        ? {
            status: BookingStatus.CANCELLED,
            disputeResolvedAt: now,
            cancelledAt: now,
            cancellationReason: 'Refunded after a dispute',
          }
        : { status: BookingStatus.VERIFIED, disputeResolvedAt: now },
    });

    const refundAmount = settlement && !settlement.alreadySettled ? settlement.refundAmount : 0;
    const updated = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        resolution: JSON.stringify({
          type: resolution,
          resolvedBy,
          resolvedAt: now.toISOString(),
          amount: settlement?.transaction.amount ?? 0,
          refundAmount,
          providerAmount: settlement?.releasedAmount ?? 0,
          notes: options.notes,
        }),
      },
    });

    return { settlement, dispute: updated, refundAmount };
  }, TX_OPTIONS);

  const { settlement } = result;
  const currency = settlement?.transaction.currency ?? 'KES';
  const label = `booking ${short(bookingId)}`;
  const reason = `Dispute ${short(disputeId)} resolved (${resolution})`;

  if (settlement) {
    if (settlement.kind !== 'REFUNDED') await afterRelease(bookingId, reason, settlement);
    if (settlement.kind !== 'RELEASED') await afterRefund(bookingId, reason, settlement);
  }

  let message: string;
  let providerText: string;
  let customerText: string;

  if (resolution === 'RELEASE_TO_PROVIDER') {
    message = settlement
      ? `Dispute resolved: ${formatMoney(currency, settlement.releasedAmount)} released to the provider.`
      : 'Dispute resolved in the provider’s favour. No payment was on file for this booking.';
    providerText = `The dispute for ${label} was resolved in your favour.`;
    customerText = `The dispute for ${label} was resolved. The provider will be paid for this booking.`;
  } else if (resolution === 'FULL_REFUND') {
    message = settlement
      ? `Dispute resolved: ${formatMoney(currency, result.refundAmount)} owed back to the customer. Send it through the payment provider; the payment reference is in your notifications.`
      : 'Dispute resolved with a full refund, but no payment was on file for this booking, so no money moved.';
    providerText = `The dispute for ${label} was resolved with a full refund to the customer.`;
    customerText = settlement
      ? `Your dispute for ${label} was resolved. A full refund of ${formatMoney(currency, result.refundAmount)} is being processed.`
      : `Your dispute for ${label} was resolved with a full refund.`;
  } else {
    message = settlement
      ? `Dispute resolved: ${formatMoney(currency, result.refundAmount)} owed back to the customer, ${formatMoney(currency, settlement.releasedAmount)} to the provider. Send the refund through the payment provider.`
      : 'Dispute resolved with a partial refund, but no payment was on file for this booking, so no money moved.';
    providerText = settlement
      ? `The dispute for ${label} was resolved with a partial refund. ${formatMoney(currency, settlement.releasedAmount)} was released to your wallet.`
      : `The dispute for ${label} was resolved with a partial refund.`;
    customerText = settlement
      ? `Your dispute for ${label} was resolved. A partial refund of ${formatMoney(currency, result.refundAmount)} is being processed.`
      : `Your dispute for ${label} was resolved with a partial refund.`;
  }

  const link = { disputeId, bookingId, resolution };
  await notifyUser(providerId, 'Dispute Resolved', providerText, link);
  await notifyUser(customerId, 'Dispute Resolved', customerText, link);

  return { success: true, dispute: result.dispute, message, refundAmount: result.refundAmount };
}

// ── Admin override ─────────────────────────────────────────────────────────

/**
 * Admin releases or refunds a booking's payment by hand, outside the dispute flow.
 *
 *  - release: the booking is verified if it was waiting for the customer, and the provider is paid.
 *  - refund: the customer's payment is reversed and the booking is cancelled.
 *
 * Bookings with an open dispute are refused: resolve the dispute instead, so both parties
 * get an outcome and the dispute is closed.
 */
export async function adminSettleEscrow(
  bookingId: string,
  action: 'release' | 'refund',
  reason: string,
): Promise<AdminSettleResult> {
  const openDispute = await db.dispute.findFirst({
    where: { bookingId, status: { in: OPEN_DISPUTE_STATUSES } },
    select: { id: true },
  });
  if (openDispute) {
    throw new AppError('This booking has an open dispute. Resolve the dispute instead.', 409);
  }

  const settlement = await db.$transaction(async (tx): Promise<EscrowSettlement> => {
    const noEscrow = () =>
      new EscrowError('NO_ESCROW', `No escrow found for booking ${short(bookingId)}.`);

    if (action === 'release') {
      await tx.booking.updateMany({
        where: { id: bookingId, status: { in: statusVariants(BookingStatus.COMPLETED) } },
        data: { status: BookingStatus.VERIFIED },
      });
      const released = await releaseInTx(tx, bookingId, reason);
      if (!released) throw noEscrow(); // rolls the booking status back too
      return released;
    }

    const refunded = await refundInTx(tx, bookingId, reason);
    if (!refunded) throw noEscrow();
    if (!refunded.alreadySettled) {
      await tx.booking.updateMany({
        where: { id: bookingId, status: { notIn: statusVariants(BookingStatus.CANCELLED) } },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });
    }
    return refunded;
  }, TX_OPTIONS);

  if (action === 'release') {
    await afterRelease(bookingId, reason, settlement);
    return {
      action: 'released',
      amount: settlement.releasedAmount,
      transactionId: settlement.transaction.id,
    };
  }

  await afterRefund(bookingId, reason, settlement);
  return {
    action: 'refunded',
    amount: settlement.refundAmount,
    transactionId: settlement.transaction.id,
  };
}

// ── Status ─────────────────────────────────────────────────────────────────

/**
 * Where a booking stands in the verification flow, and what the customer can do now.
 *
 * @param bookingId - The booking ID
 */
export async function getVerificationStatus(bookingId: string): Promise<VerificationStatusInfo> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, completedAt: true, updatedAt: true },
  });

  if (!booking) throw new AppError('Booking not found', 404);

  const completedAt = booking.completedAt ?? (isStatus(booking.status, BookingStatus.COMPLETED) ? booking.updatedAt : null);
  const deadline = completedAt ? deadlineFor({ completedAt, updatedAt: booking.updatedAt }) : null;

  let escrowStatus: string | null = null;
  try {
    const escrowTx = await db.platformTransaction.findFirst({
      where: { bookingId, type: 'ESCROW_HELD' },
      select: { escrowStatus: true },
      orderBy: { createdAt: 'desc' },
    });
    escrowStatus = escrowTx?.escrowStatus ?? null;
  } catch {
    // The status is still useful without the escrow state.
  }

  const awaitingCustomer = isStatus(booking.status, BookingStatus.COMPLETED);

  return {
    bookingId,
    status: booking.status,
    completedAt,
    verifiedAt: isStatus(booking.status, BookingStatus.VERIFIED) ? booking.updatedAt : null,
    disputedAt: isStatus(booking.status, BookingStatus.DISPUTED) ? booking.updatedAt : null,
    deadline,
    isExpired: deadline ? Date.now() > deadline.getTime() : false,
    canConfirm: awaitingCustomer,
    canDispute: isStatus(booking.status, BookingStatus.COMPLETED, BookingStatus.VERIFIED),
    escrowStatus,
  };
}
