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
import type { Payout, Booking, Payment } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────

type PayoutMethod = 'MPESA' | 'PAYPAL' | 'STRIPE' | 'BANK_TRANSFER';

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
        message: `A payout of KES ${amount.toFixed(2)} has been processed via ${payout.method}. Reference: ${payout.providerRef || 'Pending'}.`,
        type: 'SYSTEM_ALERT',
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
      payments: { take: 1 },
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

  const payment = booking.payments[0];
  if (!payment) {
    throw new Error(`No payment found for booking: ${bookingId}`);
  }

  if (payment.status !== 'COMPLETED') {
    throw new Error(`Payment not COMPLETED for booking ${bookingId.slice(0, 8)} (current: ${payment.status})`);
  }

  // 2. Check for existing payout (idempotency)
  // Use the JSON-encoded key format to avoid substring false matches
  const existingPayout = await db.payout.findFirst({
    where: { description: { contains: `"bookingId":"${bookingId}"` } },
  });

  if (existingPayout) {
    return {
      success: true,
      payout: existingPayout,
      message: 'Payout already exists for this booking',
    };
  }

  // 3. Calculate amounts
  const platformSetting = await db.platformSetting.findFirst({ where: { key: 'platformFee' } });
  const feePercentage = platformSetting ? parseFloat(platformSetting.value) : 15.0;
  const grossAmount = payment.amount;
  const platformFee = Math.round(grossAmount * (feePercentage / 100) * 100) / 100;
  const providerAmount = grossAmount - platformFee;

  const providerUserId = booking.business.ownerId;

  // 4. Determine payout method
  const payoutMethod = determinePayoutMethod(payment.method);

  // 5. Create payout record
  const payout = await db.payout.create({
    data: {
      businessId: booking.businessId,
      userId: providerUserId,
      amount: grossAmount,
      method: payoutMethod,
      status: 'PROCESSING',
      transactionRef: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: JSON.stringify({
        bookingId,
        paymentId: payment.id,
        initiatedBy: initiatedBy || 'SYSTEM',
        bookingTotal: grossAmount,
        platformFee,
        netAmount: providerAmount,
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
        failedReason: walletError instanceof Error ? walletError.message : 'Insufficient wallet balance',
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
        failedReason: providerError instanceof Error ? providerError.message : 'Provider API call failed',
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
      providerRef: providerResult.reference,
      failedReason: providerResult.success ? null : 'Provider returned failure',
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
      ? `Payout of KES ${providerAmount.toFixed(2)} processed via ${payoutMethod}`
      : `Payout failed: ${updatedPayout.failedReason}`,
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

  // Extract bookingId from description
  let bookingId: string | null = null;
  try {
    const desc = payout.description ? JSON.parse(payout.description) : {};
    bookingId = desc.bookingId || null;
  } catch {
    // description parse failed
  }

  if (!bookingId) {
    throw new Error(`Cannot retry: no bookingId found in payout description for ${payoutId}`);
  }

  // Reset payout status
  await db.payout.update({
    where: { id: payoutId },
    data: {
      status: 'PENDING',
      failedReason: null,
      providerRef: null,
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
  const setting = await db.platformSetting.findFirst({ where: { key: 'platformFee' } });
  const feePercentage = setting ? parseFloat(setting.value) : 15.0;
  const fee = Math.round(amount * (feePercentage / 100) * 100) / 100;
  return Math.round((amount - fee) * 100) / 100;
}

/**
 * Get aggregate payout summary for admin dashboards.
 */
export async function getPayoutSummary(): Promise<PayoutSummary> {
  const [paid, pending, failed, onHold] = await Promise.all([
    db.payout.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
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
  ]);

  // Estimate platform fees from the fee percentage setting
  const feeSetting = await db.platformSetting.findFirst({ where: { key: 'platformFee' } });
  const feePercentage = feeSetting ? parseFloat(feeSetting.value) : 15.0;
  const totalPaidAmount = paid._sum.amount || 0;
  const totalPlatformFees = Math.round(totalPaidAmount * (feePercentage / 100) * 100) / 100;

  return {
    totalPaid: totalPaidAmount,
    totalPending: pending._sum.amount || 0,
    totalFailed: failed._sum.amount || 0,
    totalOnHold: onHold._sum.amount || 0,
    totalPlatformFees,
    paidCount: paid._count.id,
    pendingCount: pending._count.id,
    failedCount: failed._count.id,
  };
}
