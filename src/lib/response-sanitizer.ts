/**
 * Centralized response sanitizer.
 * Strips sensitive fields from data objects before sending to client.
 *
 * SECURITY: This is a defense-in-depth measure. Individual routes
 * should still use `select` in Prisma queries, but this provides
 * an additional safety net.
 */

import { NextResponse } from 'next/server';
import {
  sanitizeUser,
  sanitizeUsers,
  sanitizeResponse,
} from '@/lib/sanitize';

// Re-export sanitize helpers for convenience
export { sanitizeUser, sanitizeUsers, sanitizeResponse };

/**
 * Payment metadata fields that may contain sensitive provider tokens.
 * These are parsed from the JSON `metadata` column on Payment model.
 */
const PAYMENT_SENSITIVE_METADATA_KEYS: ReadonlySet<string> = new Set([
  'stripePaymentIntentId',
  'stripeChargeId',
  'stripeClientId',
  'paypalOrderId',
  'paypalCaptureId',
  'paypalAccessToken',
  'mpesaTransactionId',
  'mpesaCheckoutRequestId',
]);

/**
 * Sanitize a payment object — strip raw provider metadata that may
 * contain tokens, client secrets, or internal identifiers.
 *
 * Keeps safe fields like transactionId and status for display.
 */
export function sanitizePayment(
  payment: Record<string, unknown>
): Record<string, unknown> {
  const safe = { ...payment };

  // Parse metadata JSON if present and strip sensitive keys
  if (safe.metadata && typeof safe.metadata === 'string') {
    try {
      const parsed = JSON.parse(safe.metadata) as Record<string, unknown>;
      const cleanMeta: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!PAYMENT_SENSITIVE_METADATA_KEYS.has(key)) {
          cleanMeta[key] = value;
        }
      }
      safe.metadata = JSON.stringify(cleanMeta);
    } catch {
      // If metadata isn't valid JSON, remove it entirely
      delete safe.metadata;
    }
  }

  return safe;
}

/**
 * Sanitize an array of payment objects.
 */
export function sanitizePayments(
  payments: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (!Array.isArray(payments)) return payments;
  return payments.map(sanitizePayment);
}

// Fields that are metadata-only and shouldn't appear in list responses
const LIST_STRIP_FIELDS: ReadonlySet<string> = new Set([
  'metadata',
  'metadataRaw',
]);

/**
 * Sanitize payment for list responses — more aggressive than single payment view.
 * Strips metadata entirely from list views (e.g. GET /api/payments) since
 * individual payment details can be fetched via GET /api/payments/:id.
 */
export function sanitizePaymentForList(
  payment: Record<string, unknown>
): Record<string, unknown> {
  const safe = { ...payment };
  for (const field of LIST_STRIP_FIELDS) {
    delete safe[field];
  }
  // Still pass through deep sanitize to strip any embedded sensitive fields
  return sanitizeResponse(safe);
}

/**
 * Sanitize an array of payments for list responses.
 */
export function sanitizePaymentsForList(
  payments: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (!Array.isArray(payments)) return payments;
  return payments.map(sanitizePaymentForList);
}

/**
 * Create a sanitized success response.
 * This should be the PRIMARY way to send success responses.
 *
 * Automatically strips sensitive fields from the data before sending.
 */
export function safeSuccessResponse<T>(
  data: T,
  status = 200
): NextResponse<{
  success: boolean;
  data: T;
}> {
  return NextResponse.json(
    {
      success: true,
      data: sanitizeResponse(data),
    },
    { status }
  );
}
