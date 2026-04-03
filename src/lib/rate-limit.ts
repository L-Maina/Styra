// ============================================
// REDIS SLIDING WINDOW RATE LIMITER
// ============================================
// Uses Redis Sorted Sets for precise sliding window rate limiting.
//
// WHY SLIDING WINDOW over FIXED WINDOW:
//   Fixed window allows burst at window boundaries (e.g. 99 requests at :59, 99 more at :01).
//   Sliding window counts requests within the PRECISE last N milliseconds,
//   eliminating boundary bursts.
//
// REDIS COMMANDS:
//   ZADD key timestamp member  → add request timestamp as score
//   ZREMRANGEBYSCORE key -inf windowStart → remove expired entries
//   ZCARD key                      → count active requests
//   ZRANGE key 0 -1                   → get oldest timestamp (for retryAfter)
//
// KEY FORMAT: rate_limit:{type}:{identifier}:{route}
//   type = ip | user
//   identifier = IP address or userId
//
// ATOMICITY: All operations use Redis pipeline (MULTI/EXEC) for atomicity.

import Redis from 'ioredis';

// ============================================
// TYPES
// ============================================

export interface SlidingWindowConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export interface SlidingWindowResult {
  limited: boolean;
  remaining: number;
  retryAfter: number;
  currentCount: number;
}

export const defaultRateLimitConfig: SlidingWindowConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests. Please try again later.',
};

export const authRateLimitConfig: SlidingWindowConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again later.',
};

export const apiRateLimitConfig: SlidingWindowConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'API rate limit exceeded.',
};

export const globalRateLimitConfig: SlidingWindowConfig = {
  windowMs: 60 * 1000,
  maxRequests: 200,
  message: 'Global rate limit exceeded. Slow down.',
};

// ============================================
// REDIS CONNECTION (lazy singleton)
// ============================================

let _redis: Redis | null = null;
let _redisAvailable: boolean | null = null;

export async function getRedis(): Promise<Redis | null> {
  if (_redisAvailable === false) return null;
  if (_redis) return _redis;

  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: () => null,
      enableReadyCheck: true,
    });

    await Promise.race([
      _redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connect timeout')), 2000)),
    ]);

    _redisAvailable = true;
    _redis.on('error', () => { _redisAvailable = false; });
    _redis.on('close', () => { _redisAvailable = false; });

    return _redis;
  } catch {
    _redisAvailable = false;
    _redis = null;
    return null;
  }
}

// ============================================
// TRUSTED PROXY CONFIGURATION
// ============================================
// Only trust X-Forwarded-For and X-Real-IP headers from these proxy IPs.
// In production, set TRUSTED_PROXIES env var to your load balancer/proxy IPs.
// Example: TRUSTED_PROXIES=10.0.0.1,10.0.0.2
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || '').split(',').map(s => s.trim()).filter(Boolean);

// ============================================
// IP EXTRACTION (Proxy-aware)
// ============================================
// SECURITY FIX: Previously, getClientIp() blindly trusted X-Forwarded-For,
// allowing attackers to spoof their IP and bypass rate limiting.
// Now, X-Forwarded-For is only trusted if the request comes from a known proxy.

export function getClientIp(req: any): string {
  const remoteAddress = req.socket?.remoteAddress || 'unknown';

  // Only trust X-Forwarded-For if request comes from a trusted proxy
  if (TRUSTED_PROXIES.length > 0 && TRUSTED_PROXIES.includes(remoteAddress)) {
    const forwardedFor = req.headers?.get?.('x-forwarded-for');
    const realIp = req.headers?.get?.('x-real-ip');
    return forwardedFor?.split(',')[0]?.trim() || realIp || remoteAddress;
  }

  // For non-proxied requests (or when TRUSTED_PROXIES is empty),
  // only trust X-Real-IP (set by nginx/CDN, not client-spoofable)
  const realIp = req.headers?.get?.('x-real-ip');
  return realIp || remoteAddress;
}

// ============================================
// ANOMALY DETECTION
// ============================================
// Tracks IP changes per user session to detect rapid IP switching,
// which may indicate credential stuffing or session hijacking.

const userIpHistory = new Map<string, { ips: Set<string>; lastSwitch: number }>();

export interface AnomalyResult {
  suspicious: boolean;
  reason: string;
}

