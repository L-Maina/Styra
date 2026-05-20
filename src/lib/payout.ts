/**
 * Automated Payout System — Production-Ready
 *
 * Payout triggers when:
 *   paymentStatus = COMPLETED
 *   AND bookingStatus = VERIFIED
 *   AND payoutStatus = PENDING (no existing payout)
 *
 * Methods:
 *   - M-Pesa B2C for Kenyan providers (Safaricom Daraja API)
 *   - Paystack Transfer for bank-account-based providers
 *   - PayPal Payouts for international providers
 *   - Stripe Connect transfers for Stripe-connected providers
 *   - Manual fallback for unconfigured providers (admin processing)
 *
 * Idempotency:
 *   Uses prefix-based description matching: STYRA-PAYOUT-BOOKING-{bookingId}
 *   Prevents duplicate payouts for the same booking.
 *
 * Error handling:
 *   - Each provider call is wrapped in try/catch
 *   - Missing env vars → PENDING status for manual admin processing
 *   - Retry count tracked in description metadata
 */

import { db } from '@/lib/db';
import { deductForPayout } from '@/lib/wallet';
import { logTransaction } from '@/lib/transaction-log';
import { initiateMpesaB2C as mpesaB2C } from '@/lib/mpesa';
import type { MpesaB2CParams, MpesaB2CResult } from '@/lib/mpesa';
import { PaystackClient, getPaystackClient } from '@/lib/paystack';
import { createPayPalPayout } from '@/lib/paypal-payouts';
import type { PayPalPayoutResult } from '@/lib/paypal-payouts';
import type { Payout, Booking, Payment } from '@prisma/client';
import Stripe from 'stripe';

// ── Types ──────────────────────────────────────────────────────────────────

type PayoutMethod = 'MPESA' | 'PAYPAL' | 'STRIPE' | 'PAYSTACK' | 'BANK_TRANSFER';

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

/** Internal result from provider-specific payout calls */
interface ProviderPayoutResult {
  success: boolean;
  reference: string;
  /** Additional metadata from the provider (e.g. transfer code, batch ID) */
  metadata?: Record<string, unknown>;
}

/** Payout description stored in DB — structured for parsing */
interface PayoutDescription {
  bookingId: string;
  paymentId: string;
  initiatedBy: string;
  bookingTotal: number;
  platformFee: number;
  netAmount: number;
  retryCount: number;
  idempotencyKey: string;
  provider?: string;
  providerRef?: string;
  lastAttemptAt?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Prefix used for idempotency checks in payout description */
const IDEMPOTENCY_PREFIX = 'STYRA-PAYOUT-BOOKING-';

// ── Lazy Stripe Singleton ──────────────────────────────────────────────────

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  try {
    _stripe = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
      typescript: true,
    });
    return _stripe;
  } catch {
    console.error('[Payout][Stripe] Failed to initialize Stripe client');
    return null;
  }
}

// ── Internal: Real M-Pesa B2C ─────────────────────────────────────────────

/**
 * M-Pesa B2C (Business to Customer) payout via Safaricom Daraja API.
 *
 * Calls the real initiateMpesaB2C from @/lib/mpesa which sends an HTTP
 * request to the Safaricom B2C endpoint.
 *
 * If M-Pesa B2C is not configured (missing env vars), returns a failure
 * result so the caller can fall back to PENDING status.
 */
async function initiateMpesaB2CPayout(
  phone: string,
  amount: number,
  bookingId: string,
  payoutId: string,
): Promise<ProviderPayoutResult> {
  console.log(
    `[Payout][M-Pesa B2C] Initiating real B2C: booking=${bookingId.slice(0, 8)} ` +
    `payout=${payoutId.slice(0, 8)} amount=${amount} phone=${phone}`,
  );

  const params: MpesaB2CParams = {
    phoneNumber: phone,
    amount: Math.round(amount), // M-Pesa requires integer KES amount
    remarks: `Styra payout for booking ${bookingId.slice(0, 8)}`,
    occasion: 'Service payment',
    commandID: 'BusinessPayment',
  };

  const result: MpesaB2CResult = await mpesaB2C(params);

  if (!result.success) {
    console.error(
      `[Payout][M-Pesa B2C] FAILED: booking=${bookingId.slice(0, 8)} ` +
      `message=${result.message}`,
    );
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: result.message },
    };
  }

  console.log(
    `[Payout][M-Pesa B2C] SUCCESS: booking=${bookingId.slice(0, 8)} ` +
    `transactionId=${result.transactionId} message=${result.message}`,
  );

  return {
    success: true,
    reference: result.transactionId || `MPESA-B2C-${Date.now()}`,
    metadata: {
      providerMessage: result.message,
      conversationId: result.transactionId,
    },
  };
}

