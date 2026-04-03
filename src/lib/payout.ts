/**
 * Automated Payout System
 *
 * Payout triggers when:
 *   paymentStatus = COMPLETED
 *   AND bookingStatus = VERIFIED
 *   AND payoutStatus = PENDING (no existing payout)
 *
 * Methods:
 *   - M-Pesa B2C for Kenyan providers
 *   - Paystack Transfer for card-based providers
 *   - Manual fallback for admin
 *
 * M-Pesa B2C: PLACEHOLDER — logs the B2C request but returns success.
 *             Real B2C requires Safaricom production approval.
 *
 * Paystack Transfer: PLACEHOLDER — stores the transfer intent.
 *                    Activate with real credentials when ready.
 */

import { db } from '@/lib/db';
import { deductForPayout } from '@/lib/wallet';
import { logTransaction } from '@/lib/transaction-log';
import type { Payout, Booking, Payment, PayoutMethod } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PayoutResult {
  success: boolean;
  payout: Payout;
  message?: string;
}

export interface BulkPayoutResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    bookingId: string;
    success: boolean;
    payoutId?: string;
    error?: string;
  }>;
}

export interface PayoutSummary {
  totalPaid: number;
  totalPending: number;
  totalFailed: number;
  totalOnHold: number;
  totalPlatformFees: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
}

// ── Internal: M-Pesa B2C Placeholder ──────────────────────────────────────

/**
 * M-Pesa B2C (Business to Customer) payout.
 *
 * PLACEHOLDER: Logs the B2C request and returns a fake success response.
 * In production, this would call Safaricom's B2C API:
 *   POST /mpesa/b2c/v1/paymentrequest
 *   Requires: InitiatorName, SecurityCredential, CommandID=BusinessPayment,
 *             Amount, PartyA, PartyB, Remarks, QueueTimeOutURL, ResultURL
 *
 * B2C requires Safaricom production approval — not available in sandbox.
 */
async function initiateMpesaB2C(
  phone: string,
  amount: number,
  bookingId: string,
  payoutId: string,
): Promise<{ success: boolean; reference: string }> {
  // ── PLACEHOLDER: Log and return fake success ──────────────────────
  const reference = `MPESA-B2C-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Payout][M-Pesa B2C PLACEHOLDER] booking=${bookingId.slice(0, 8)} ` +
      `payout=${payoutId.slice(0, 8)} amount=${amount} phone=${phone} ref=${reference}`,
    );
  }

  return { success: true, reference };
}

// ── Internal: Paystack Transfer Placeholder ────────────────────────────────

/**
 * Paystack Transfer API call.
 *
 * PLACEHOLDER: Stores the transfer intent and returns a fake success response.
 * In production, this calls Paystack's /transfer endpoint with:
 *   { source: 'balance', amount, recipient, reference, reason }
 *
 * Prerequisites for production:
 *   1. Create a Transfer Recipient via /transferrecipient
 *   2. Ensure Paystack balance is funded
 *   3. Handle transfer callbacks (webhook)
 */
async function initiatePaystackTransfer(
  recipientCode: string,
  amount: number,
  bookingId: string,
  payoutId: string,
): Promise<{ success: boolean; reference: string; transferCode: string }> {
  // ── PLACEHOLDER: Log and return fake success ──────────────────────
  const reference = `PAYSTACK-TXF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const transferCode = `TRF_${Math.random().toString(36).slice(2, 14).toUpperCase()}`;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Payout][Paystack Transfer PLACEHOLDER] booking=${bookingId.slice(0, 8)} ` +
      `payout=${payoutId.slice(0, 8)} amount=${amount} recipient=${recipientCode} ref=${reference}`,
    );
  }

  return { success: true, reference, transferCode };
}

// ── Internal: Determine payout method ─────────────────────────────────────

/**
 * Determine the appropriate payout method based on the payment method
 * used for the booking.
 */
function determinePayoutMethod(paymentMethod: string): PayoutMethod {
  switch (paymentMethod) {
    case 'MPESA':
      return 'MPESA';
    case 'PAYPAL':
      return 'PAYPAL';
    case 'STRIPE':
    case 'PAYSTACK':
      return 'STRIPE';
    default:
      return 'BANK_TRANSFER';
  }
}

// ── Internal: Create notification (fire-and-forget) ────────────────────────

async function notifyProvider(
  userId: string,
  payout: Payout,
  amount: number,
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId,
        title: 'Payout Processed',
        message: `A payout of ${payout.currency} ${amount.toFixed(2)} has been processed via ${payout.method}. Reference: ${payout.referenceNumber || 'Pending'}. Expected arrival: ${payout.estimatedArrival?.toLocaleDateString() || 'Processing'}`,
        type: 'SYSTEM_ALERT',
        data: JSON.stringify({
          payoutId: payout.id,
          amount,
          method: payout.method,
          status: payout.status,
          reference: payout.referenceNumber,
        }),
      },
    });
  } catch {
    // Notification failure never blocks payout
  }
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Trigger a payout for a verified booking.
 *
 * Preconditions:
 *   1. Booking exists
 *   2. Booking status is VERIFIED
 *   3. Payment exists and status is COMPLETED
 *   4. No existing payout for this booking
 *   5. Provider wallet has sufficient balance
 *
 * @param bookingId   - The booking to pay out
 * @param initiatedBy - Optional user ID who initiated (admin or system)
 */
