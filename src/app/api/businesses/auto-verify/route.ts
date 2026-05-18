import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { performAutoVerify } from '@/lib/auto-verify';

// POST /api/businesses/auto-verify — Auto-verification during business registration
// Uses the shared performAutoVerify() utility for consistency.
// Does NOT require admin auth — called internally during registration.
export async function POST(request: NextRequest) {
  try {
    const { businessId } = await request.json();

    if (!businessId) {
      return errorResponse('businessId is required', 400);
    }

    const result = await performAutoVerify(businessId);

    return successResponse({
      businessId,
      autoVerified: result.autoVerified,
      verificationStatus: result.verificationStatus,
      message: result.message,
      result: result.result,
    });
  } catch (error) {
    // On any error, don't fail the registration — just leave as PENDING
    console.error('[Auto-Verify] Error during auto-verification:', error);
    return successResponse({
      autoVerified: false,
      message: 'Auto-verification encountered an error. Business remains PENDING for manual review.',
      verificationStatus: 'PENDING',
    });
  }
}