// ── Internal: Real Paystack Transfer ───────────────────────────────────────

/**
 * Paystack Transfer payout — creates a transfer recipient and initiates
 * a transfer from the Paystack balance.
 *
 * Flow:
 *   1. Create transfer recipient (bank account details from business)
 *   2. Initiate transfer to that recipient
 *
 * Amounts are converted to KOBO (smallest unit) by multiplying KES by 100.
 *
 * If Paystack is not configured (missing secret key), returns failure
 * so the caller can fall back to PENDING status.
 */
async function initiatePaystackTransferPayout(
  businessName: string,
  bankAccountDetails: string | null,
  amount: number,
  bookingId: string,
  payoutId: string,
): Promise<ProviderPayoutResult> {
  // 1. Verify Paystack is configured
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: 'Paystack not configured (PAYSTACK_SECRET_KEY missing)' },
    };
  }

  let client: PaystackClient;
  try {
    client = getPaystackClient(secretKey);
  } catch {
    client = new PaystackClient(secretKey);
  }

  // 2. Parse bank account details from business
  let bankDetails: { accountNumber: string; bankCode: string; accountName: string };
  try {
    if (!bankAccountDetails) {
      throw new Error('No bank account details configured for this business');
    }
    const parsed = JSON.parse(bankAccountDetails);
    if (!parsed.accountNumber || !parsed.bankCode) {
      throw new Error('Bank account details missing accountNumber or bankCode');
    }
    bankDetails = {
      accountNumber: parsed.accountNumber,
      bankCode: parsed.bankCode,
      accountName: parsed.accountName || businessName,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Invalid bank account details';
    console.error(`[Payout][Paystack] Bank details parse error: ${msg}`);
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: msg },
    };
  }

  console.log(
    `[Payout][Paystack] Initiating transfer: booking=${bookingId.slice(0, 8)} ` +
    `payout=${payoutId.slice(0, 8)} amount=${amount}KES ` +
    `account=${bankDetails.accountNumber} bank=${bankDetails.bankCode}`,
  );

  try {
    // 3. Create transfer recipient
    const recipientResult = await client.createTransferRecipient({
      type: 'nuban',
      name: bankDetails.accountName,
      account_number: bankDetails.accountNumber,
      bank_code: bankDetails.bankCode,
      currency: 'KES',
    });

    if (!recipientResult.success || !recipientResult.recipientCode) {
      const msg = recipientResult.message || 'Failed to create transfer recipient';
      console.error(`[Payout][Paystack] Recipient creation failed: ${msg}`);
      return {
        success: false,
        reference: '',
        metadata: { providerMessage: msg },
      };
    }

    const recipientCode = recipientResult.recipientCode;

    // 4. Initiate transfer (amount in KOBO = KES * 100)
    const amountInKobo = Math.round(amount * 100);
    const transferReference = `STY-TXF-${Date.now()}-${bookingId.slice(0, 8)}`;

    const transferResult = await client.createTransfer({
      source: 'balance',
      amount: amountInKobo,
      recipient: recipientCode,
      reference: transferReference,
      reason: `Styra payout for booking ${bookingId.slice(0, 8)}`,
      currency: 'KES',
    });

    console.log(
      `[Payout][Paystack] Transfer initiated: code=${transferResult.transferCode} ` +
      `status=${transferResult.status} ref=${transferResult.reference}`,
    );

    return {
      success: true,
      reference: transferResult.transferCode || transferReference,
      metadata: {
        transferCode: transferResult.transferCode,
        transferStatus: transferResult.status,
        recipientCode,
        amountInKobo,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Paystack transfer failed';
    console.error(`[Payout][Paystack] Transfer error: ${msg}`);
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: msg },
    };
  }
}

// ── Internal: Real PayPal Payout ───────────────────────────────────────────

