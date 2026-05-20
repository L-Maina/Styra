// ============================================
// MIDDLEWARE RATE LIMITER (Edge-compatible)
// ============================================
// Lightweight in-memory rate limiter designed for
// Next.js Edge Runtime middleware.
//
// LIMITATIONS:
//   - Per-process only (resets on server restart)
//   - In serverless with many instances, each instance
//     has its own state — but this is still far better
//     than no rate limiting at all.
//   - For production, the Redis-based limiter in
//     src/lib/rate-limit.ts provides the primary defense.
//     This middleware adds a FIRST line of defense.
//
// DESIGN:
//   - Sliding window with per-IP tracking
//   - Configurable limits per route category
//   - Automatic cleanup of expired entries
//   - Zero external dependencies (Edge-compatible)

// ============================================
// TYPES & CONFIG
// ============================================

interface RateLimitRule {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Error message when rate limited */
  message: string;
}

interface RequestLog {
  timestamps: number[];
}

// Rate limit rules by route category
const AUTH_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/google',
  '/api/auth/apple',
];

const AUTH_RATE_LIMIT: RateLimitRule = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
};

const API_RATE_LIMIT: RateLimitRule = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  message: 'API rate limit exceeded. Please slow down.',
};

const GLOBAL_RATE_LIMIT: RateLimitRule = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200,
  message: 'Too many requests. Please slow down.',
};

// Sensitive admin/cron routes that get stricter limits
const SENSITIVE_ROUTES = [
  '/api/setup',
  '/api/db-setup',
  '/api/admin/',
  '/api/cron/',
];

const SENSITIVE_RATE_LIMIT: RateLimitRule = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Rate limit exceeded for this endpoint.',
};

// ============================================
// IN-MEMORY STORE
// ============================================

const store = new Map<string, RequestLog>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 1000; // Cleanup every minute
const MAX_STORE_SIZE = 10000; // Prevent memory leaks

function cleanupStore(): void {
  const now = Date.now();

  // Only run cleanup periodically
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  // Remove expired entries
  for (const [key, log] of store) {
    // Remove entries older than the longest window (15 min for auth)
    const maxWindow = 15 * 60 * 1000;
    log.timestamps = log.timestamps.filter(t => t > now - maxWindow);
    if (log.timestamps.length === 0) {
      store.delete(key);
    }
  }

  // If store is still too large, remove oldest entries
  if (store.size > MAX_STORE_SIZE) {
    const entries = Array.from(store.entries())
      .sort((a, b) => {
        const aOldest = a[1].timestamps[0] ?? Infinity;
        const bOldest = b[1].timestamps[0] ?? Infinity;
        return aOldest - bOldest;
      });

    // Keep only the newest half
    const toKeep = entries.slice(Math.floor(entries.length / 2));
    store.clear();
    for (const [key, log] of toKeep) {
      store.set(key, log);
    }
  }
}

// ============================================
// IP EXTRACTION (Edge-compatible)
// ============================================

function getClientIp(request: Request): string {
  // Trust X-Real-IP (set by reverse proxy/CDN, not client-spoofable)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback to first X-Forwarded-For entry
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
}

// ============================================
// RATE LIMIT CHECK
// ============================================

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  rule: RateLimitRule;
}

function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - rule.windowMs;

  let log = store.get(key);
  if (!log) {
    log = { timestamps: [] };
    store.set(key, log);
  }

  // Add current timestamp
  log.timestamps.push(now);

  // Remove expired timestamps (sliding window)
  log.timestamps = log.timestamps.filter(t => t > windowStart);

  const currentCount = log.timestamps.length;

  if (currentCount > rule.maxRequests) {
    const oldestInWindow = log.timestamps[0] ?? now;
    const retryAfter = Math.max(1, Math.ceil((oldestInWindow + rule.windowMs - now) / 1000));
    return {
      allowed: false,
      limit: rule.maxRequests,
      remaining: 0,
      retryAfter,
      rule,
    };
  }

  return {
    allowed: true,
    limit: rule.maxRequests,
    remaining: Math.max(0, rule.maxRequests - currentCount),
    retryAfter: 0,
    rule,
  };
}

// ============================================
// ROUTE CLASSIFICATION
// ============================================

function classifyRoute(pathname: string): { category: 'auth' | 'sensitive' | 'api' | 'other'; rule: RateLimitRule } {
  // Auth routes — strictest limit
  if (AUTH_ROUTES.some(route => pathname.startsWith(route))) {
    return { category: 'auth', rule: AUTH_RATE_LIMIT };
  }

  // Sensitive routes (setup, admin, cron)
  if (SENSITIVE_ROUTES.some(route => pathname.startsWith(route))) {
    return { category: 'sensitive', rule: SENSITIVE_RATE_LIMIT };
  }

  // General API routes
  if (pathname.startsWith('/api/')) {
    return { category: 'api', rule: API_RATE_LIMIT };
  }

  return { category: 'other', rule: GLOBAL_RATE_LIMIT };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Check rate limit for an incoming request.
 * Returns null if allowed, or a Response object if rate limited.
 *
 * This is designed to be called from Next.js middleware.
 */
export function checkMiddlewareRateLimit(request: Request): Response | null {
  const { pathname } = new URL(request.url);

  // Skip non-API routes and health checks
  if (!pathname.startsWith('/api/')) return null;

  // Skip webhook routes (called by external services, rate-limited by signature verification)
  if (pathname.startsWith('/api/webhooks/')) return null;

  // Skip health endpoint (monitoring needs frequent access)
  if (pathname === '/api/health') return null;

  // Periodic cleanup
  cleanupStore();

  const ip = getClientIp(request);
  const { category, rule } = classifyRoute(pathname);

  // Check global rate limit first
  const globalKey = `global:${ip}`;
  const globalResult = checkRateLimit(globalKey, GLOBAL_RATE_LIMIT);

  if (!globalResult.allowed) {
    return createRateLimitResponse(globalResult);
  }

  // Check route-specific rate limit
  const routeKey = `${category}:${ip}:${pathname}`;
  const routeResult = checkRateLimit(routeKey, rule);

  if (!routeResult.allowed) {
    return createRateLimitResponse(routeResult);
  }

  return null; // Request is allowed
}

/**
 * Create a 429 rate limit response.
 */
function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: result.rule.message,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  );
}
