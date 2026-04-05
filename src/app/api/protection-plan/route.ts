import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, blockRole } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Protection plan configuration
export const PLAN_CONFIG = {
  basic: {
    name: 'Basic Protection',
    price: 'Free',
    maxClaimAmount: 500,
    maxClaimsPerMonth: 5,
    processingTime: '7 days',
    reviewTime: '48 hours',
    features: [
      'Standard service protection up to $500',
      'Basic liability coverage',
      'Email support for claims',
      '7-day claim processing',
    ],
  },
  enhanced: {
    name: 'Enhanced Protection',
    price: '$4.99/mo',
    maxClaimAmount: 2000,
    maxClaimsPerMonth: 10,
    processingTime: '48 hours',
    reviewTime: '24 hours',
    features: [
      'Service protection up to $2,000',
      'Enhanced liability coverage',
      'Priority support with live chat',
      '48-hour claim processing',
      'Refund guarantee for canceled appointments',
    ],
  },
  premium: {
    name: 'Premium Protection',
    price: '$9.99/mo',
    maxClaimAmount: 50000, // effectively unlimited
    maxClaimsPerMonth: 999,
    processingTime: 'Same day',
    reviewTime: 'Same day',
    features: [
      'Unlimited service protection',
      'Premium liability coverage up to $5M',
      '24/7 dedicated support hotline',
      'Same-day claim processing',
      'Full refund guarantee',
      'Legal assistance coverage',
    ],
  },
} as const;

export type PlanType = keyof typeof PLAN_CONFIG;

// GET /api/protection-plan — Get the current user's plan
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { protectionPlan: true },
    });

    const plan = (user?.protectionPlan || 'basic') as PlanType;

    return successResponse({
      plan,
      ...PLAN_CONFIG[plan],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/protection-plan — Update the user's plan
export async function PATCH(request: NextRequest) {
  try {
    const session = await blockRole('admin');
    const body = await request.json();
    const { plan } = body;

    const validPlans: PlanType[] = ['basic', 'enhanced', 'premium'];
    if (!plan || !validPlans.includes(plan)) {
      return errorResponse('Invalid plan. Must be basic, enhanced, or premium.', 400);
    }

    const updated = await db.user.update({
      where: { id: session.userId },
      data: { protectionPlan: plan },
      select: { protectionPlan: true },
    });

    const planType = updated.protectionPlan as PlanType;

    return successResponse({
      plan: planType,
      ...PLAN_CONFIG[planType],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
