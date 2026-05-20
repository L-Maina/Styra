/**
 * Admin Withdrawal Processing API
 *
 * POST /api/admin/withdrawals/[id]/process  — Process a pending withdrawal
 * POST /api/admin/withdrawals/[id]/complete — Complete a processing withdrawal
 *
 * Both endpoints require admin role.
 *
 * Processing flow:
 *   PENDING → PROCESSING → COMPLETED
 *                  ↓
 *               FAILED (if provider call fails)
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { initiateMpesaB2C } from '@/lib/mpesa';
import { createPayPalPayout } from '@/lib/paypal-payouts';
import Stripe from 'stripe';
import { env } from '@/lib/env';

// ── Lazy Stripe singleton ────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;
  if (!env.stripe.secretKey) return null;
  try {
    _stripe = new Stripe(env.stripe.secretKey, {
      apiVersion: '2023-10-16' as any,
    });
    return _stripe;
  } catch {
    console.error('[Withdrawal] Failed to initialize Stripe client');
    return null;
  }
}

// ── POST /api/admin/withdrawals/[id]/process ─────────────────────────────────

/**
 * Process a pending withdrawal by calling the appropriate payout provider.
 *
 * Based on the withdrawal method:
 *   - MPESA:         Call initiateMpesaB2C from @/lib/mpesa
 *   - PAYPAL:        Call createPayPalPayout from @/lib/paypal-payouts
 *   - STRIPE:        Create a Stripe Payout (stripe.payouts.create)
 *   - BANK_TRANSFER: Mark as PROCESSING for manual bank transfer
 *
 * Updates the withdrawal status from PENDING → PROCESSING.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    // ── Fetch the withdrawal ─────────────────────────────────────────────────
    const withdrawal = await db.platformWithdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      return errorResponse('Withdrawal not found', 404);
    }

    if (withdrawal.status !== 'PENDING') {
      return errorResponse(
        `Withdrawal cannot be processed. Current status: ${withdrawal.status}. Expected: PENDING`,
        400,
      );
    }

    // ── Process based on method ──────────────────────────────────────────────
    let reference = withdrawal.reference;
    let notes = withdrawal.notes;

    switch (withdrawal.method) {
      case 'MPESA': {
        const phone = withdrawal.destination;
        if (!phone) {
          return errorResponse('M-Pesa destination phone number is missing', 400);
        }

        const result = await initiateMpesaB2C({
          phoneNumber: phone,
          amount: Math.round(withdrawal.amount),
          remarks: `Styra platform withdrawal ${withdrawal.id.slice(0, 8)}`,
          occasion: 'Platform earnings withdrawal',
          commandID: 'BusinessPayment',
        });

        if (!result.success) {
          // Mark as FAILED if M-Pesa rejects the request
          await db.platformWithdrawal.update({
            where: { id },
            data: {
              status: 'FAILED',
              notes: `M-Pesa B2C failed: ${result.message}`,
            },
          });
          return errorResponse(`M-Pesa B2C payout failed: ${result.message}`, 400);
        }

        reference = result.transactionId || null;
        notes = `M-Pesa B2C initiated. ConversationID: ${result.transactionId}`;
        break;
      }

      case 'PAYPAL': {
        const paypalEmail = withdrawal.destination;
        if (!paypalEmail) {
          return errorResponse('PayPal destination email is missing', 400);
        }

        const result = await createPayPalPayout({
          recipientEmail: paypalEmail,
          amount: withdrawal.amount,
          currency: withdrawal.currency || 'KES',
          senderItemId: `STY-WD-${withdrawal.id.slice(0, 12)}`,
          note: `Styra platform withdrawal ${withdrawal.id.slice(0, 8)}`,
        });

        if (!result.success) {
          await db.platformWithdrawal.update({
            where: { id },
            data: {
              status: 'FAILED',
              notes: `PayPal payout failed: ${result.message}`,
            },
          });
          return errorResponse(`PayPal payout failed: ${result.message}`, 400);
        }

        reference = result.batchId || null;
        notes = `PayPal payout batch created. BatchID: ${result.batchId}`;
        break;
      }

      case 'STRIPE': {
        const stripe = getStripeClient();
        if (!stripe) {
          return errorResponse('Stripe is not configured (STRIPE_SECRET_KEY missing)', 400);
        }

        try {
          const amountInCents = Math.round(withdrawal.amount * 100);
          const payout = await stripe.payouts.create({
            amount: amountInCents,
            currency: (withdrawal.currency || 'KES').toLowerCase(),
            metadata: {
              withdrawalId: withdrawal.id,
              platform: 'styra',
            },
          });

          reference = payout.id;
          notes = `Stripe payout created. PayoutID: ${payout.id}, Status: ${payout.status}`;
        } catch (stripeError) {
          const msg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
          await db.platformWithdrawal.update({
            where: { id },
            data: {
              status: 'FAILED',
              notes: `Stripe payout failed: ${msg}`,
            },
          });
          return errorResponse(`Stripe payout failed: ${msg}`, 400);
        }
        break;
      }

      case 'BANK_TRANSFER': {
        // Bank transfers are manual — just mark as PROCESSING
        reference = `BANK-${Date.now()}`;
        notes = 'Awaiting manual bank transfer. Destination: ' + (withdrawal.destination || 'N/A');
        break;
      }

      default:
        return errorResponse(`Unknown withdrawal method: ${withdrawal.method}`, 400);
    }

    // ── Update withdrawal status to PROCESSING ───────────────────────────────
    const updated = await db.platformWithdrawal.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        reference,
        notes,
      },
    });

    // ── Log audit event ──────────────────────────────────────────────────────
    try {
      await db.auditLog.create({
        data: {
          userId: user.userId || user.id,
          action: 'WITHDRAWAL_PROCESSING',
          resource: `withdrawal:${id}`,
          details: JSON.stringify({
            amount: withdrawal.amount,
            method: withdrawal.method,
            reference,
          }),
        },
      });
    } catch {
      // Audit log failure should not break the flow
    }

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
