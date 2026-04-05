/**
 * Service Verification System
 *
 * A) Customer Confirmation: Customer confirms service was completed
 * B) Auto Timeout: CRON job checks after 24h — auto-verifies unconfirmed bookings
 * C) Dispute Handling: Customer raises a dispute → funds held until resolution
 *
 * Booking states:
 *   COMPLETED → VERIFIED → (payout eligible)
 *   COMPLETED → DISPUTED → (resolved by admin → VERIFIED or REFUNDED)
 *
 * Verification Window: 24 hours after booking marked COMPLETED.
 * If no customer action within 24h, the system auto-verifies.
 */

import { db } from '@/lib/db';
import { releaseFromEscrow, refundFromEscrow } from '@/lib/escrow';
import { holdForDispute as walletHoldForDispute, releaseDisputeHold as walletReleaseDisputeHold } from '@/lib/wallet';
import { logTransaction } from '@/lib/transaction-log';
import type { Booking, Dispute } from '@prisma/client';

// ── Constants ──────────────────────────────────────────────────────────────

/** Verification window in milliseconds (24 hours) */
const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface CustomerConfirmResult {
  success: boolean;
  booking: Booking;
  message?: string;
}

export interface AutoVerifyResult {
  verifiedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface DisputeResult {
  success: boolean;
  dispute: Dispute;
  booking: Booking;
}

export interface ResolveDisputeResult {
  success: boolean;
  dispute: Dispute;
  message: string;
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

// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Send notification (fire-and-forget).
 */
async function sendNotification(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId,
        title,
        message,
        type: 'SYSTEM_ALERT',
      },
    });
  } catch {
    // Never block on notification failure
  }
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Customer confirms that a service was completed satisfactorily.
 * This triggers escrow release to the provider's wallet.
 *
 * Preconditions:
 *   1. Booking exists
 *   2. User is the customer who made the booking
 *   3. Booking status is COMPLETED (not already VERIFIED or DISPUTED)
 *
 * @param bookingId - The booking ID
 * @param userId    - The customer's user ID (for authorization)
 */
