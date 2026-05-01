/**
 * API RBAC Middleware
 *
 * Provides lightweight role-based access control helpers for Next.js API routes.
 * These extract the user token from Authorization header or cookies,
 * verify against Supabase/DB, and return standardized 401/403 responses.
 *
 * Usage in route handlers:
 *   import { requireRole, requireAdmin, requireAuth, blockRole } from '@/lib/api-rbac';
 *
 *   // Simple admin guard
 *   const check = await requireRole(['admin']);
 *   if (!check.authorized) return NextResponse.json({ error: check.error }, { status: check.status });
 *   // use check.user.userId, check.user.email, check.user.role
 *
 *   // One-liner admin guard
 *   await requireAdmin();
 *
 *   // Block admin from booking
 *   const session = await blockRole('admin');
 */

import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET;

// ────────────────────────────────────────────────────
// Token Verification
// ────────────────────────────────────────────────────

interface VerifiedUser {
  userId: string;
  email: string;
  role: string;
  tokenVersion?: number;
}

function verifyTokenFromHeader(authHeader: string | null): VerifiedUser | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET!) as VerifiedUser;
  } catch {
    return null;
  }
}

async function verifyTokenFromCookie(): Promise<VerifiedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('styra-token')?.value;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET!) as VerifiedUser;
    if (!payload) return null;

    // Check token version to handle forced logouts
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.isBanned || (user.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify user from Authorization header or cookie.
 * Prefers header token (for API calls) and falls back to cookie (for browser requests).
 */
async function verifyUser(): Promise<VerifiedUser | null> {
  // Try Authorization header first
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const headerUser = verifyTokenFromHeader(authHeader);
  if (headerUser) return headerUser;

  // Fall back to cookie
  return verifyTokenFromCookie();
}

// ────────────────────────────────────────────────────
// Role Check Result
// ────────────────────────────────────────────────────

interface AuthorizedResult {
  authorized: true;
  user: VerifiedUser;
}

interface UnauthorizedResult {
  authorized: false;
  error: string;
  status: number;
}

type RoleCheckResult = AuthorizedResult | UnauthorizedResult;

// ────────────────────────────────────────────────────
// Public Helpers
// ────────────────────────────────────────────────────

/**
 * Role-based access control check for API routes.
 * Reads Authorization header or cookie, verifies JWT, and ensures
 * the user's role is in the allowed list.
 *
 * @param allowedRoles - Array of lowercase roles e.g. ['admin'], ['customer', 'business']
 * @returns Result object with `authorized`, `user`, `error`, `status`
 */
export async function requireRole(allowedRoles: string[]): Promise<RoleCheckResult> {
  const user = await verifyUser();

  if (!user) {
    return { authorized: false, error: 'Authentication required', status: 401 };
  }

  const upperRoles = allowedRoles.map((r) => r.toUpperCase());
  const userRole = (user.role || '').toUpperCase();

  if (!upperRoles.includes(userRole)) {
    return {
      authorized: false,
      error: 'Insufficient permissions',
      status: 403,
    };
  }

  return { authorized: true, user };
}

/**
 * Require authentication (any authenticated user).
 * Throws a Response on failure for use with try/catch patterns.
 *
 * @returns Verified user object
 * @throws Response with 401 status
 */
export async function requireAuth(): Promise<VerifiedUser> {
  const user = await verifyUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}

/**
 * Require admin role. Convenience wrapper around requireRole.
 * Throws a Response on failure.
 *
 * @returns Verified admin user object
 * @throws Response with 401 or 403 status
 */
export async function requireAdmin(): Promise<VerifiedUser> {
  const check = await requireRole(['admin']);
  if (!check.authorized) {
    throw new Response(JSON.stringify({ error: check.error }), {
      status: check.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return check.user;
}

/**
 * Require business owner or admin role.
 *
 * @returns Verified user object
 * @throws Response with 401 or 403 status
 */
export async function requireBusinessOrAdmin(): Promise<VerifiedUser> {
  const check = await requireRole(['business', 'admin']);
  if (!check.authorized) {
    throw new Response(JSON.stringify({ error: check.error }), {
      status: check.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return check.user;
}

/**
 * Require customer or business role (for booking endpoints).
 *
 * @returns Verified user object
 * @throws Response with 401 or 403 status
 */
export async function requireCustomerOrBusiness(): Promise<VerifiedUser> {
  const check = await requireRole(['customer', 'business']);
  if (!check.authorized) {
    throw new Response(JSON.stringify({ error: check.error }), {
      status: check.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return check.user;
}

/**
 * Block specific roles from accessing an endpoint.
 * Throws 403 if the authenticated user HAS any of the specified roles.
 *
 * Primary use case: block admin from booking as a customer.
 *
 * @param blockedRoles - Roles that should be blocked (e.g. 'admin')
 * @returns Verified user object if not blocked
 * @throws Response with 403 status
 */
export async function blockRole(...blockedRoles: string[]): Promise<VerifiedUser> {
  const user = await verifyUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upperBlocked = blockedRoles.map((r) => r.toUpperCase());
  const userRole = (user.role || '').toUpperCase();

  if (upperBlocked.includes(userRole)) {
    // Log unauthorized attempt
    try {
      await db.auditLog.create({
        data: {
          userId: user.userId,
          action: 'BLOCKED_ROLE_ATTEMPT',
          resource: blockedRoles.join(','),
          ipAddress: 'unknown',
        },
      });
    } catch {
      // Fail silently — logging should never break the flow
    }

    throw new Response(
      JSON.stringify({ error: 'This action is not available for your account type' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return user;
}

/**
 * Require the user to be the owner of a specific business (or an admin).
 * Used for route-level permission checks on business-specific endpoints.
 *
 * @param businessId - The ID of the business to check ownership of
 * @returns Verified user object if authorized
 * @throws Response with 401, 403, or 404 status
 */
export async function requireBusinessOwner(businessId: string): Promise<VerifiedUser> {
  const user = await requireAuth();
  const userRole = (user.role || '').toUpperCase();

  if (userRole === 'ADMIN') return user;

  if (userRole !== 'BUSINESS_OWNER') {
    throw new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const business = await db.business.findFirst({
    where: { id: businessId, ownerId: user.userId },
  });

  if (!business) {
    throw new Response(JSON.stringify({ error: 'Not your business' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return user;
}
