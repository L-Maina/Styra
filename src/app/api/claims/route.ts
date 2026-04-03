import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';
import { PLAN_CONFIG, type PlanType } from '@/app/api/protection-plan/route';

// GET /api/claims - Fetch claims for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { userId: session.userId };

    if (status && status !== 'all') {
      // Frontend sends lowercase, DB stores uppercase
      where.status = status.toUpperCase();
    }

    const claims = await db.insuranceClaim.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });

    const total = await db.insuranceClaim.count({ where });

    // Map DB fields to frontend-expected format
    const mappedClaims = claims.map((claim) => ({
      id: claim.claimNumber || claim.id,
      type: claim.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      description: claim.description,
      amount: claim.amount,
      status: claim.status.toLowerCase() as string,
      createdAt: claim.submittedAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
      businessName: claim.businessName,
      customerName: claim.customerName,
    }));

    return successResponse({
      data: mappedClaims,
      total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/claims - Create a new insurance claim
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const {
      type,
      description,
      amount,
      bookingId,
      currency,
      documents,
      incidentDate,
    } = body;

    if (!type || !description || !amount) {
      return errorResponse('Claim type, description, and amount are required', 400);
    }

    // Look up user's protection plan
    const userRecord = await db.user.findUnique({
      where: { id: session.userId },
      select: { protectionPlan: true, name: true, email: true },
    });

    const plan = (userRecord?.protectionPlan || 'basic') as PlanType;
    const planConfig = PLAN_CONFIG[plan];

    if (amount <= 0 || amount > planConfig.maxClaimAmount) {
      return errorResponse(
        `Claim amount must be between $0.01 and $${planConfig.maxClaimAmount.toLocaleString()} for your ${planConfig.name} plan`,
        400
      );
    }

    // Check monthly claim limit
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const claimsThisMonth = await db.insuranceClaim.count({
      where: {
        userId: session.userId,
        submittedAt: { gte: firstOfMonth },
      },
    });
    if (claimsThisMonth >= planConfig.maxClaimsPerMonth) {
      return errorResponse(
        `You've reached your monthly limit of ${planConfig.maxClaimsPerMonth} claims on the ${planConfig.name} plan. Upgrade for higher limits.`,
        400
      );
    }

    if (description.length < 50) {
      return errorResponse('Description must be at least 50 characters', 400);
    }

    // Determine user type
    const userType = session.role === 'business' ? 'provider' : 'customer';

    // Generate claim number
    const claimCount = await db.insuranceClaim.count();
    const claimNumber = `CLM-${new Date().getFullYear()}-${String(claimCount + 1).padStart(3, '0')}`;

    const claim = await db.insuranceClaim.create({
      data: {
        claimNumber,
        userId: session.userId,
        userType,
        customerName: userRecord?.name || 'Unknown',
        customerEmail: userRecord?.email || '',
        bookingId: bookingId || null,
        type,
        description,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        documents: documents ? JSON.stringify(documents) : null,
        incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
        status: 'SUBMITTED',
      },
    });

    return successResponse({
      claim: {
        id: claim.claimNumber,
        type: claim.type,
        description: claim.description,
        amount: claim.amount,
        status: claim.status.toLowerCase(),
        createdAt: claim.submittedAt.toISOString(),
        updatedAt: claim.updatedAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
