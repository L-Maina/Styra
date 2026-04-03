/**
 * Internal Wallet System for Providers
 *
 * - balance: Available for withdrawal (verified + not-disputed funds)
 * - pendingBalance: Funds from completed payments, not yet verified
 * - heldBalance: Funds held during active disputes
 * - currency: Provider's default currency
 *
 * Flow:
 *   Payment PAID → providerAmount goes to pendingBalance
 *   Booking VERIFIED → pendingBalance → balance
 *   Payout triggered → deduct from balance
 *   Refund → deduct from balance
 *   Dispute → deduct from balance (reversed on resolution)
 *
 * All balance mutations use Prisma interactive transactions to ensure atomicity.
 * Negative balances are NEVER allowed — operations will fail with an error.
 */

import { db } from '@/lib/db';
import type { Wallet, Prisma } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalletOperationResult {
  success: boolean;
  wallet: Wallet;
  message?: string;
}

export interface WalletSummary {
  wallet: Wallet;
  totalEarnings: number;
  totalPending: number;
  totalHeld: number;
  totalWithdrawn: number;
}

export interface PlatformWalletStats {
  totalBalance: number;
  totalPending: number;
  totalHeld: number;
  activeWallets: number;
  totalProvidersWithFunds: number;
}

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Ensure a wallet exists for the given user. Creates one if missing.
 */
async function ensureWallet(tx: Prisma.TransactionClient, userId: string): Promise<Wallet> {
  const existing = await tx.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  return tx.wallet.create({
    data: { userId },
  });
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Get or create a wallet for the given user.
 */
export async function getWallet(userId: string): Promise<Wallet> {
  const existing = await db.wallet.findUnique({ where: { userId } });

  if (existing) return existing;

  // Use upsert for race-condition safety
  return db.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/**
 * Credit pending balance after a payment is received.
 * Used when escrow holds funds and the provider's share goes to pending.
 *
 * @param userId  - The provider's user ID (business owner)
 * @param amount  - The provider's portion of the payment
 * @param bookingId - The associated booking (used for idempotency)
 */
export async function creditPendingBalance(
  userId: string,
  amount: number,
  bookingId: string,
): Promise<WalletOperationResult> {
  if (amount < 0) {
    throw new Error('Credit amount cannot be negative');
  }

  const result = await db.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);

    // Idempotency: check if already credited for this booking
    const existingLog = await tx.transactionLog.findFirst({
      where: {
        userId,
        bookingId,
        type: 'ESCROW_HELD',
        status: 'COMPLETED',
      },
    });

    if (existingLog) {
      return {
        success: true,
        wallet,
        message: 'Already credited for this booking',
      };
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { pendingBalance: { increment: amount } },
    });

    return { success: true, wallet: updated };
  });

  return result;
}

/**
 * Release funds from pending balance to available balance.
 * Called after a booking is verified (service confirmed).
 *
 * @param userId    - The provider's user ID
 * @param amount    - Amount to move from pending to available
 * @param bookingId - The associated booking (idempotency key)
 */
export async function releaseToBalance(
  userId: string,
  amount: number,
  bookingId: string,
): Promise<WalletOperationResult> {
  if (amount < 0) {
    throw new Error('Release amount cannot be negative');
  }

  const result = await db.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);

    // Idempotency: check if already released for this booking
    const existingLog = await tx.transactionLog.findFirst({
      where: {
        userId,
        bookingId,
        type: 'SERVICE_COMPLETED',
        status: 'COMPLETED',
      },
    });

    if (existingLog) {
      return {
        success: true,
        wallet,
        message: 'Already released for this booking',
      };
    }

    if (wallet.pendingBalance < amount) {
      throw new Error(
        `Insufficient pending balance. Required: ${amount}, Available: ${wallet.pendingBalance}`,
      );
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        pendingBalance: { decrement: amount },
        balance: { increment: amount },
      },
    });

    return { success: true, wallet: updated };
  });

  return result;
}

/**
 * Move funds from available balance to held balance when a dispute is raised.
 *
 * @param userId    - The provider's user ID
 * @param amount    - The disputed amount
 * @param bookingId - The associated booking
 */
