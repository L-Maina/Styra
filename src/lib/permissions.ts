// ============================================
// PERMISSION-BASED ACCESS CONTROL (RBAC+)
// ============================================
// Fine-grained permission system extending basic role-based access.

import { AuthUser, requireAuth } from './auth';
import { logPermissionDenied } from './audit-log';

export type Permission =
  | 'manage_users' | 'view_all_users' | 'ban_users' | 'change_roles'
  | 'manage_business' | 'manage_own_business' | 'approve_business' | 'suspend_business' | 'manage_all_businesses'
  | 'manage_services' | 'manage_own_services'
  | 'manage_staff' | 'manage_own_staff'
  | 'manage_bookings' | 'manage_own_bookings' | 'manage_all_bookings' | 'cancel_any_booking'
  | 'manage_calendar' | 'manage_own_calendar'
  | 'manage_portfolio' | 'manage_own_portfolio'
  | 'manage_reviews' | 'manage_own_reviews' | 'moderate_reviews'
  | 'view_analytics' | 'view_own_analytics' | 'view_all_analytics'
  | 'manage_payments' | 'view_own_payments' | 'view_all_revenue' | 'manage_payouts'
  | 'manage_content' | 'manage_blog' | 'manage_pages' | 'manage_ads'
  | 'manage_reports' | 'manage_disputes' | 'manage_claims' | 'manage_tickets'
  | 'manage_settings' | 'manage_platform_settings' | 'view_audit_logs' | 'view_security_alerts'
  | 'manage_favorites' | 'manage_own_favorites' | 'send_messages'
  | 'manage_profile' | 'manage_own_profile';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    'manage_users', 'view_all_users', 'ban_users', 'change_roles',
    'manage_business', 'manage_own_business', 'approve_business', 'suspend_business', 'manage_all_businesses',
    'manage_services', 'manage_own_services', 'manage_staff', 'manage_own_staff',
    'manage_bookings', 'manage_own_bookings', 'manage_all_bookings', 'cancel_any_booking',
    'manage_calendar', 'manage_own_calendar', 'manage_portfolio', 'manage_own_portfolio',
    'manage_reviews', 'manage_own_reviews', 'moderate_reviews',
    'view_analytics', 'view_own_analytics', 'view_all_analytics',
    'manage_payments', 'view_own_payments', 'view_all_revenue', 'manage_payouts',
    'manage_content', 'manage_blog', 'manage_pages', 'manage_ads',
    'manage_reports', 'manage_disputes', 'manage_claims', 'manage_tickets',
    'manage_settings', 'manage_platform_settings', 'view_audit_logs', 'view_security_alerts',
    'manage_favorites', 'manage_own_favorites', 'send_messages',
    'manage_profile', 'manage_own_profile',
  ],
  BUSINESS_OWNER: [
    'manage_own_business', 'manage_own_services', 'manage_own_staff',
    'manage_own_bookings', 'manage_own_calendar', 'manage_own_portfolio',
    'manage_own_reviews', 'view_own_analytics', 'view_own_payments',
    'manage_own_favorites', 'send_messages', 'manage_own_profile',
  ],
  CUSTOMER: [
    'manage_own_bookings', 'manage_own_profile', 'manage_own_reviews',
    'manage_own_favorites', 'view_own_payments', 'send_messages',
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
}

export function hasAnyPermission(user: AuthUser, permissions: Permission[]): boolean {
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  return permissions.some(p => rolePerms.includes(p));
}

export function hasAllPermissions(user: AuthUser, permissions: Permission[]): boolean {
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  return permissions.every(p => rolePerms.includes(p));
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireAuth();
  if (!hasPermission(user, permission)) {
    logPermissionDenied(user.id, user.email, '', '', '', { requiredPermission: permission, userRole: user.role });
    throw new Error('Forbidden');
  }
  return user;
}

export async function requireAnyPermission(permissions: Permission[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!hasAnyPermission(user, permissions)) {
    logPermissionDenied(user.id, user.email, '', '', '', { requiredAnyPermission: permissions, userRole: user.role });
    throw new Error('Forbidden');
  }
  return user;
}

export async function requireAllPermissions(permissions: Permission[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!hasAllPermissions(user, permissions)) {
    const missing = permissions.filter(p => !hasPermission(user, p));
    logPermissionDenied(user.id, user.email, '', '', '', { requiredAllPermissions: permissions, missingPermissions: missing, userRole: user.role });
    throw new Error('Forbidden');
  }
  return user;
}