/**
 * PayPal Payout — sends money from the Styra business PayPal account
 * to a provider's PayPal email address.
 *
 * Uses the real createPayPalPayout from @/lib/paypal-payouts which
 * calls PayPal's v1/payments/payouts API.
 *
 * If PayPal is not configured (missing client ID/secret), returns failure
 * so the caller can fall back to PENDING status.
 */
async function initiatePayPalPayout(
  recipientEmail: string,
  amount: number,
  currency: string,
  bookingId: string,
  payoutId: string,
): Promise<ProviderPayoutResult> {
  if (!recipientEmail) {
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: 'No PayPal email configured for this business' },
    };
  }

  console.log(
    `[Payout][PayPal] Initiating payout: booking=${bookingId.slice(0, 8)} ` +
    `payout=${payoutId.slice(0, 8)} amount=${amount} ${currency} email=${recipientEmail}`,
  );

  try {
    const result: PayPalPayoutResult = await createPayPalPayout({
      recipientEmail,
      amount,
      currency,
      senderItemId: `STY-PP-${payoutId.slice(0, 12)}`,
      note: `Styra payout for booking ${bookingId.slice(0, 8)}`,
    });

    if (!result.success) {
      console.error(
        `[Payout][PayPal] FAILED: booking=${bookingId.slice(0, 8)} ` +
        `message=${result.message}`,
      );
      return {
        success: false,
        reference: '',
        metadata: { providerMessage: result.message },
      };
    }

    console.log(
      `[Payout][PayPal] SUCCESS: booking=${bookingId.slice(0, 8)} ` +
      `batchId=${result.batchId} message=${result.message}`,
    );

    return {
      success: true,
      reference: result.batchId || `PAYPAL-${Date.now()}`,
      metadata: {
        batchId: result.batchId,
        providerMessage: result.message,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'PayPal payout failed';
    console.error(`[Payout][PayPal] Error: ${msg}`);
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: msg },
    };
  }
}

// ── Internal: Real Stripe Connect Transfer ─────────────────────────────────

/**
 * Stripe Connect payout — creates a transfer to a connected Stripe account.
 *
 * If the business has a Stripe Connect account (stripeAccountId), creates
 * a Stripe transfer. If no connected account exists, falls back to
 * PENDING status for manual admin processing.
 *
 * Stripe amounts are in cents (smallest currency unit).
 */
async function initiateStripeTransfer(
  stripeAccountId: string | null,
  amount: number,
  bookingId: string,
  payoutId: string,
): Promise<ProviderPayoutResult> {
  const stripe = getStripeClient();

  if (!stripe) {
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: 'Stripe not configured (STRIPE_SECRET_KEY missing)' },
    };
  }

  if (!stripeAccountId) {
    return {
      success: false,
      reference: '',
      metadata: { providerMessage: 'No Stripe Connect account configured for this business. Manual processing required.' },
    };
  }

  console.log(
    `[Payout][Stripe] Initiating transfer: booking=${bookingId.slice(0, 8)} ` +
    `payout=${payoutId.slice(0, 8)} amount=${amount}KES account=${stripeAccountId}`,
  );

  try {
    const amountInCents = Math.round(amount * 100); // Stripe uses cents

    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'kes',
      destination: stripeAccountId,
      transfer_group: bookingId,
      metadata: {
        bookingId,
        payoutId,
        platform: 'styra',
      },
    });

    console.log(
      `[Payout][Stripe] Transfer created: id=${transfer.id} ` +
      `amount=${amountInCents} destination=${stripeAccountId}`,
    );

    return {
      success: true,
      reference: transfer.id,
      metadata: {
        stripeTransferId: transfer.id,
        stripeTransferStatus: (transfer as unknown as Record<string, unknown>).status as string || 'unknown',
        amountInCents,
        destination: stripeAccountId,
      },
    };
  } catch (error) {
    let msg = 'Stripe transfer failed';
    if (error instanceof Error) {
      msg = error.message;
    }
    // Stripe SDK errors have a 'type' property
    const stripeError = error as { type?: string; code?: string; message?: string };
    if (stripeError.type) {
      msg = `Stripe error (${stripeError.type}): ${stripeError.message || msg}`;
    }

    console.error(`[Payout][Stripe] Transfer error: ${msg}`);
    return {
      success: false,
      reference: '',
      metadata: {
        providerMessage: msg,
        stripeErrorCode: stripeError.code,
        stripeErrorType: stripeError.type,
      },
    };
  }
}

