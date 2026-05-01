import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from './db';

// ── Auth User Type ─────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  userId?: string;
  tokenVersion?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET must be set in production'); })()
    : 'styra-dev-secret-change-in-production'
);
const JWT_EXPIRES_IN = '7d';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT tokens
export function generateToken(payload: { userId: string; email: string; role: string; tokenVersion?: number }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: string; email: string; role: string; tokenVersion?: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

// Session from cookies
export async function getSession(): Promise<any | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('styra-token')?.value;
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;
  
  // Check token version
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.isBanned || (user.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
    return null;
  }
  
  return { ...payload, user };
}

// Create a session (set JWT cookie)
export async function createSession(user: { id: string; email: string; role: string; tokenVersion?: number }): Promise<void> {
  const cookieStore = await cookies();
  const token = generateToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion });
  cookieStore.set('styra-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

// Clear the current session (delete JWT cookie)
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('styra-token');
}

// Auth middleware helpers - these return user or throw Response
export async function requireAuth(): Promise<any> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return session;
}

export async function requireRole(...roles: string[]): Promise<any> {
  const session = await requireAuth();
  const userRole = (session.role || '').toUpperCase();
  const allowed = roles.map(r => r.toUpperCase());
  if (!allowed.includes(userRole)) {
    throw new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return session;
}

export async function requireAdmin(): Promise<any> {
  return requireRole('admin');
}

export async function requireBusinessOwner(businessId: string): Promise<any> {
  const session = await requireRole('BUSINESS_OWNER', 'ADMIN');
  if ((session.role || '').toUpperCase() === 'BUSINESS_OWNER') {
    const business = await db.business.findFirst({ where: { id: businessId, ownerId: session.userId } });
    if (!business) {
      throw new Response(JSON.stringify({ error: 'Not your business' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }
  return session;
}

/**
 * Check if a user can manage a business (is the owner or an admin).
 * Used for route-level permission checks without throwing.
 */
export function canManageBusiness(user: any, ownerId: string): boolean {
  return (user.role || '').toUpperCase() === 'ADMIN' || user.userId === ownerId;
}

/**
 * Require the user to be either 'customer' or 'business' role.
 * Used for booking endpoints where both customers and business owners can book.
 */
export async function requireCustomerOrBusiness(): Promise<any> {
  return requireRole('CUSTOMER', 'BUSINESS_OWNER');
}

/**
 * Block specific roles from accessing an endpoint.
 * Throws 403 if the authenticated user HAS any of the specified roles.
 * Primary use case: block admin from booking as a customer.
 *
 * @param blockedRoles - Roles that should be blocked from this endpoint
 */
export async function blockRole(...blockedRoles: string[]): Promise<any> {
  const session = await requireAuth();
  if (blockedRoles.map(r => r.toUpperCase()).includes((session.role || '').toUpperCase())) {
    // Log unauthorized attempt
    try {
      await db.auditLog.create({
        data: {
          userId: session.userId,
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
  return session;
}

// OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createOTP(userId: string | null, email: string | null, phone: string | null, purpose: string): Promise<string> {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  await db.oTPVerification.create({
    data: { userId, email, phone, code, purpose, expiresAt }
  });
  
  return code;
}

export async function verifyOTP(code: string, purpose: string): Promise<{ userId?: string; email?: string; phone?: string } | null> {
  const record = await db.oTPVerification.findFirst({
    where: { code, purpose, verified: false, expiresAt: { gt: new Date() } }
  });
  
  if (!record) return null;
  
  await db.oTPVerification.update({
    where: { id: record.id },
    data: { verified: true }
  });
  
  return { userId: record.userId || undefined, email: record.email || undefined, phone: record.phone || undefined };
}
