/**
 * Admin Withdrawal API
 *
 * GET  — List all withdrawals + available earnings summary
 * POST — Request a new withdrawal from platform earnings
 *
 * Admin-only: all endpoints require user.role === 'ADMIN'
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

// ── Valid values ──────────────────────────────────────────────────────────────

const VALID_METHODS = ['BANK_TRANSFER', 'MPESA', 'PAYPAL', 'STRIPE'] as const;
type WithdrawalMethod = (typeof VALID_METHODS)[number];

// ── GET /api/admin/withdrawals ────────────────────────────────────────────────

/**
 * List all platform withdrawals and earning aggregates.
 *
 * Returns:
 *   - withdrawals:   All PlatformWithdrawal records, newest first
 *   - totalAvailable: Sum of PlatformEarning records with status AVAILABLE
 *   - totalWithdrawn: Sum of PlatformEarning records with status WITHDRAWN
 *   - totalOnHold:    Sum of PlatformEarning records with status ON_HOLD
 */
export async function GET() {
  try {
    const user = await requireAdmin();

    const [withdrawals, availableAgg, withdrawnAgg, onHoldAgg] = await Promise.all([
      db.platformWithdrawal.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      db.platformEarning.aggregate({
        where: { status: 'AVAILABLE' },
        _sum: { amount: true },
      }),
      db.platformEarning.aggregate({
        where: { status: 'WITHDRAWN' },
        _sum: { amount: true },
      }),
      db.platformEarning.aggregate({
        where: { status: 'ON_HOLD' },
        _sum: { amount: true },
      }),
    ]);

    return successResponse({
      withdrawals,
      totalAvailable: availableAgg._sum.amount || 0,
      totalWithdrawn: withdrawnAgg._sum.amount || 0,
      totalOnHold: onHoldAgg._sum.amount || 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/admin/withdrawals ───────────────────────────────────────────────

/**
 * Request a new platform earnings withdrawal.
 *
 * Body:
 *   - amount:      number > 0 and <= total available earnings
 *   - method:      'BANK_TRANSFER' | 'MPESA' | 'PAYPAL' | 'STRIPE'
 *   - destination: string — bank account details, M-Pesa phone, PayPal email, or Stripe account ID
 *
 * Creates:
 *   1. PlatformWithdrawal record (status: PENDING)
 *   2. Marks available PlatformEarning records as WITHDRAWN (up to the requested amount)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();

    const body = await request.json();
    const { amount, method, destination } = body as {
      amount?: number;
      method?: string;
      destination?: string;
    };

    // ── Validate inputs ─────────────────────────────────────────────────────
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return errorResponse('amount must be a positive number', 400);
    }

    if (!method || !VALID_METHODS.includes(method as WithdrawalMethod)) {
      return errorResponse(
        `method must be one of: ${VALID_METHODS.join(', ')}`,
        400,
      );
    }

    if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
      return errorResponse('destination is required (bank details, phone, email, or Stripe account)', 400);
    }

    // ── Check available earnings ─────────────────────────────────────────────
    const availableAgg = await db.platformEarning.aggregate({
      where: { status: 'AVAILABLE' },
      _sum: { amount: true },
    });
    const totalAvailable = availableAgg._sum.amount || 0;

    if (amount > totalAvailable) {
      return errorResponse(
        `Insufficient available earnings. Requested: ${amount}, Available: ${totalAvailable}`,
        400,
      );
    }

    // ── Check minimum withdrawal ─────────────────────────────────────────────
    const minWithdrawalSetting = await db.platformSetting.findFirst({
      where: { key: 'minWithdrawal' },
    });
    const minWithdrawal = minWithdrawalSetting
      ? parseFloat(minWithdrawalSetting.value)
      : 50;

    if (amount < minWithdrawal) {
      return errorResponse(
        `Minimum withdrawal amount is ${minWithdrawal} KES`,
        400,
      );
    }

    // ── Create withdrawal + mark earnings as withdrawn ───────────────────────
    const withdrawal = await db.$transaction(async (tx) => {
      // 1. Create the withdrawal record
      const newWithdrawal = await tx.platformWithdrawal.create({
        data: {
          amount,
          currency: 'KES',
          method: method as WithdrawalMethod,
          status: 'PENDING',
          destination: destination.trim(),
        },
      });

      // 2. Mark available earnings as WITHDRAWN (oldest first, up to the amount)
      let remaining = amount;
      const availableEarnings = await tx.platformEarning.findMany({
        where: { status: 'AVAILABLE' },
        orderBy: { earnedAt: 'asc' }, // Withdraw oldest earnings first
      });

      for (const earning of availableEarnings) {
        if (remaining <= 0) break;

        if (earning.amount <= remaining) {
          // Mark entire earning as withdrawn
          await tx.platformEarning.update({
            where: { id: earning.id },
            data: {
              status: 'WITHDRAWN',
              withdrawalId: newWithdrawal.id,
              withdrawnAt: new Date(),
            },
          });
          remaining -= earning.amount;
        } else {
          // Partial withdrawal: split the earning
          // Mark original as withdrawn for the full amount and create a new AVAILABLE earning for the remainder
          await tx.platformEarning.update({
            where: { id: earning.id },
            data: {
              amount: remaining, // Reduce to the amount we're withdrawing
              status: 'WITHDRAWN',
              withdrawalId: newWithdrawal.id,
              withdrawnAt: new Date(),
            },
          });

          // Create a remainder earning that stays AVAILABLE
          const remainder = earning.amount - remaining;
          if (remainder > 0) {
            await tx.platformEarning.create({
              data: {
                type: earning.type,
                amount: remainder,
                currency: earning.currency,
                status: 'AVAILABLE',
                bookingId: earning.bookingId,
                businessId: earning.businessId,
                description: earning.description
                  ? `${earning.description} (remainder)`
                  : 'Remainder from partial withdrawal',
                earnedAt: earning.earnedAt,
              },
            });
          }
          remaining = 0;
        }
      }

      return newWithdrawal;
    });

    return successResponse(withdrawal, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