// ── Internal: Determine payout method ─────────────────────────────────────

/**
 * Determine the appropriate payout method based on the payment method
 * used for the booking.
 *
 * Returns a PayoutMethod enum string that determines which provider API
 * to call for the actual disbursement.
 */
function determinePayoutMethod(paymentMethod: string): PayoutMethod {
  switch (paymentMethod) {
    case 'MPESA':
      return 'MPESA';
    case 'PAYPAL':
      return 'PAYPAL';
    case 'STRIPE':
      return 'STRIPE';
    case 'PAYSTACK':
      return 'PAYSTACK';
    default:
      return 'BANK_TRANSFER';
  }
}

// ── Internal: Check if a provider is configured ────────────────────────────

/**
 * Check if the required environment variables are set for a given payout method.
 * Used to determine whether to attempt a real API call or fall back to PENDING.
 */
function isProviderConfigured(method: PayoutMethod): boolean {
  switch (method) {
    case 'MPESA':
      return !!(
        process.env.MPESA_CONSUMER_KEY &&
        process.env.MPESA_CONSUMER_SECRET &&
        process.env.MPESA_BUSINESS_SHORTCODE &&
        process.env.MPESA_ONLINE_PASSKEY &&
        (process.env.MPESA_B2C_INITIATOR_NAME || process.env.MPESA_ENV === 'sandbox') &&
        process.env.MPESA_B2C_RESULT_URL
      );
    case 'PAYSTACK':
      return !!process.env.PAYSTACK_SECRET_KEY;
    case 'PAYPAL':
      return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    case 'STRIPE':
      return !!process.env.STRIPE_SECRET_KEY;
    case 'BANK_TRANSFER':
      return true; // Manual processing always available
    default:
      return false;
  }
}

// ── Internal: Build idempotency key ────────────────────────────────────────

/**
 * Build the idempotency key for a booking.
 * Format: STYRA-PAYOUT-BOOKING-{bookingId}
 */