export async function customerConfirm(
  bookingId: string,
  userId: string,
): Promise<CustomerConfirmResult> {
  // 1. Fetch booking with relations
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      business: { select: { ownerId: true, name: true } },
      payments: { select: { id: true, status: true } },
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  // 2. Verify caller is the customer
  if (booking.customerId !== userId) {
    throw new Error('Only the customer who made this booking can confirm it');
  }

  // 3. Verify booking is in COMPLETED status
  if (booking.status !== 'COMPLETED') {
    if (booking.status === 'VERIFIED') {
      return {
        success: true,
        booking,
        message: 'Booking already verified',
      };
    }
    if (booking.status === 'DISPUTED') {
      throw new Error('Cannot confirm a disputed booking. Wait for dispute resolution.');
    }
    throw new Error(`Booking cannot be confirmed (current status: ${booking.status})`);
  }

  // 4. Update booking status to VERIFIED
  const updatedBooking = await db.booking.update({
    where: { id: bookingId },
    data: { status: 'VERIFIED' },
  });

  // 5. Release escrow funds to provider (fire-and-forget — uses its own transactions)
  try {
    await releaseFromEscrow(bookingId, 'Customer confirmed service completion');
  } catch (escrowError) {
    // Log the error but don't fail the confirmation
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[Verification] Escrow release failed for ${bookingId.slice(0, 8)}:`,
        escrowError instanceof Error ? escrowError.message : 'unknown',
      );
    }
  }

  // 6. Notify provider (fire-and-forget)
  await sendNotification(
    booking.business.ownerId,
    'Booking Verified',
    `Customer has confirmed service for booking ${bookingId.slice(0, 8)}. Payment will be released to your wallet.`,
    { bookingId, confirmedBy: userId },
  );

  // 7. Notify customer (fire-and-forget)
  await sendNotification(
    userId,
    'Confirmation Recorded',
    `Your confirmation for booking ${bookingId.slice(0, 8)} has been recorded. Thank you!`,
    { bookingId },
  );

  return {
    success: true,
    booking: updatedBooking,
  };
}

/**
 * Auto-verify bookings that have been COMPLETED for more than 24 hours
 * without customer action (confirmation or dispute).
 *
 * This should be called by a CRON job (e.g., every hour).
 *
 * Returns the count of bookings that were auto-verified.
 */
export async function autoVerifyExpiredBookings(): Promise<AutoVerifyResult> {
  const cutoff = new Date(Date.now() - VERIFICATION_WINDOW_MS);

  // Find COMPLETED bookings older than the verification window
  const expiredBookings = await db.booking.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: { lte: cutoff },
    },
    include: {
      business: { select: { ownerId: true, name: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });

  let verifiedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const booking of expiredBookings) {
    try {
      // Double-check status (another process may have verified it)
      const freshBooking = await db.booking.findUnique({
        where: { id: booking.id },
        select: { status: true },
      });

      if (!freshBooking || freshBooking.status !== 'COMPLETED') {
        skippedCount++;
        continue;
      }

      // Update booking to VERIFIED
      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'VERIFIED' },
      });

      // Release escrow (fire-and-forget)
      try {
        await releaseFromEscrow(booking.id, 'Auto-verified after 24h timeout');
      } catch (escrowError) {
        if (process.env.NODE_ENV === 'development') {
          console.error(
            `[AutoVerify] Escrow release failed for ${booking.id.slice(0, 8)}:`,
            escrowError instanceof Error ? escrowError.message : 'unknown',
          );
        }
      }

      // Notify provider (fire-and-forget)
      await sendNotification(
        booking.business.ownerId,
        'Booking Auto-Verified',
        `Booking ${booking.id.slice(0, 8)} was automatically verified after 24h. Payment released to your wallet.`,
        { bookingId: booking.id, autoVerified: true },
      );

      // Notify customer (fire-and-forget)
      const customerBooking = await db.booking.findUnique({
        where: { id: booking.id },
        select: { customerId: true },
      });
      if (customerBooking) {
        await sendNotification(
          customerBooking.customerId,
          'Booking Auto-Verified',
          `Booking ${booking.id.slice(0, 8)} was automatically verified since no action was taken within 24 hours.`,
          { bookingId: booking.id, autoVerified: true },
        );
      }

      verifiedCount++;
    } catch (error) {
      errors.push(
        `${booking.id.slice(0, 8)}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  return { verifiedCount, skippedCount, errors };
}

/**
 * Customer raises a dispute for a completed booking.
 * This holds the escrow funds until the dispute is resolved.
 *
 * Preconditions:
 *   1. Booking exists
 *   2. User is the customer
 *   3. Booking status is COMPLETED or VERIFIED (not CANCELLED, NO_SHOW, etc.)
 *   4. No active dispute already exists
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
  // 1. Fetch booking
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      business: { select: { ownerId: true, name: true } },
      payments: { select: { id: true, amount: true, status: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  // 2. Verify caller is the customer
  if (booking.customerId !== userId) {
    throw new Error('Only the customer can raise a dispute');
  }

  // 3. Verify booking status allows dispute
  if (!['COMPLETED', 'VERIFIED'].includes(booking.status)) {
    if (booking.status === 'DISPUTED') {
      throw new Error('A dispute is already active for this booking');
    }
    throw new Error(`Cannot dispute booking with status: ${booking.status}`);
  }

  // 4. Check for existing active dispute
  const existingDispute = await db.dispute.findFirst({
    where: {
      bookingId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  });

  if (existingDispute) {
    return {
      success: true,
      dispute: existingDispute,
      booking,
    };
  }

  // 5. Get escrow amount for dispute
  const firstPayment = booking.payments[0];
  const providerAmount = firstPayment
    ? firstPayment.amount - Math.round(firstPayment.amount * 0.15 * 100) / 100
    : booking.totalPrice;

  // 6. Create dispute record
  const dispute = await db.dispute.create({
    data: {
      bookingId,
      customerId: userId,
      providerId: booking.business.ownerId,
      description: reason,
      status: 'OPEN',
      reason,
    },
  });

  // 7. Update booking status to DISPUTED
  const updatedBooking = await db.booking.update({
    where: { id: bookingId },
    data: { status: 'DISPUTED' },
  });

  // 8. Hold wallet balance for dispute amount (fire-and-forget)
  try {
    await walletHoldForDispute(booking.business.ownerId, providerAmount, bookingId);
  } catch (holdError) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[Dispute] Wallet hold failed for ${bookingId.slice(0, 8)}:`,
        holdError instanceof Error ? holdError.message : 'unknown',
      );
    }
  }

  // 9. Update escrow status if there's an escrow transaction
  try {
    const escrowTx = await db.platformTransaction.findFirst({
      where: { bookingId, type: 'ESCROW_HELD', escrowStatus: 'HELD' },
    });
    if (escrowTx) {
      await db.platformTransaction.update({
        where: { id: escrowTx.id },
        data: { escrowStatus: 'DISPUTED' },
      });
    }
  } catch {
    // Non-blocking
  }

  // 10. Log the dispute (fire-and-forget)
  await logTransaction({
    userId: booking.business.ownerId,
    bookingId,
    amount: providerAmount,
    type: 'REFUND',
    status: 'FAILED',
    referenceId: dispute.id,
    metadata: { action: 'DISPUTE_HOLD', reason, disputeId: dispute.id },
  });

  // 11. Notify provider (fire-and-forget)
  await sendNotification(
    booking.business.ownerId,
    'Dispute Raised',
    `A dispute has been raised for booking ${bookingId.slice(0, 8)}. Amount held: $${providerAmount.toFixed(2)}. Reason: ${reason}`,
    { bookingId, disputeId: dispute.id, amount: providerAmount, reason },
  );

  // 12. Notify customer (fire-and-forget)
  await sendNotification(
    userId,
    'Dispute Submitted',
    `Your dispute for booking ${bookingId.slice(0, 8)} has been submitted. Our team will review it within 48 hours.`,
    { bookingId, disputeId: dispute.id },
  );

  return {
    success: true,
    dispute,
    booking: updatedBooking,
  };
}

/**
 * Admin resolves a dispute.
 * Can release funds to provider or refund to customer.
 *
 * Resolution types:
 *   - "RELEASE_TO_PROVIDER" — Release held funds to provider's wallet
 *   - "FULL_REFUND" — Refund full amount to customer
 *   - "PARTIAL_REFUND" — Split: partial refund to customer, rest to provider
 *
 * @param disputeId  - The dispute ID
 * @param resolution - Resolution type string
 * @param resolvedBy - Admin user ID
 */
export async function resolveDispute(
  disputeId: string,
  resolution: string,
  resolvedBy: string,
): Promise<ResolveDisputeResult> {
  // 1. Fetch dispute with booking
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      booking: {
        include: {
          payments: { select: { amount: true } },
        },
      },
    },
  });

  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  if (dispute.status === 'RESOLVED') {
    return {
      success: true,
      dispute,
      message: 'Dispute already resolved',
    };
  }

  if (!['OPEN', 'IN_PROGRESS'].includes(dispute.status)) {
    throw new Error(`Cannot resolve dispute with status: ${dispute.status}`);
  }

  const bookingId = dispute.bookingId;
  const providerId = dispute.providerId;
  const customerId = dispute.customerId;
  const disputedAmount = dispute.booking?.payments[0]?.amount || dispute.booking?.totalPrice || 0;

  // 2. Process based on resolution type
  let message = 'Dispute resolution processed';

  switch (resolution) {
    case 'RELEASE_TO_PROVIDER': {
      // Release held funds back to provider
      try {
        if (!providerId) break;
        await walletReleaseDisputeHold(providerId, disputedAmount, bookingId || '');
      } catch (releaseError) {
        if (process.env.NODE_ENV === 'development') {
          console.error(
            `[Dispute] Wallet release failed:`,
            releaseError instanceof Error ? releaseError.message : 'unknown',
          );
        }
      }

      // Update escrow status
      if (bookingId) {
        try {
          await releaseFromEscrow(bookingId, `Dispute resolved in provider's favor (by admin ${resolvedBy.slice(0, 8)})`);
        } catch {
          // Non-blocking
        }

        // Update booking status to VERIFIED so payout can proceed
        await db.booking.update({
          where: { id: bookingId },
          data: { status: 'VERIFIED' },
        }).catch(() => {});
      }

      message = `Dispute resolved: $${disputedAmount.toFixed(2)} released to provider`;

      // Notify both parties
      if (providerId) {
        await sendNotification(
          providerId,
          'Dispute Resolved',
          `Dispute for ${bookingId?.slice(0, 8) || 'booking'} has been resolved in your favor. $${disputedAmount.toFixed(2)} has been released to your wallet.`,
          { disputeId, resolution, amount: disputedAmount },
        );
      }
      if (customerId) {
        await sendNotification(
          customerId,
          'Dispute Resolved',
          `Dispute for ${bookingId?.slice(0, 8) || 'booking'} has been resolved. The provider will receive the held funds.`,
          { disputeId, resolution },
        );
      }
      break;
    }

    case 'FULL_REFUND': {
      // Refund full amount to customer
      if (bookingId) {
        try {
          await refundFromEscrow(bookingId, `Full refund: dispute resolved by admin ${resolvedBy.slice(0, 8)}`);
        } catch (refundError) {
          if (process.env.NODE_ENV === 'development') {
            console.error(
              `[Dispute] Escrow refund failed:`,
              refundError instanceof Error ? refundError.message : 'unknown',
            );
          }
        }

        // Update booking status
        await db.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        }).catch(() => {});
      }

      // Provider balance was already deducted when dispute was raised via holdForDispute.
      // The escrow refund handles returning funds to the customer.

      message = `Dispute resolved: Full refund of $${disputedAmount.toFixed(2)} to customer`;

      // Notify both parties
      if (providerId) {
        await sendNotification(
          providerId,
          'Dispute Resolved — Refund Issued',
          `Dispute for ${bookingId?.slice(0, 8) || 'booking'} resolved with a full refund to the customer.`,
          { disputeId, resolution, amount: disputedAmount },
        );
      }
      if (customerId) {
        await sendNotification(
          customerId,
          'Dispute Resolved — Refund Issued',
          `Your dispute for ${bookingId?.slice(0, 8) || 'booking'} has been resolved. A full refund of $${disputedAmount.toFixed(2)} will be processed.`,
          { disputeId, resolution, amount: disputedAmount },
        );
      }
      break;
    }

    case 'PARTIAL_REFUND': {
      // Default: 50/50 split
      const providerShare = disputedAmount * 0.5;
      const customerShare = disputedAmount * 0.5;

      // Release provider's share
      try {
        if (!providerId) break;
        await walletReleaseDisputeHold(providerId, providerShare, bookingId || '');
      } catch {
        // Non-blocking
      }

      // Refund customer's share from escrow
      if (bookingId) {
        try {
          await refundFromEscrow(
            bookingId,
            `Partial refund: dispute resolved by admin ${resolvedBy.slice(0, 8)}`,
          );
        } catch {
          // Non-blocking
        }

        // Update booking status to allow partial payout
        await db.booking.update({
          where: { id: bookingId },
          data: { status: 'VERIFIED' },
        }).catch(() => {});
      }

      message = `Dispute resolved: Partial refund $${customerShare.toFixed(2)} to customer, $${providerShare.toFixed(2)} to provider`;

      // Notify both parties
      if (providerId) {
        await sendNotification(
          providerId,
          'Dispute Resolved — Partial',
          `Dispute for ${bookingId?.slice(0, 8) || 'booking'} resolved partially. $${providerShare.toFixed(2)} released to your wallet.`,
          { disputeId, resolution, providerShare, customerShare },
        );
      }
      if (customerId) {
        await sendNotification(
          customerId,
          'Dispute Resolved — Partial Refund',
          `Your dispute for ${bookingId?.slice(0, 8) || 'booking'} has been partially resolved. A refund of $${customerShare.toFixed(2)} will be processed.`,
          { disputeId, resolution, providerShare, customerShare },
        );
      }
      break;
    }

    default:
      throw new Error(`Unknown resolution type: ${resolution}. Expected RELEASE_TO_PROVIDER, FULL_REFUND, or PARTIAL_REFUND`);
  }

  // 3. Update dispute record
  const updatedDispute = await db.dispute.update({
    where: { id: disputeId },
    data: {
      status: 'RESOLVED',
      resolution: JSON.stringify({
        type: resolution,
        resolvedBy,
        resolvedAt: new Date().toISOString(),
        amount: disputedAmount,
      }),
    },
  });

  // 4. Log resolution (fire-and-forget)
  await logTransaction({
    userId: providerId || customerId || '',
    bookingId: bookingId || undefined,
    amount: disputedAmount,
    type: 'REFUND',
    status: 'COMPLETED',
    referenceId: disputeId,
    metadata: { action: 'DISPUTE_RESOLVED', resolution, resolvedBy, disputeId },
  });

  return {
    success: true,
    dispute: updatedDispute,
    message,
  };
}

