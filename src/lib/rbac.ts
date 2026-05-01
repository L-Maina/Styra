/**
 * RBAC (Role-Based Access Control) Permission Engine
 *
 * Provides role normalization, permission definitions, and access control
 * for the Styra platform. Bridges the gap between DB-lowercase roles
 * and frontend-uppercase UserRole types.
 *
 * Usage:
 *   - Server-side: import directly, use `hasPermission()` / `logUnauthorizedAccess()`
 *   - Client-side: import `normalizeRole`, `normalizeUserFromAPI` for store hydration
 */

import { db } from './db';
import type { UserRole, UserMode, User } from '@/types';

// ============================================
// ROLE NORMALIZATION
// ============================================

/**
 * Maps database lowercase role strings to frontend uppercase UserRole values.
 */
const ROLE_MAP: Record<string, UserRole> = {
  admin: 'ADMIN',
  business: 'BUSINESS_OWNER',
  customer: 'CUSTOMER',
  // Also handle already-normalized uppercase (idempotent)
  admin_upper: 'ADMIN',
  business_owner: 'BUSINESS_OWNER',
  businessowner: 'BUSINESS_OWNER',
};

/**
 * Normalize a single role string to the standard uppercase UserRole.
 * Handles both DB lowercase and already-normalized uppercase values.
 *
 * @param role - Raw role string from DB or API
 * @returns Normalized UserRole
 */
export function normalizeRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase();

  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'business' || normalized === 'business_owner' || normalized === 'businessowner') return 'BUSINESS_OWNER';
  // Default to CUSTOMER for unknown roles (safe fallback)
  return 'CUSTOMER';
}

/**
 * Normalize an array of role strings to UserRole[].
 *
 * @param roles - Array of raw role strings
 * @returns Array of normalized UserRole values
 */
export function normalizeRoles(roles: string[]): UserRole[] {
  return roles.map(normalizeRole);
}

/**
 * Takes a raw API user response object and returns a properly normalized User.
 * This is the primary entry point for client-side code that receives user data
 * from the backend API.
 *
 * Handles:
 * - Role normalization (lowercase DB → uppercase frontend)
 * - Roles array creation (single role → array)
 * - Active mode inference from role
 * - Date parsing
 *
 * @param apiUser - Raw user object from API response (may have lowercase roles)
 * @returns Properly normalized User object
 */
export function normalizeUserFromAPI(apiUser: Record<string, unknown>): User {
  const rawRole = (apiUser.role as string) || 'CUSTOMER';
  const normalizedRole = normalizeRole(rawRole);

  // Build roles array: if the API returns a roles array, normalize it;
  // otherwise derive from the single role
  let rawRoles: string[];
  if (Array.isArray(apiUser.roles) && apiUser.roles.length > 0) {
    rawRoles = apiUser.roles as string[];
  } else {
    rawRoles = [rawRole];
  }
  const normalizedRoles = normalizeRoles(rawRoles);

  // Infer active mode from normalized roles
  const activeMode = inferDefaultMode(normalizedRoles, apiUser.activeMode as string | undefined);

  return {
    id: (apiUser.id as string) || '',
    email: (apiUser.email as string) || '',
    phone: (apiUser.phone as string) || undefined,
    name: (apiUser.name as string) || undefined,
    avatar: (apiUser.avatar as string) || undefined,
    role: normalizedRole,
    roles: normalizedRoles,
    activeMode: activeMode,
    defaultMode: (apiUser.defaultMode as UserMode) || undefined,
    emailVerified: apiUser.emailVerified ? new Date(apiUser.emailVerified as string) : undefined,
    phoneVerified: apiUser.phoneVerified ? new Date(apiUser.phoneVerified as string) : undefined,
    createdAt: apiUser.createdAt ? new Date(apiUser.createdAt as string) : new Date(),
    updatedAt: apiUser.updatedAt ? new Date(apiUser.updatedAt as string) : new Date(),
    businessVerificationStatus: (apiUser.businessVerificationStatus as User['businessVerificationStatus']) || undefined,
    idType: (apiUser.idType as User['idType']) || undefined,
    idNumber: (apiUser.idNumber as string) || undefined,
    idDocumentUrl: (apiUser.idDocumentUrl as string) || undefined,
    idVerifiedAt: apiUser.idVerifiedAt ? new Date(apiUser.idVerifiedAt as string) : undefined,
    businessName: (apiUser.businessName as string) || undefined,
    businessDescription: (apiUser.businessDescription as string) || undefined,
    businessAddress: (apiUser.businessAddress as string) || undefined,
    businessCity: (apiUser.businessCity as string) || undefined,
    businessCountry: (apiUser.businessCountry as string) || undefined,
    businessWebsite: (apiUser.businessWebsite as string) || undefined,
    clientData: (apiUser.clientData as User['clientData']) || undefined,
    providerData: (apiUser.providerData as User['providerData']) || undefined,
  };
}