export async function triggerPayout(
  bookingId: string,
  initiatedBy?: string,
): Promise<PayoutResult> {
  // 1. Fetch booking with all relations
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      business: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          phone: true,
          country: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  if (booking.status !== 'VERIFIED') {
    throw new Error(`Booking ${bookingId.slice(0, 8)} is not VERIFIED (current: ${booking.status})`);
  }

  if (!booking.payment) {
    throw new Error(`No payment found for booking: ${bookingId}`);
  }

  if (booking.payment.status !== 'COMPLETED') {
    throw new Error(`Payment not COMPLETED for booking ${bookingId.slice(0, 8)} (current: ${booking.payment.status})`);
  }

  // 2. Check for existing payout (idempotency)
  const existingPayout = await db.payout.findFirst({
    where: { metadata: { contains: bookingId } },
  });

  // More thorough check: look for payout records linked to this booking
  const existingPayoutByTxIds = await db.payout.findFirst({
    where: {
      transactionIds: { contains: bookingId },
    },
  });

  if (existingPayout || existingPayoutByTxIds) {
    return {
      success: true,
      payout: existingPayout || existingPayoutByTxIds!,
      message: 'Payout already exists for this booking',
    };
  }

  // 3. Calculate amounts
  const platformSetting = await db.platformSetting.findFirst();
  const feePercentage = platformSetting?.platformFee ?? 15.0;
  const grossAmount = booking.payment.amount;
  const platformFee = Math.round(grossAmount * (feePercentage / 100) * 100) / 100;
  const providerAmount = grossAmount - platformFee;

  const providerUserId = booking.business.ownerId;

  // 4. Determine payout method
  const payoutMethod = determinePayoutMethod(booking.payment.paymentMethod);

  // 5. Create payout record
  const payout = await db.payout.create({
    data: {
      businessId: booking.businessId,
      amount: grossAmount,
      currency: booking.payment.currency,
      method: payoutMethod,
      status: 'PROCESSING',
      transactionIds: JSON.stringify([booking.payment.id, bookingId]),
      fees: platformFee,
      netAmount: providerAmount,
      estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 business days
      metadata: JSON.stringify({
        bookingId,
        paymentId: booking.payment.id,
        initiatedBy: initiatedBy || 'SYSTEM',
        bookingTotal: grossAmount,
      }),
    },
  });

  // 6. Deduct from provider wallet (uses its own tx internally)
  try {
    await deductForPayout(providerUserId, providerAmount, payout.id);
  } catch (walletError) {
    // If wallet deduction fails, mark payout as failed
    await db.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        failureReason: walletError instanceof Error ? walletError.message : 'Insufficient wallet balance',
      },
    });

    throw new Error(`Wallet deduction failed: ${walletError instanceof Error ? walletError.message : 'Unknown error'}`);
  }

  // 7. Call provider-specific payout API
  let providerResult: { success: boolean; reference: string };

  try {
    switch (payoutMethod) {
      case 'MPESA': {
        const phone = booking.business.phone || '';
        providerResult = await initiateMpesaB2C(phone, providerAmount, bookingId, payout.id);
        break;
      }
      case 'STRIPE': {
        const recipientCode = `RCP_${booking.business.ownerId.slice(0, 10)}`;
        providerResult = await initiatePaystackTransfer(recipientCode, providerAmount, bookingId, payout.id);
        break;
      }
      default: {
        // Manual/Bank transfer — mark as PENDING for admin processing
        providerResult = { success: true, reference: `MANUAL-${payout.id.slice(0, 8)}` };
        await db.payout.update({
          where: { id: payout.id },
          data: { status: 'PENDING' },
        });
        break;
      }
    }
  } catch (providerError) {
    await db.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        failureReason: providerError instanceof Error ? providerError.message : 'Provider API call failed',
      },
    });

    throw new Error(`Payout provider error: ${providerError instanceof Error ? providerError.message : 'Unknown'}`);
  }

  // 8. Update payout status
  const finalStatus = providerResult.success ? 'COMPLETED' : 'FAILED';
  const updatedPayout = await db.payout.update({
    where: { id: payout.id },
    data: {
      status: finalStatus,
      referenceNumber: providerResult.reference,
      processedAt: finalStatus === 'COMPLETED' ? new Date() : null,
      completedAt: finalStatus === 'COMPLETED' ? new Date() : null,
      failureReason: providerResult.success ? null : 'Provider returned failure',
    },
  });

  // 9. Log the payout (fire-and-forget)
  await logTransaction({
    userId: providerUserId,
    bookingId,
    amount: providerAmount,
    type: 'PAYOUT_SENT',
    status: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
    referenceId: payout.id,
    provider: payoutMethod,
    metadata: {
      payoutId: payout.id,
      reference: providerResult.reference,
      method: payoutMethod,
      grossAmount,
      platformFee,
      netAmount: providerAmount,
      initiatedBy: initiatedBy || 'SYSTEM',
    },
  });

  // 10. Notify provider (fire-and-forget)
  await notifyProvider(providerUserId, updatedPayout, providerAmount);

  return {
    success: providerResult.success,
    payout: updatedPayout,
    message: providerResult.success
      ? `Payout of ${payout.currency} ${providerAmount.toFixed(2)} processed via ${payoutMethod}`
      : `Payout failed: ${updatedPayout.failureReason}`,
  };
}