/**
 * Get the verification status and deadline for a booking.
 *
 * @param bookingId - The booking ID
 */
export async function getVerificationStatus(bookingId: string): Promise<VerificationStatusInfo> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  // Find when the booking was last set to COMPLETED (for deadline calculation)
  // We use updatedAt since status changes update this field
  const completedAt = booking.updatedAt;
  const deadline = new Date(completedAt.getTime() + VERIFICATION_WINDOW_MS);
  const isExpired = Date.now() > deadline.getTime();

  // Check escrow status
  let escrowStatus: string | null = null;
  try {
    const escrowTx = await db.platformTransaction.findFirst({
      where: { bookingId, type: 'ESCROW_HELD' },
      select: { escrowStatus: true },
      orderBy: { createdAt: 'desc' },
    });
    if (escrowTx) {
      escrowStatus = escrowTx.escrowStatus;
    }
  } catch {
    // Non-blocking
  }

  const canConfirm = booking.status === 'COMPLETED';
  const canDispute = ['COMPLETED', 'VERIFIED'].includes(booking.status);

  return {
    bookingId,
    status: booking.status,
    completedAt,
    verifiedAt: booking.status === 'VERIFIED' ? booking.updatedAt : null,
    disputedAt: booking.status === 'DISPUTED' ? booking.updatedAt : null,
    deadline,
    isExpired,
    canConfirm,
    canDispute,
    escrowStatus,
  };
}