function buildIdempotencyKey(bookingId: string): string {
  return `${IDEMPOTENCY_PREFIX}${bookingId}`;
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

// ── Internal: Count existing retries for a booking ─────────────────────────

/**
 * Count how many failed payout attempts exist for a given booking,
 * based on the idempotency key prefix in the description.
 */
async function countRetriesForBooking(bookingId: string): Promise<number> {
  const key = buildIdempotencyKey(bookingId);
  const existingPayouts = await db.payout.findMany({
    where: { description: { contains: key } },
    select: { id: true, status: true },
  });
  // Count only failed/previous attempts (not the current one being created)
  return existingPayouts.filter(p => p.status === 'FAILED').length;
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
 * Provider API Flow:
 *   - M-Pesa B2C: Calls Safaricom Daraja B2C API
 *   - Paystack: Creates transfer recipient, then initiates transfer
 *   - PayPal: Creates a payout batch via PayPal Payouts API
 *   - Stripe: Creates a transfer to a connected Stripe account
 *   - If provider is not configured: Falls back to PENDING for manual admin
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
          stripeAccountId: true,
          payoutPreference: true,
          paypalEmail: true,
          bankAccountDetails: true,
          mpesaPhone: true,
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

  // 2. Check for existing payout (idempotency via prefix-based description match)
  const idempotencyKey = buildIdempotencyKey(bookingId);
  const existingPayout = await db.payout.findFirst({
    where: { description: { contains: idempotencyKey } },
  });

  if (existingPayout) {
    // If the existing payout is still in a terminal state (COMPLETED, PROCESSING, PENDING),
    // return it as-is. If FAILED, allow re-processing via retryFailedPayout().
    if (existingPayout.status !== 'FAILED') {
      return {
        success: true,
        payout: existingPayout,
        message: 'Payout already exists for this booking',
      };
    }
    // Existing payout is FAILED — let retryFailedPayout handle re-triggering
    // If we reach here, it means someone called triggerPayout directly on a
    // booking with a previously failed payout. Fall through to create a new attempt.
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

  // 5. Count retries for this booking
  const retryCount = await countRetriesForBooking(bookingId);

  // 6. Create payout record with structured description for idempotency + audit
  const description: PayoutDescription = {
    bookingId,
    paymentId: payment.id,
    initiatedBy: initiatedBy || 'SYSTEM',
    bookingTotal: grossAmount,
    platformFee,
    netAmount: providerAmount,
    retryCount,
    idempotencyKey,
    lastAttemptAt: new Date().toISOString(),
  };

  const payout = await db.payout.create({
    data: {
      businessId: booking.businessId,
      userId: providerUserId,
      amount: grossAmount,
      method: payoutMethod,
      status: 'PROCESSING',
      transactionRef: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: JSON.stringify(description),
    },
  });

  // 7. Deduct from provider wallet (uses its own tx internally)
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

  // 8. Call provider-specific payout API
  let providerResult: ProviderPayoutResult;

  // Check if the provider is configured; if not, fall back to PENDING for manual processing
  if (!isProviderConfigured(payoutMethod)) {
    console.warn(
      `[Payout] Provider ${payoutMethod} is NOT configured. ` +
      `Falling back to PENDING for manual admin processing. booking=${bookingId.slice(0, 8)}`,
    );

    providerResult = {
      success: true, // Not a failure — just pending manual action
      reference: `MANUAL-${payout.id.slice(0, 8)}`,
      metadata: { providerMessage: `${payoutMethod} not configured — requires manual processing` },
    };

    // Mark as PENDING for admin to process manually
    await db.payout.update({
      where: { id: payout.id },
      data: {
        status: 'PENDING',
        providerRef: providerResult.reference,
      },
    });

    // Log the transaction
    await logTransaction({
      userId: providerUserId,
      bookingId,
      amount: providerAmount,
      type: 'PAYOUT_SENT',
      status: 'PENDING',
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
        retryCount,
        note: 'Provider not configured — manual processing required',
      },
    });

    // Notify provider
    await notifyProvider(providerUserId, { ...payout, status: 'PENDING', providerRef: providerResult.reference }, providerAmount);

    return {
      success: true,
      payout: await db.payout.findUnique({ where: { id: payout.id } }) as Payout,
      message: `Payout of KES ${providerAmount.toFixed(2)} queued for manual processing (${payoutMethod} not configured)`,
    };
  }

  // Provider IS configured — make the real API call
  try {
    switch (payoutMethod) {
      case 'MPESA': {
        // Use mpesaPhone from business if available, otherwise fall back to business phone
        const mpesaPhone = booking.business.mpesaPhone || booking.business.phone || '';
        if (!mpesaPhone) {
          providerResult = {
            success: false,
            reference: '',
            metadata: { providerMessage: 'No M-Pesa phone number configured for this business' },
          };
        } else {
          providerResult = await initiateMpesaB2CPayout(
            mpesaPhone,
            providerAmount,
            bookingId,
            payout.id,
          );
        }
        break;
      }

      case 'PAYSTACK': {
        providerResult = await initiatePaystackTransferPayout(
          booking.business.name,
          booking.business.bankAccountDetails,
          providerAmount,
          bookingId,
          payout.id,
        );
        break;
      }

      case 'PAYPAL': {
        const paypalEmail = booking.business.paypalEmail || '';
        providerResult = await initiatePayPalPayout(
          paypalEmail,
          providerAmount,
          'KES',
          bookingId,
          payout.id,
        );
        break;
      }

      case 'STRIPE': {
        providerResult = await initiateStripeTransfer(
          booking.business.stripeAccountId,
          providerAmount,
          bookingId,
          payout.id,
        );
        break;
      }

      default: {
        // BANK_TRANSFER or unknown — mark as PENDING for admin processing
        providerResult = {
          success: true,
          reference: `MANUAL-${payout.id.slice(0, 8)}`,
          metadata: { providerMessage: 'Manual bank transfer required' },
        };
        await db.payout.update({
          where: { id: payout.id },
          data: { status: 'PENDING' },
        });
        break;
      }
    }
  } catch (providerError) {
    const errMsg = providerError instanceof Error ? providerError.message : 'Provider API call failed';
    console.error(
      `[Payout] Provider ${payoutMethod} threw unhandled error: ${errMsg} ` +
      `booking=${bookingId.slice(0, 8)} payout=${payout.id.slice(0, 8)}`,
    );

    await db.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        failedReason: errMsg,
      },
    });

    // Update description with retry info
    try {
      const updatedDesc = { ...description, retryCount: retryCount + 1, lastAttemptAt: new Date().toISOString() };
      await db.payout.update({
        where: { id: payout.id },
        data: { description: JSON.stringify(updatedDesc) },
      });
    } catch {
      // Non-critical — don't block the error propagation
    }

    throw new Error(`Payout provider error: ${errMsg}`);
  }

  // 9. Handle provider result — update payout status
  if (!providerResult.success) {
    // Provider explicitly returned failure
    const failedReason = (providerResult.metadata?.providerMessage as string) || 'Provider returned failure';

    await db.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        providerRef: providerResult.reference || null,
        failedReason,
      },
    });

    // Update description with retry info
    try {
      const updatedDesc = { ...description, retryCount: retryCount + 1, lastAttemptAt: new Date().toISOString(), provider: payoutMethod, providerRef: providerResult.reference };
      await db.payout.update({
        where: { id: payout.id },
        data: { description: JSON.stringify(updatedDesc) },
      });
    } catch {
      // Non-critical
    }

    // Log the failed payout
    await logTransaction({
      userId: providerUserId,
      bookingId,
      amount: providerAmount,
      type: 'PAYOUT_SENT',
      status: 'FAILED',
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
        retryCount: retryCount + 1,
        failedReason,
        providerMetadata: providerResult.metadata,
      },
    });

    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } }) as Payout;

    return {
      success: false,
      payout: updatedPayout,
      message: `Payout failed: ${failedReason}`,
    };
  }

  // 10. Provider returned success — finalize payout
  const finalStatus = 'COMPLETED';
  const updatedPayout = await db.payout.update({
    where: { id: payout.id },
    data: {
      status: finalStatus,
      providerRef: providerResult.reference,
      failedReason: null,
    },
  });

  // Update description with final provider info
  try {
    const finalDesc = {
      ...description,
      provider: payoutMethod,
      providerRef: providerResult.reference,
      lastAttemptAt: new Date().toISOString(),
    };
    await db.payout.update({
      where: { id: payout.id },
      data: { description: JSON.stringify(finalDesc) },
    });
  } catch {
    // Non-critical
  }

  // 11. Log the payout (fire-and-forget)
  await logTransaction({
    userId: providerUserId,
    bookingId,
    amount: providerAmount,
    type: 'PAYOUT_SENT',
    status: 'COMPLETED',
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
      retryCount,
      providerMetadata: providerResult.metadata,
    },
  });

  // 12. Notify provider (fire-and-forget)
  await notifyProvider(providerUserId, updatedPayout, providerAmount);

  return {
    success: true,
    payout: updatedPayout,
    message: `Payout of KES ${providerAmount.toFixed(2)} processed via ${payoutMethod}`,
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
 * The retry count is tracked in the payout description metadata.
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

  // Extract bookingId from description using the idempotency key prefix
  let bookingId: string | null = null;
  let retryCount = 0;
  try {
    const desc: PayoutDescription = payout.description ? JSON.parse(payout.description) : ({} as PayoutDescription);
    bookingId = desc.bookingId || null;
    retryCount = desc.retryCount || 0;

    // Also try extracting from idempotency key if bookingId is missing
    if (!bookingId && desc.idempotencyKey?.startsWith(IDEMPOTENCY_PREFIX)) {
      bookingId = desc.idempotencyKey.slice(IDEMPOTENCY_PREFIX.length);
    }
  } catch {
    // description parse failed — try legacy format
    try {
      const legacyDesc = payout.description ? JSON.parse(payout.description) : {};
      bookingId = legacyDesc.bookingId || null;
    } catch {
      // Still can't parse
    }
  }

  if (!bookingId) {
    throw new Error(`Cannot retry: no bookingId found in payout description for ${payoutId}`);
  }

  // Max retry limit to prevent infinite retry loops
  const MAX_RETRIES = 5;
  if (retryCount >= MAX_RETRIES) {
    throw new Error(
      `Payout ${payoutId.slice(0, 8)} has exceeded maximum retry attempts (${MAX_RETRIES}). ` +
      `Please process manually.`,
    );
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
