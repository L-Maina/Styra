/**
 * Stripe Connect Onboarding API
 *
 * POST /api/stripe/connect — Create a Stripe Connect account for a business
 * GET  /api/stripe/connect — Check Stripe Connect onboarding status
 *
 * Business owner only: both endpoints require an authenticated user
 * who owns at least one business.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import Stripe from 'stripe';

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
    console.error('[Stripe Connect] Failed to initialize Stripe client');
    return null;
  }
}

// ── POST /api/stripe/connect ─────────────────────────────────────────────────

/**
 * Create a Stripe Connect (Express) account for a business and generate
 * an onboarding link.
 *
 * Flow:
 *   1. Find the user's business
 *   2. Create a Stripe Express account (country: KE)
 *   3. Save stripeAccountId to the Business model
 *   4. Create an account link for onboarding
 *   5. Return the onboarding URL
 *
 * If the business already has a Stripe account ID, creates a new account
 * link for re-onboarding instead of creating a new account.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // ── Validate Stripe is configured ────────────────────────────────────────
    const stripe = getStripeClient();
    if (!stripe) {
      return errorResponse('Stripe is not configured. Set STRIPE_SECRET_KEY.', 400);
    }

    // ── Find the user's business ─────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const { businessId } = body as { businessId?: string };

    let business;
    if (businessId) {
      business = await db.business.findFirst({
        where: { id: businessId, ownerId: user.userId || user.id },
      });
    } else {
      // Default to first business owned by this user
      business = await db.business.findFirst({
        where: { ownerId: user.userId || user.id },
      });
    }

    if (!business) {
      return errorResponse('No business found for this user. Create a business first.', 404);
    }

    const baseUrl = env.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let accountId = business.stripeAccountId;

    // ── Create Stripe Connect account if not exists ──────────────────────────
    if (!accountId) {
      try {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'KE',
          email: user.email || business.email || undefined,
          business_type: 'individual',
          capabilities: {
            transfers: { requested: true },
          },
          metadata: {
            businessId: business.id,
            businessName: business.name,
            userId: user.userId || user.id,
            platform: 'styra',
          },
        });

        accountId = account.id;

        // Save the Stripe account ID to the business
        await db.business.update({
          where: { id: business.id },
          data: {
            stripeAccountId: accountId,
            stripeOnboardingComplete: false,
          },
        });

        // Audit log
        try {
          await db.auditLog.create({
            data: {
              userId: user.userId || user.id,
              action: 'STRIPE_CONNECT_ACCOUNT_CREATED',
              resource: `business:${business.id}`,
              details: JSON.stringify({
                stripeAccountId: accountId,
                businessName: business.name,
              }),
            },
          });
        } catch {
          // Non-critical
        }
      } catch (stripeError) {
        const msg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
        return errorResponse(`Failed to create Stripe Connect account: ${msg}`, 500);
      }
    }

    // ── Create an account link for onboarding ────────────────────────────────
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/?page=dashboard&stripe=refresh`,
        return_url: `${baseUrl}/?page=dashboard&stripe=success`,
        type: 'account_onboarding',
      });

      return successResponse({
        url: accountLink.url,
        accountId,
        expiresAt: accountLink.expires_at,
      });
    } catch (stripeError) {
      const msg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
      return errorResponse(`Failed to create Stripe onboarding link: ${msg}`, 500);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// ── GET /api/stripe/connect ──────────────────────────────────────────────────

/**
 * Check the Stripe Connect onboarding status for a business.
 *
 * Returns:
 *   - onboardingComplete: Whether the account has submitted all required info
 *   - chargesEnabled:     Whether the account can accept charges
 *   - payoutsEnabled:     Whether the account can receive payouts
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // ── Validate Stripe is configured ────────────────────────────────────────
    const stripe = getStripeClient();
    if (!stripe) {
      return errorResponse('Stripe is not configured. Set STRIPE_SECRET_KEY.', 400);
    }

    // ── Find the user's business ─────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    let business;
    if (businessId) {
      business = await db.business.findFirst({
        where: { id: businessId, ownerId: user.userId || user.id },
      });
    } else {
      business = await db.business.findFirst({
        where: { ownerId: user.userId || user.id },
      });
    }

    if (!business) {
      return errorResponse('No business found for this user.', 404);
    }

    if (!business.stripeAccountId) {
      return successResponse({
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // ── Retrieve the Stripe account status ───────────────────────────────────
    try {
      const account = await stripe.accounts.retrieve(business.stripeAccountId);

      const onboardingComplete = account.details_submitted;
      const chargesEnabled = account.charges_enabled;
      const payoutsEnabled = account.payouts_enabled;

      // Update the business record if onboarding status changed
      if (onboardingComplete !== business.stripeOnboardingComplete) {
        await db.business.update({
          where: { id: business.id },
          data: { stripeOnboardingComplete: onboardingComplete },
        }).catch(() => { /* Non-critical update */ });
      }

      return successResponse({
        connected: true,
        accountId: business.stripeAccountId,
        onboardingComplete,
        chargesEnabled,
        payoutsEnabled,
        businessType: account.business_type,
        country: account.country,
        defaultCurrency: account.default_currency,
      });
    } catch (stripeError) {
      const msg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';

      // If the account was deleted or is inaccessible
      if (msg.includes('No such account') || msg.includes('account_invalid')) {
        // Clear the stale reference
        await db.business.update({
          where: { id: business.id },
          data: {
            stripeAccountId: null,
            stripeOnboardingComplete: false,
          },
        }).catch(() => { /* Non-critical */ });

        return successResponse({
          connected: false,
          onboardingComplete: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          error: 'Stripe account no longer exists. Please reconnect.',
        });
      }

      return errorResponse(`Failed to retrieve Stripe account status: ${msg}`, 500);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