/**
 * Infers the default UserMode from an array of normalized roles.
 */
function inferDefaultMode(roles: UserRole[], existingMode?: string): UserMode {
  // If an existing activeMode is already a valid uppercase UserMode, keep it
  if (existingMode && ['CLIENT', 'PROVIDER', 'ADMIN'].includes(existingMode.toUpperCase())) {
    return existingMode.toUpperCase() as UserMode;
  }

  // Infer from roles
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('BUSINESS_OWNER')) return 'PROVIDER';
  return 'CLIENT';
}

// ============================================
// PERMISSION DEFINITIONS
// ============================================

/**
 * All possible permissions in the system.
 * Format: `{resource}:{action}` or `{resource}:{sub_resource}`
 */
export type Permission =
  // Booking permissions
  | 'booking:create'
  | 'booking:cancel'
  | 'booking:review'
  | 'booking:view'
  | 'booking:manage'
  // Payment permissions
  | 'payment:create'
  | 'payment:refund'
  | 'payment:view'
  // Favorite permissions
  | 'favorite:add'
  | 'favorite:remove'
  // Business permissions
  | 'business:create'
  | 'business:edit'
  | 'business:delete'
  | 'business:manage'
  // Service permissions
  | 'service:create'
  | 'service:edit'
  | 'service:delete'
  // Staff permissions
  | 'staff:create'
  | 'staff:edit'
  | 'staff:delete'
  // Admin permissions
  | 'admin:full_access'
  | 'admin:manage_users'
  | 'admin:manage_businesses'
  // Chat permissions
  | 'chat:send'
  | 'chat:view'
  // Dispute permissions
  | 'dispute:create'
  | 'dispute:manage'
  // Dashboard permissions
  | 'dashboard:customer'
  | 'dashboard:business'
  | 'dashboard:admin'
  // Profile permissions
  | 'profile:view'
  | 'profile:edit';

// ============================================
// ROLE-TO-PERMISSION MAPPINGS
// ============================================

/**
 * Permission sets for each UserRole (role-level, not mode-level).
 * These define the MAXIMUM permissions a role CAN have.
 * The actual permissions depend on the active mode (see getPermissionsForMode).
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    // Full admin access
    'admin:full_access',
    'admin:manage_users',
    'admin:manage_businesses',
    // Dashboard
    'dashboard:admin',
    // Profile
    'profile:view',
    'profile:edit',
    // Dispute management
    'dispute:create',
    'dispute:manage',
    // Chat (read-only for admin monitoring)
    'chat:view',
  ],
  BUSINESS_OWNER: [
    // Business management
    'business:create',
    'business:edit',
    'business:delete',
    'business:manage',
    // Service management
    'service:create',
    'service:edit',
    'service:delete',
    // Staff management
    'staff:create',
    'staff:edit',
    'staff:delete',
    // Dashboard
    'dashboard:business',
    // Booking management (as provider)
    'booking:view',
    'booking:manage',
    // Payment visibility
    'payment:view',
    // Chat
    'chat:send',
    'chat:view',
    // Disputes
    'dispute:create',
    'dispute:manage',
    // Profile
    'profile:view',
    'profile:edit',
  ],
  CUSTOMER: [
    // Booking (as customer)
    'booking:create',
    'booking:cancel',
    'booking:review',
    'booking:view',
    // Payment
    'payment:create',
    'payment:view',
    // Favorites
    'favorite:add',
    'favorite:remove',
    // Dashboard
    'dashboard:customer',
    // Chat
    'chat:send',
    'chat:view',
    // Disputes
    'dispute:create',
    // Profile
    'profile:view',
    'profile:edit',
  ],
};

/**
 * Get the full set of permissions for a given role.
 * This does NOT consider the active mode — it returns all permissions
 * the role is capable of having.
 *
 * @param role - A normalized UserRole
 * @returns Array of all permissions for this role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get the effective permissions for a user based on their current active mode.
 * This is the main permission check function that considers mode context.
 *
 * Mode-based permission logic:
 * - ADMIN mode → only admin permissions (NO booking, payment, favorite)
 * - PROVIDER mode → business owner permissions (NO booking as customer)
 * - CLIENT mode → customer permissions
 *
 * @param user - Normalized User object with activeMode
 * @returns Array of effective permissions for the user's current mode
 */