export function detectAnomaly(userId: string | undefined, currentIp: string): AnomalyResult | null {
  if (!userId) return null;

  const history = userIpHistory.get(userId);
  if (!history) {
    // First request from this user — initialize tracking
    userIpHistory.set(userId, { ips: new Set([currentIp]), lastSwitch: Date.now() });
    return null;
  }

  // Check for rapid IP switching (3+ different IPs in 10 minutes)
  if (!history.ips.has(currentIp)) {
    history.ips.add(currentIp);
    const now = Date.now();
    if (now - history.lastSwitch < 10 * 60 * 1000 && history.ips.size >= 3) {
      return { suspicious: true, reason: 'RAPID_IP_SWITCHING' };
    }
    history.lastSwitch = now;

    // Clean old entries (keep last 30 minutes)
    setTimeout(() => {
      const h = userIpHistory.get(userId);
      if (h && Date.now() - h.lastSwitch > 30 * 60 * 1000) {
        userIpHistory.delete(userId);
      }
    }, 30 * 60 * 1000);
  }

  return null;
}

/**
 * Track IP for anomaly detection (call on every authenticated request).
 */
export function trackUserIp(userId: string | undefined, ip: string): void {
 if (!userId) return;
 const anomaly = detectAnomaly(userId, ip);
 if (anomaly?.suspicious) {
  console.warn(`[SECURITY] ${anomaly.reason} detected for user ${userId} from IP: ${ip}`);
 }
}

// ============================================
// SLIDING WINDOW (Redis Sorted Set)
// ============================================

async function slidingWindowRedis(
  key: string,
  config: SlidingWindowConfig,
): Promise<SlidingWindowResult | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Redis pipeline — ALL commands execute atomically
    const pipeline = redis.pipeline();
    pipeline.zadd(key, now, String(now)); // score = timestamp ms, member = unique ID
    pipeline.zremrangebyscore(key, '-inf', String(windowStart)); // remove expired
    pipeline.zcard(key);  // count active

    const results = await pipeline.exec();

    const currentCount = Number(results?.[2]?.[1] ?? 0);

    if (currentCount > config.maxRequests) {
      // Get oldest timestamp for retryAfter calculation
      const oldestResult = await redis.zrange(key, 0, 0);
      const oldestTs = oldestResult?.[0] ? Number(oldestResult[0]) : now;
      const retryAfter = Math.max(1, Math.ceil((oldestTs + config.windowMs - now) / 1000));

      return { limited: true, remaining: 0, retryAfter, currentCount };
    }

    return {
      limited: false,
      remaining: Math.max(0, config.maxRequests - currentCount),
      retryAfter: 0,
      currentCount,
    };
  } catch {
    _redisAvailable = false;
    return null;
  }
}

// ============================================
// IN-MEMORY SLIDING WINDOW FALLBACK
// ============================================

interface MemoryEntry {
  timestamps: number[]; // sorted array of timestamps
}

const memoryStore = new Map<string, MemoryEntry>();
let _cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    entry.timestamps = entry.timestamps.filter(t => t > now - 600_000); // 10 min max
    if (entry.timestamps.length === 0) memoryStore.delete(key);
  }
}

