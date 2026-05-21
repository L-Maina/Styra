/**
 * RBAC (Role-Based Access Control) Permission Engine
 *
 * Provides role normalization, permission definitions, and access control
 * for the Styra platform. Bridges the gap between DB-lowercase roles
 * and frontend-uppercase UserRole types.
 *
 * IMPORTANT: This module is imported by client-side code (store/index.ts).
 * Do NOT import any server-only modules (db, fs, etc.) here.
 *
 * Usage:
 *   - Server-side: import `logUnauthorizedAccess` from '@/lib/rbac-server'
 *   - Client-side: import `normalizeRole`, `normalizeUserFromAPI` for store hydration
 */

import type { UserRole, UserMode, User } from '@/types';

// ============================================
// ROLE NORMALIZATION
// ============================================

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
    'admin:full_access',
    'admin:manage_users',
    'admin:manage_businesses',
    'dashboard:admin',
    'profile:view',
    'profile:edit',
    'dispute:create',
    'dispute:manage',
    'chat:view',
  ],
  BUSINESS_OWNER: [
    'business:create',
    'business:edit',
    'business:delete',
    'business:manage',
    'service:create',
    'service:edit',
    'service:delete',
    'staff:create',
    'staff:edit',
    'staff:delete',
    'dashboard:business',
    'booking:view',
    'booking:manage',
    'payment:view',
    'chat:send',
    'chat:view',
    'dispute:create',
    'dispute:manage',
    'profile:view',
    'profile:edit',
  ],
  CUSTOMER: [
    'booking:create',
    'booking:cancel',
    'booking:review',
    'booking:view',
    'payment:create',
    'payment:view',
    'favorite:add',
    'favorite:remove',
    'dashboard:customer',
    'chat:send',
    'chat:view',
    'dispute:create',
    'profile:view',
    'profile:edit',
  ],
};

/**
 * Get the full set of permissions for a given role.
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get the effective permissions for a user based on their current active mode.
 */
export function getPermissionsForMode(user: User): Permission[] {
  switch (user.activeMode) {
    case 'ADMIN':
      return ROLE_PERMISSIONS.ADMIN;
    case 'PROVIDER':
      return ROLE_PERMISSIONS.BUSINESS_OWNER;
    case 'CLIENT':
    default:
      return ROLE_PERMISSIONS.CUSTOMER;
  }
}

// ============================================
// PERMISSION CHECKS
// ============================================

/**
 * Check if a user has a specific permission based on their current active mode.
 */
export function hasPermission(user: User, permission: Permission): boolean {
  const permissions = getPermissionsForMode(user);
  return permissions.includes(permission);
}

/**
 * More flexible permission check that supports wildcard patterns.
 */
export function canPerformAction(user: User, action: string): boolean {
  const permissions = getPermissionsForMode(user);

  if (permissions.includes(action as Permission)) return true;

  if (action.endsWith(':*')) {
    const prefix = action.slice(0, -1);
    return permissions.some(p => p.startsWith(prefix));
  }

  if (permissions.includes('admin:full_access') && user.activeMode === 'ADMIN') return true;

  return false;
}

// ============================================
// UTILITY: Quick role checks
// ============================================

export function isAdmin(user: User): boolean {
  return user.roles.includes('ADMIN');
}

export function isBusinessOwner(user: User): boolean {
  return user.roles.includes('BUSINESS_OWNER');
}

export function isCustomer(user: User): boolean {
  return user.roles.includes('CUSTOMER');
}

export function isInAdminMode(user: User): boolean {
  return user.activeMode === 'ADMIN';
}

export function isInProviderMode(user: User): boolean {
  return user.activeMode === 'PROVIDER';
}

export function isInClientMode(user: User): boolean {
  return user.activeMode === 'CLIENT';
}