/**
 * Trigger payouts for multiple bookings in batch.
 * Used by admin for bulk payout processing.
 *
 * @param bookingIds  - Array of booking IDs to pay out
 * @param initiatedBy - Admin user ID
 */
export async function triggerBulkPayouts(
  bookingIds: string[],
  initiatedBy: string,
): Promise<BulkPayoutResult> {
  const results: BulkPayoutResult['results'] = [];
  let succeeded = 0;
  let failed = 0;

  for (const bookingId of bookingIds) {
    try {
      const result = await triggerPayout(bookingId, initiatedBy);
      results.push({
        bookingId,
        success: result.success,
        payoutId: result.payout.id,
        error: result.success ? undefined : result.message,
      });
      if (result.success) succeeded++;
      else failed++;
    } catch (error) {
      results.push({
        bookingId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failed++;
    }
  }

  return {
    total: bookingIds.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Get all payouts for a specific business.
 *
 * @param businessId - The business ID
 */
export async function getPayoutsForBusiness(businessId: string): Promise<Payout[]> {
  return db.payout.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all pending payouts (awaiting processing).
 * Admin-only function.
 */
export async function getPendingPayouts(): Promise<Payout[]> {
  return db.payout.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Retry a failed payout.
 * Resets status to PENDING and re-triggers the payout flow.
 *
 * @param payoutId - The failed payout ID
 */
export async function retryFailedPayout(payoutId: string): Promise<PayoutResult> {
  const payout = await db.payout.findUnique({ where: { id: payoutId } });

  if (!payout) {
    throw new Error(`Payout not found: ${payoutId}`);
  }

  if (payout.status !== 'FAILED') {
    throw new Error(`Payout ${payoutId.slice(0, 8)} is not FAILED (current: ${payout.status})`);
  }

  // Extract bookingId from metadata
  let bookingId: string | null = null;
  try {
    const metadata = payout.metadata ? JSON.parse(payout.metadata) : {};
    bookingId = metadata.bookingId || null;
  } catch {
    // metadata parse failed
  }

  if (!bookingId) {
    throw new Error(`Cannot retry: no bookingId found in payout metadata for ${payoutId}`);
  }

  // Reset payout status
  await db.payout.update({
    where: { id: payoutId },
    data: {
      status: 'PENDING',
      failureReason: null,
      referenceNumber: null,
    },
  });

  // Re-trigger the payout
  return triggerPayout(bookingId, 'SYSTEM_RETRY');
}

/**
 * Calculate the provider's net amount after platform fee.
 *
 * @param amount - The gross payment amount
 * @returns The provider's net amount (gross - platform fee)
 */
export async function calculateProviderAmount(amount: number): Promise<number> {
  const setting = await db.platformSetting.findFirst();
  const feePercentage = setting?.platformFee ?? 15.0;
  const fee = Math.round(amount * (feePercentage / 100) * 100) / 100;
  return Math.round((amount - fee) * 100) / 100;
}

/**
 * Get aggregate payout summary for admin dashboards.
 */
export async function getPayoutSummary(): Promise<PayoutSummary> {
  const [paid, pending, failed, onHold, fees] = await Promise.all([
    db.payout.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true, fees: true },
      _count: { id: true },
    }),
    db.payout.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.payout.aggregate({
      where: { status: 'FAILED' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.payout.aggregate({
      where: { status: 'ON_HOLD' },
      _sum: { amount: true },
    }),
    db.payout.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { fees: true },
    }),
  ]);

  return {
    totalPaid: paid._sum.amount || 0,
    totalPending: pending._sum.amount || 0,
    totalFailed: failed._sum.amount || 0,
    totalOnHold: onHold._sum.amount || 0,
    totalPlatformFees: fees._sum.fees || 0,
    paidCount: paid._count.id || 0,
    pendingCount: pending._count.id || 0,
    failedCount: failed._count.id || 0,
  };
}
