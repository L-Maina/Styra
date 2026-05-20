/**
 * Strict rate limiting for financial endpoints.
 * Prevents abuse of payment, payout, and withdrawal APIs.
 */

const limits = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Financial rate limits (stricter than general API limits)
const FINANCIAL_LIMITS = {
  // Payment creation: max 10 per minute per user
  PAYMENT: { maxRequests: 10, windowMs: 60_000 },
  // Payout requests: max 5 per hour per user
  PAYOUT: { maxRequests: 5, windowMs: 60 * 60_000 },
  // Withdrawal requests: max 3 per day per admin
  WITHDRAWAL: { maxRequests: 3, windowMs: 24 * 60 * 60_000 },
  // Escrow operations: max 20 per minute per user
  ESCROW: { maxRequests: 20, windowMs: 60_000 },
  // Wallet operations: max 15 per minute per user
  WALLET: { maxRequests: 15, windowMs: 60_000 },
};

type FinancialAction = keyof typeof FINANCIAL_LIMITS;

export function checkFinancialRateLimit(
  identifier: string,
  action: FinancialAction,
): RateLimitResult {
  const limit = FINANCIAL_LIMITS[action];
  const key = `fin:${action}:${identifier}`;
  const now = Date.now();

  const entry = limits.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const newEntry = { count: 1, resetAt: now + limit.windowMs };
    limits.set(key, newEntry);
    return {
      allowed: true,
      remaining: limit.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  if (entry.count >= limit.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits) {
    if (now > entry.resetAt) limits.delete(key);
  }
}, 60_000).unref?.();
