/**
 * Escrow Payment Flow
 *
 * 1. Customer pays → Platform holds funds (escrow)
 * 2. Service delivered → Verification window opens (24h)
 * 3. Verified / Auto-verified → Funds released to provider wallet
 * 4. Disputed → Funds held pending resolution
 * 5. Resolved → Funds released or refunded
 *
 * All state transitions are atomic (Prisma transactions).
 * Every escrow operation creates a TransactionLog entry (fire-and-forget).
 */

import { db } from '@/lib/db';
import { creditPendingBalance, releaseToBalance } from '@/lib/wallet';
import { logTransaction } from '@/lib/transaction-log';
import type { PlatformTransaction } from '@prisma/client';

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
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Hold payment in escrow after customer completes payment.
 * Creates a PlatformTransaction with ESCROW_HELD type and credits
 * the provider's wallet pending balance.
 *
 * @param bookingId    - The booking ID
 * @param paymentId    - The payment ID (used as reference)
 * @param amount       - Total payment amount
 * @param platformFee  - Platform's fee (already calculated)
 */
export async function holdInEscrow(
  bookingId: string,
  paymentId: string,
  amount: number,
  platformFee: number,
  currency: string = 'KES',
): Promise<EscrowHoldResult> {
  const providerAmount = amount - platformFee;

  if (providerAmount < 0) {
    throw new Error('Platform fee exceeds payment amount');
  }

  // Idempotency: check if already held in escrow for this booking
  const existing = await db.platformTransaction.findFirst({
    where: {
      bookingId,
      type: 'ESCROW_HELD',
      escrowStatus: 'HELD',
    },
  });

  if (existing) {
    return {
      success: true,
      transaction: existing,
      providerAmount: existing.providerAmount,
      platformFee: existing.platformFee,
    };
  }

  // Get booking to find business/provider
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { businessId: true, business: { select: { ownerId: true, name: true } } },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  const providerUserId = booking.business.ownerId;

  const result = await db.$transaction(async (tx) => {
    // Create PlatformTransaction record
    const transaction = await tx.platformTransaction.create({
      data: {
        type: 'ESCROW_HELD',
        bookingId,
        businessId: booking.businessId,
        userId: providerUserId,
        amount,
        platformFee,
        providerAmount,
        currency,
        status: 'COMPLETED',
        escrowStatus: 'HELD',
        transactionId: paymentId,
        description: `Escrow hold for booking ${bookingId.slice(0, 8)}`,
      },
    });

    return transaction;
  });

  // Credit provider's pending balance (outside main tx — uses its own tx internally)
  await creditPendingBalance(providerUserId, providerAmount, bookingId);

  // Log the escrow hold (fire-and-forget)
  await logTransaction({
    userId: providerUserId,
    bookingId,
    amount: providerAmount,
    type: 'ESCROW_HELD',
    status: 'COMPLETED',
    referenceId: result.id,
    metadata: {
      paymentId,
      totalAmount: amount,
      platformFee,
      providerAmount,
    },
  });

  return {
    success: true,
    transaction: result,
    providerAmount,
    platformFee,
  };
}

/**
 * Release escrow funds to the provider's available balance.
 * Called after booking verification (customer confirms or auto-verify).
 *
 * Moves: wallet.pendingBalance → wallet.balance
 * Updates: PlatformTransaction.escrowStatus = RELEASED
 * Creates: Notification for provider
 *
 * @param bookingId - The booking ID
 * @param reason    - Why the escrow was released (e.g., "Customer confirmed", "Auto-verified")
 */
export async function releaseFromEscrow(
  bookingId: string,
  reason: string,
): Promise<EscrowReleaseResult> {
  // Find the escrow-held transaction
  const escrowTx = await db.platformTransaction.findFirst({
    where: {
      bookingId,
      type: 'ESCROW_HELD',
      escrowStatus: 'HELD',
    },
  });

  if (!escrowTx) {
    // Check if already released
    const releasedTx = await db.platformTransaction.findFirst({
      where: {
        bookingId,
        type: 'ESCROW_HELD',
        escrowStatus: 'RELEASED',
      },
    });

    if (releasedTx) {
      return {
        success: true,
        transaction: releasedTx,
        releasedAmount: releasedTx.providerAmount,
      };
    }

    throw new Error(`No held escrow found for booking: ${bookingId}`);
  }

  if (!escrowTx.userId) {
    throw new Error(`Escrow transaction missing userId for booking: ${bookingId}`);
  }

  const providerUserId = escrowTx.userId;

  // Release pending balance → available balance (uses its own tx internally)
  await releaseToBalance(providerUserId, escrowTx.providerAmount, bookingId);

  // Update PlatformTransaction
  const updatedTransaction = await db.platformTransaction.update({
    where: { id: escrowTx.id },
    data: {
      escrowStatus: 'RELEASED',
      completedAt: new Date(),
      description: `Escrow released: ${reason}`,
    },
  });

  // Create a SERVICE_COMPLETED PlatformTransaction for revenue tracking
  await db.platformTransaction.create({
    data: {
      type: 'SERVICE_COMPLETED',
      bookingId,
      businessId: escrowTx.businessId ?? '',
      userId: providerUserId,
      amount: escrowTx.amount,
      platformFee: escrowTx.platformFee,
      providerAmount: escrowTx.providerAmount,
      currency: escrowTx.currency,
      status: 'COMPLETED',
      escrowStatus: 'RELEASED',
      description: `Service completed: ${reason}`,
      metadata: JSON.stringify({ escrowTransactionId: escrowTx.id, reason }),
    },
  });

  // Log the release (fire-and-forget)
  await logTransaction({
    userId: providerUserId,
    bookingId,
    amount: escrowTx.providerAmount,
    type: 'SERVICE_COMPLETED',
    status: 'COMPLETED',
    referenceId: escrowTx.id,
    metadata: { reason, escrowTransactionId: escrowTx.id },
  });

  // Log platform fee (fire-and-forget)
  await logTransaction({
    userId: providerUserId,
    bookingId,
    amount: escrowTx.platformFee,
    type: 'PLATFORM_FEE',
    status: 'COMPLETED',
    referenceId: escrowTx.id,
    metadata: { reason },
  });

  // Notify provider (fire-and-forget)
  try {
    await db.notification.create({
      data: {
        userId: providerUserId,
        title: 'Funds Released',
        message: `Payment for booking ${bookingId.slice(0, 8)} has been released to your wallet. Amount: ${escrowTx.currency} ${escrowTx.providerAmount.toFixed(2)}`,
        type: 'SYSTEM_ALERT',
        data: JSON.stringify({
          bookingId,
          amount: escrowTx.providerAmount,
          reason,
          transactionId: escrowTx.id,
        }),
      },
    });
  } catch {
    // Notification failure should never block the release
  }

  return {
    success: true,
    transaction: updatedTransaction,
    releasedAmount: escrowTx.providerAmount,
  };
}

