import { getSession } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeUser } from '@/lib/response-sanitizer';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse('Not authenticated', 401);
    }

    // session = { ...payload, user } where user is the full User record from DB
    const userData = session.user || session;
    const sanitizedUser = sanitizeUser(userData as unknown as Record<string, unknown>);

    // ── Enrich with business verification status ──
    // The User model doesn't have businessVerificationStatus — it lives on
    // the Business model.  We query the user's most-recent business to
    // populate this field so the frontend always has up-to-date data.
    try {
      const latestBusiness = await db.business.findFirst({
        where: { ownerId: session.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          verificationStatus: true,
          name: true,
          rejectionReason: true,
        },
      });

      if (latestBusiness) {
        (sanitizedUser as Record<string, unknown>).businessVerificationStatus =
          latestBusiness.verificationStatus;
        (sanitizedUser as Record<string, unknown>).businessName =
          (sanitizedUser as Record<string, unknown>).businessName || latestBusiness.name;
        if (latestBusiness.rejectionReason) {
          (sanitizedUser as Record<string, unknown>).rejectionReason =
            latestBusiness.rejectionReason;
        }
      }
    } catch {
      // Non-critical — don't fail the /me request if this lookup fails
    }

    return successResponse(sanitizedUser);
  } catch (error) {
    return handleApiError(error);
  }
}
