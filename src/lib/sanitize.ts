// ============================================
// GLOBAL RESPONSE SANITIZATION
// ============================================
// Defense-in-depth: strip sensitive fields from ANY object
// before sending to the client, even if the Prisma query used
// `select` to exclude them. This prevents accidental leaks if
// a future developer adds `include` without thinking about it.
//
// RULES:
//   1. Never include fields in SENSITIVE_FIELDS
//   2. Never include fields starting with underscore (internal)
//   3. Strip null/undefined values (reduces response size)

// Sensitive fields that must NEVER appear in API responses
const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  // Authentication secrets
  'password',
  'passwordHash',
  'hashedPassword',
  'tokenVersion',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'otp',
  'verificationCode',
  'resetToken',
  'emailVerificationToken',
  // Third-party provider identifiers / tokens
  'stripeCustomerId',
  'paypalCustomerId',
  'mpesaPhoneNumber',
  'providerRef',       // External payment provider IDs (Payment/Payout)
  'authKey',           // Web Push auth secret (PushSubscription)
  'p256dhKey',         // Web Push encryption key (PushSubscription)
  'code',              // OTP verification code
]);

/**
 * Sanitize a single user object — remove all sensitive fields
 * before sending to client. Also removes any field starting with
 * an underscore (internal fields).
 *
 * @param user - Raw user object from Prisma or DB
 * @returns Sanitized user object safe for client consumption
 */
export function sanitizeUser(user: Record<string, unknown>): Record<string, unknown> {
  if (!user || typeof user !== 'object') return user;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(user)) {
    // Skip sensitive fields
    if (SENSITIVE_FIELDS.has(key)) continue;
    // Skip internal/private fields
    if (key.startsWith('_')) continue;
    // Skip null/undefined
    if (value === null || value === undefined) continue;

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Sanitize an array of user objects.
 *
 * @param users - Array of raw user objects
 * @returns Array of sanitized user objects
 */
export function sanitizeUsers(users: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!Array.isArray(users)) return users;
  return users.map(sanitizeUser);
}

/**
 * Deep-sanitize an arbitrary response object.
 * Recursively walks through objects and arrays, sanitizing any
 * object that looks like it contains user data (has 'email', 'id', 'name', etc.)
 *
 * This is a safety net — prefer explicit sanitizeUser() where possible.
 */
export function sanitizeResponse<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item)) as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    // Always strip sensitive fields at any depth
    if (SENSITIVE_FIELDS.has(key)) continue;
    // Always strip internal fields at any depth
    if (key.startsWith('_')) continue;

    if (value !== null && value !== undefined && typeof value === 'object') {
      sanitized[key] = sanitizeResponse(value);
    } else if (value !== null && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
