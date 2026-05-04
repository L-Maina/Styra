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

    // Ensure roles array exists (DB stores a single role field, frontend expects roles array)
    const userRole = (sanitizedUser.role || 'CUSTOMER') as string;
    if (!sanitizedUser.roles || !Array.isArray(sanitizedUser.roles)) {
      sanitizedUser.roles = [userRole.toUpperCase()];
    }

    // Ensure activeMode is set based on role
    if (!sanitizedUser.activeMode) {
      if (userRole.toUpperCase() === 'ADMIN') {
        sanitizedUser.activeMode = 'ADMIN';
      } else if (userRole.toUpperCase() === 'BUSINESS_OWNER') {
        sanitizedUser.activeMode = 'PROVIDER';
      } else {
        sanitizedUser.activeMode = 'CLIENT';
      }
    }

    // ── Enrich with business verification status ──
    // The User model doesn't have businessVerificationStatus — it lives on
    // the Business model.  We query the user's most-recent business to
    // populate this field so the frontend always has up-to-date data.
    try {
      const latestBusiness = await db.business.findFirst({
        where: { ownerId: session.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
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
        (sanitizedUser as Record<string, unknown>).businessId = latestBusiness.id;
        
        // If user has a business, ensure BUSINESS_OWNER is in roles
        const roles = (sanitizedUser.roles as string[]).map((r: string) => r.toUpperCase());
        if (!roles.includes('BUSINESS_OWNER')) {
          roles.push('BUSINESS_OWNER');
          sanitizedUser.roles = roles;
        }
        
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