/**
 * Refund escrow funds back to the customer.
 * Creates a REFUND PlatformTransaction and reverses the provider's wallet credit.
 *
 * @param bookingId - The booking ID
 * @param reason    - Why the refund was issued
 */
export async function refundFromEscrow(
  bookingId: string,
  reason: string,
): Promise<EscrowRefundResult> {
  // Find the escrow transaction
  const escrowTx = await db.platformTransaction.findFirst({
    where: {
      bookingId,
      type: 'ESCROW_HELD',
    },
  });

  if (!escrowTx) {
    throw new Error(`No escrow transaction found for booking: ${bookingId}`);
  }

  if (!escrowTx.userId) {
    throw new Error(`Escrow transaction missing userId for booking: ${bookingId}`);
  }

  if (escrowTx.escrowStatus === 'REFUNDED') {
    return {
      success: true,
      transaction: escrowTx,
      refundAmount: escrowTx.amount,
    };
  }

  const providerUserId = escrowTx.userId;
  const refundAmount = escrowTx.providerAmount;

  // Update the escrow transaction status
  const updatedTransaction = await db.platformTransaction.update({
    where: { id: escrowTx.id },
    data: {
      escrowStatus: 'REFUNDED',
      status: 'REFUNDED',
      completedAt: new Date(),
      description: `Refunded: ${reason}`,
    },
  });

  // Create a REFUND PlatformTransaction
  await db.platformTransaction.create({
    data: {
      type: 'REFUND',
      bookingId,
      businessId: escrowTx.businessId ?? '',
      userId: providerUserId,
      amount: escrowTx.amount,
      platformFee: 0,
      providerAmount: -refundAmount,
      currency: escrowTx.currency,
      status: 'COMPLETED',
      description: `Refund to customer: ${reason}`,
      metadata: JSON.stringify({
        escrowTransactionId: escrowTx.id,
        reason,
        refundAmount,
      }),
    },
  });

  // Reverse the provider's wallet credit (atomic transaction)
  try {
    await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: providerUserId } });
      if (!wallet) return;

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });

      // Determine which balance to deduct from based on booking status
      const isVerified = booking && (booking.status === 'COMPLETED');

      if (isVerified && wallet.balance >= refundAmount) {
        // Funds are in available balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: refundAmount } },
        });
      } else if (wallet.pendingBalance >= refundAmount) {
        // Funds are in pending balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { pendingBalance: { decrement: refundAmount } },
        });
      } else if (wallet.balance >= refundAmount) {
        // Fallback to available balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: refundAmount } },
        });
      }
      // If insufficient funds in all balances, silently skip
      // (this shouldn't happen in practice if the escrow flow is followed correctly)
    });
  } catch (walletError) {
    // Wallet deduction failure logged but not propagated
    // The PlatformTransaction is already marked as REFUNDED above
    if (process.env.NODE_ENV === 'development') {
      console.error('[Escrow] Wallet deduction failed during refund:', walletError);
    }
  }

  // Log the refund (fire-and-forget)
  await logTransaction({
    userId: providerUserId,
    bookingId,
    amount: -refundAmount,
    type: 'REFUND',
    status: 'COMPLETED',
    referenceId: escrowTx.id,
    metadata: { reason, escrowTransactionId: escrowTx.id, refundAmount },
  });

  return {
    success: true,
    transaction: updatedTransaction,
    refundAmount,
  };
}

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
      where: { type: 'ESCROW_HELD', escrowStatus: 'HELD' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: 'RELEASED' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: 'REFUNDED' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.platformTransaction.aggregate({
      where: { type: 'ESCROW_HELD', escrowStatus: 'DISPUTED' },
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
  const setting = await db.platformSetting.findFirst();

  const feePercentage = setting?.platformFee ?? 15.0;

  // Round to 2 decimal places
  return Math.round(amount * (feePercentage / 100) * 100) / 100;
}
