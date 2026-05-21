/**
 * Server-only RBAC functions that require database access.
 *
 * IMPORTANT: This module MUST NOT be imported from client-side code.
 * It imports `db` which uses PrismaClient (server-only).
 *
 * Usage (server-side only):
 *   import { logUnauthorizedAccess } from '@/lib/rbac-server';
 */

import { db } from './db';

/**
 * Log an unauthorized access attempt to the audit log.
 * Creates an AuditLog entry in the database for security monitoring.
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