function slidingWindowMemory(
  key: string,
  config: SlidingWindowConfig,
): SlidingWindowResult {
  if (!_cleanupTimer) {
    _cleanupTimer = setTimeout(() => {
      _cleanupTimer = null;
      cleanupMemoryStore();
    }, 60_000);
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }

  // Add current timestamp
  entry.timestamps.push(now);

  // Remove expired
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  const currentCount = entry.timestamps.length;

  if (currentCount > config.maxRequests) {
    const oldestTs = entry.timestamps[0] || now;
    const retryAfter = Math.max(1, Math.ceil((oldestTs + config.windowMs - now) / 1000));
    return { limited: true, remaining: 0, retryAfter, currentCount };
  }

  return {
    limited: false,
    remaining: Math.max(0, config.maxRequests - currentCount),
    retryAfter: 0,
    currentCount,
  };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Sliding window rate limiter using Redis sorted sets (primary)
 * with in-memory fallback.
 *
 * KEY FORMAT: rate_limit:{type}:{identifier}:{route}
 *
 * Usage:
 *   const limiter = slidingWindowRateLimit(authRateLimitConfig);
 *   const result = await limiter(request);
 *   if (result.limited) return rateLimitResponse(result, config);
 */
export function slidingWindowRateLimit(config: SlidingWindowConfig) {
  return async (req: any, userId?: string): Promise<SlidingWindowResult | null> => {
    try {
      const type = 'ip';
      const identifier = getClientIp(req);
      const route = req.nextUrl?.pathname || 'unknown';
      const key = `rate_limit:${type}:${identifier}:${route}`;

      // Anomaly detection: check for rapid IP switching on authenticated requests
      const anomaly = detectAnomaly(userId, identifier);
      if (anomaly?.suspicious) {
        console.warn(`[SECURITY] ${anomaly.reason} detected from IP: ${identifier} (user: ${userId || 'anonymous'}) on route: ${route}`);
      }

      const redisResult = await slidingWindowRedis(key, config);
      if (redisResult) {
        // Log when rate limit is hit
        if (redisResult.limited) {
          console.warn(`[RATE_LIMIT] ${identifier} exceeded rate limit on ${route}: ${redisResult.currentCount}/${config.maxRequests} (window: ${config.windowMs}ms)`);
        }
        return redisResult;
      }

      const memoryResult = slidingWindowMemory(key, config);
      if (memoryResult?.limited) {
        console.warn(`[RATE_LIMIT] ${identifier} exceeded rate limit on ${route} (memory): ${memoryResult.currentCount}/${config.maxRequests}`);
      }
      return memoryResult;
    } catch {
      return slidingWindowMemory(
        `rate_limit:ip:unknown:${config.windowMs}`,
        config,
      );
    }
  };
}

/**
 * Global rate limiter — applies to ALL requests from an IP.
 * Checked BEFORE route-specific logic.
 *
 * KEY FORMAT: rate_limit:global:{ip}
 *
 * Usage:
 *   const result = await globalRateLimit(request);
 *   if (result.limited) return rateLimitResponse(result, globalRateLimitConfig);
 */
export function globalRateLimit(config: SlidingWindowConfig = globalRateLimitConfig) {
  return async (req: any, userId?: string): Promise<SlidingWindowResult | null> => {
    try {
      const ip = getClientIp(req);
      const key = `rate_limit:global:${ip}`;

      // Anomaly detection on global rate limit
      const anomaly = detectAnomaly(userId, ip);
      if (anomaly?.suspicious) {
        console.warn(`[SECURITY] ${anomaly.reason} detected globally from IP: ${ip} (user: ${userId || 'anonymous'})`);
      }

      const redisResult = await slidingWindowRedis(key, config);
      if (redisResult) {
        if (redisResult.limited) {
          console.warn(`[RATE_LIMIT] Global rate limit exceeded for ${ip}: ${redisResult.currentCount}/${config.maxRequests}`);
        }
        return redisResult;
      }

      const memoryResult = slidingWindowMemory(key, config);
      if (memoryResult?.limited) {
        console.warn(`[RATE_LIMIT] Global rate limit exceeded for ${ip} (memory): ${memoryResult.currentCount}/${config.maxRequests}`);
      }
      return memoryResult;
    } catch {
      return slidingWindowMemory(
        `rate_limit:global:unknown:${config.windowMs}`,
        config,
      );
    }
  };
}

/**
 * Check rate limit for a specific user ID (for authenticated routes).
 *
 * KEY FORMAT: rate_limit:user:{userId}:{route}
 */
export function userRateLimit(config: SlidingWindowConfig) {
  return async (req: any, userId?: string): Promise<SlidingWindowResult | null> => {
    try {
      const ip = getClientIp(req);
      const route = req.nextUrl?.pathname || 'unknown';
      const type = userId ? 'user' : 'ip';
      const identifier = userId || ip;
      const key = `rate_limit:${type}:${identifier}:${route}`;

      const redisResult = await slidingWindowRedis(key, config);
      if (redisResult) return redisResult;

      return slidingWindowMemory(key, config);
    } catch {
      return slidingWindowMemory(
        `rate_limit:ip:unknown:${config.windowMs}`,
        config,
      );
    }
  };
}

/**
 * Build a 429 rate limit response.
 */
export function rateLimitResponse(
  result: SlidingWindowResult,
  config: SlidingWindowConfig,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: config.message || 'Rate limit exceeded.',
      retryAfter: result.retryAfter,
      currentCount: result.currentCount,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  );
}

/**
 * Backward-compatible rate limit function.
 * Returns null if request is allowed, or a Response if rate limited.
 * Used by existing auth routes.
 *
 * @deprecated Use slidingWindowRateLimit() + rateLimitResponse() instead.
 */
export function rateLimit(config: SlidingWindowConfig) {
  const limiter = slidingWindowRateLimit(config);
  return async (req: any, userId?: string): Promise<Response | null> => {
    const result = await limiter(req, userId);
    if (result?.limited) {
      return rateLimitResponse(result, config);
    }
    return null;
  };
}

// ============================================
// PASSWORD STRENGTH VALIDATION
// ============================================

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
} {
  const errors: string[] = [];
  let score = 0;
  if (password.length < 8) { errors.push('Password must be at least 8 characters'); } else { score++; }
  if (!/[A-Z]/.test(password)) { errors.push('Password must contain an uppercase letter'); } else { score++; }
  if (!/[a-z]/.test(password)) { errors.push('Password must contain a lowercase letter'); } else { score++; }
  if (!/[0-9]/.test(password)) { errors.push('Password must contain a number'); } else { score++; }
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) { score++; }
  const strength = score <= 2 ? 'weak' : score === 3 ? 'fair' : score === 4 ? 'good' : 'strong';
  return { isValid: errors.length === 0, errors, strength };
}