export async function holdForDispute(
  userId: string,
  amount: number,
  bookingId: string,
): Promise<WalletOperationResult> {
  if (amount < 0) {
    throw new Error('Hold amount cannot be negative');
  }

  const result = await db.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);

    // Idempotency: check if already held for this booking
    const existingLog = await tx.transactionLog.findFirst({
      where: {
        userId,
        bookingId,
        type: 'REFUND',
        status: 'FAILED',
        metadata: { contains: '"action":"DISPUTE_HOLD"' },
      },
    });

    if (existingLog) {
      return {
        success: true,
        wallet,
        message: 'Already held for this booking',
      };
    }

    // Try balance first, fall back to pendingBalance if balance insufficient
    let deductFrom: 'balance' | 'pendingBalance' = 'balance';
    let availableFunds = wallet.balance;

    if (wallet.balance < amount) {
      deductFrom = 'pendingBalance';
      availableFunds = wallet.pendingBalance;
    }

    if (availableFunds < amount) {
      throw new Error(
        `Insufficient funds for dispute hold. Required: ${amount}, Available (balance): ${wallet.balance}, Available (pending): ${wallet.pendingBalance}`,
      );
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        [deductFrom]: { decrement: amount },
        heldBalance: { increment: amount },
      },
    });

    return { success: true, wallet: updated };
  });

  return result;
}

/**
 * Return held funds back to available balance when a dispute is resolved in provider's favor.
 *
 * @param userId    - The provider's user ID
 * @param amount    - Amount to release from hold
 * @param bookingId - The associated booking
 */
export async function releaseDisputeHold(
  userId: string,
  amount: number,
  bookingId: string,
): Promise<WalletOperationResult> {
  if (amount < 0) {
    throw new Error('Release amount cannot be negative');
  }

  const result = await db.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);

    if (wallet.heldBalance < amount) {
      throw new Error(
        `Insufficient held balance. Required: ${amount}, Available: ${wallet.heldBalance}`,
      );
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        heldBalance: { decrement: amount },
        balance: { increment: amount },
      },
    });

    return { success: true, wallet: updated };
  });

  return result;
}

/**
 * Deduct from available balance for a payout.
 *
 * @param userId   - The provider's user ID
 * @param amount   - Payout amount
 * @param payoutId - The associated payout record ID
 */
export async function deductForPayout(
  userId: string,
  amount: number,
  payoutId: string,
): Promise<WalletOperationResult> {
  if (amount < 0) {
    throw new Error('Payout deduction amount cannot be negative');
  }

  const result = await db.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);

    // Idempotency: check if already deducted for this payout
    const existingLog = await tx.transactionLog.findFirst({
      where: {
        userId,
        referenceId: payoutId,
        type: 'PAYOUT_SENT',
        status: 'COMPLETED',
      },
    });

    if (existingLog) {
      return {
        success: true,
        wallet,
        message: 'Already deducted for this payout',
      };
    }

    if (wallet.balance < amount) {
      throw new Error(
        `Insufficient balance for payout. Required: ${amount}, Available: ${wallet.balance}`,
      );
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    return { success: true, wallet: updated };
  });

  return result;
}

/**
 * Refund amount back to the provider's available balance.
 * Used when a dispute is resolved in provider's favor, or when a refund is reversed.
 *
 * @param userId    - The provider's user ID
 * @param amount    - Amount to credit back
 * @param bookingId - The associated booking
 */
export async function refundToBalance(
  userId: string,
  amount: number,
  bookingId: string,
): Promise<WalletOperationResult> {
  if (amount < 0) {
    throw new Error('Refund amount cannot be negative');
  }

  const result = await db.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    return { success: true, wallet: updated };
  });

  return result;
}

/**
 * Get a comprehensive wallet summary including earnings breakdown.
 *
 * @param userId - The provider's user ID
 */
export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const wallet = await getWallet(userId);

  const [earningsResult, withdrawnResult] = await Promise.all([
    // Total earnings from completed services
    db.transactionLog.aggregate({
      where: {
        userId,
        type: 'SERVICE_COMPLETED',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    }),
    // Total withdrawn via payouts
    db.transactionLog.aggregate({
      where: {
        userId,
        type: 'PAYOUT_SENT',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    wallet,
    totalEarnings: earningsResult._sum.amount || 0,
    totalPending: wallet.pendingBalance,
    totalHeld: wallet.heldBalance,
    totalWithdrawn: withdrawnResult._sum.amount || 0,
  };
}

/**
 * Get aggregate platform-wide wallet statistics.
 * Admin-only function for financial dashboards.
 */
export async function getPlatformWalletStats(): Promise<PlatformWalletStats> {
  const aggregateResult = await db.wallet.aggregate({
    _sum: {
      balance: true,
      pendingBalance: true,
      heldBalance: true,
    },
    _count: { id: true },
  });

  const providersWithFunds = await db.wallet.count({
    where: {
      OR: [
        { balance: { gt: 0 } },
        { pendingBalance: { gt: 0 } },
        { heldBalance: { gt: 0 } },
      ],
    },
  });

  return {
    totalBalance: aggregateResult._sum.balance || 0,
    totalPending: aggregateResult._sum.pendingBalance || 0,
    totalHeld: aggregateResult._sum.heldBalance || 0,
    activeWallets: aggregateResult._count.id || 0,
    totalProvidersWithFunds: providersWithFunds,
  };
}