export function getPermissionsForMode(user: User): Permission[] {
  switch (user.activeMode) {
    case 'ADMIN':
      // Admin mode: only admin-level permissions
      // Intentionally no booking, payment, or favorite permissions
      return ROLE_PERMISSIONS.ADMIN;

    case 'PROVIDER':
      // Provider mode: business management permissions
      // Intentionally no booking:create, booking:cancel (those are customer actions)
      return ROLE_PERMISSIONS.BUSINESS_OWNER;

    case 'CLIENT':
    default:
      // Client mode: customer permissions (booking, favorites, etc.)
      return ROLE_PERMISSIONS.CUSTOMER;
  }
}

// ============================================
// PERMISSION CHECKS
// ============================================

/**
 * Check if a user has a specific permission based on their current active mode.
 *
 * @param user - Normalized User object
 * @param permission - The permission to check
 * @returns true if the user has the permission in their current mode
 */
export function hasPermission(user: User, permission: Permission): boolean {
  const permissions = getPermissionsForMode(user);
  return permissions.includes(permission);
}

/**
 * More flexible permission check that supports wildcard patterns.
 * e.g., 'booking:*' matches all booking permissions.
 *
 * @param user - Normalized User object
 * @param action - Action string, can include wildcards (e.g., 'service:*')
 * @returns true if the user can perform the action
 */
export function canPerformAction(user: User, action: string): boolean {
  const permissions = getPermissionsForMode(user);

  // Exact match
  if (permissions.includes(action as Permission)) {
    return true;
  }

  // Wildcard match: 'service:*' matches 'service:create', 'service:edit', etc.
  if (action.endsWith(':*')) {
    const prefix = action.slice(0, -1); // Remove the '*' but keep the ':'
    return permissions.some(p => p.startsWith(prefix));
  }

  // Check for admin:full_access (admin can do anything)
  if (permissions.includes('admin:full_access') && user.activeMode === 'ADMIN') {
    return true;
  }

  return false;
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log an unauthorized access attempt to the audit log.
 * Creates an AuditLog entry in the database for security monitoring.
 *
 * This is a server-side function — it directly accesses the database.
 * Do NOT call this from client-side code.
 *
 * @param userId - The ID of the user who attempted unauthorized access
 * @param action - The action they attempted (e.g., 'booking:create')
 * @param resource - Optional resource identifier (e.g., business ID, booking ID)
 */
export async function logUnauthorizedAccess(
  userId: string,
  action: string,
  resource?: string
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action: `UNAUTHORIZED:${action}`,
        resource: resource || null,
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          action,
          resource,
        }),
        ipAddress: 'unknown',
      },
    });
  } catch (error) {
    // Fail silently — audit logging should never break the application
    console.error('[RBAC] Failed to log unauthorized access:', error);
  }
}

// ============================================
// UTILITY: Quick role checks
// ============================================

/**
 * Check if a user has the ADMIN role.
 */
export function isAdmin(user: User): boolean {
  return user.roles.includes('ADMIN');
}

/**
 * Check if a user has the BUSINESS_OWNER role.
 */
export function isBusinessOwner(user: User): boolean {
  return user.roles.includes('BUSINESS_OWNER');
}

/**
 * Check if a user has the CUSTOMER role.
 */
export function isCustomer(user: User): boolean {
  return user.roles.includes('CUSTOMER');
}

/**
 * Check if a user is currently in ADMIN mode.
 */
export function isInAdminMode(user: User): boolean {
  return user.activeMode === 'ADMIN';
}

/**
 * Check if a user is currently in PROVIDER mode.
 */
export function isInProviderMode(user: User): boolean {
  return user.activeMode === 'PROVIDER';
}

/**
 * Check if a user is currently in CLIENT mode.
 */
export function isInClientMode(user: User): boolean {
  return user.activeMode === 'CLIENT';
}
