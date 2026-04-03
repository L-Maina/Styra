// ============================================
// API SECURITY WRAPPER
// ============================================
// Wraps API route handlers with security checks.

import { NextRequest, NextResponse } from 'next/server';
import { globalRateLimit, slidingWindowRateLimit, rateLimitResponse, SlidingWindowConfig, globalRateLimitConfig, getClientIp } from './rate-limit';
import { logRateLimitViolation, logGlobalRateLimit, extractRequestInfo } from './audit-log';
import { trackSecurityEvent } from './security-alerts';

export interface SecurityConfig {
  globalLimit?: SlidingWindowConfig;
  routeLimit?: SlidingWindowConfig;
  skipGlobalLimit?: boolean;
  skipRouteLimit?: boolean;
}

type RouteHandler = (req: NextRequest) => Promise<Response> | Response;

function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).substring(2, 14);
  return `req_${ts}_${r}`;
}

export function withSecurity(config: SecurityConfig, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const requestId = generateRequestId();
    const ip = getClientIp(req);
    const route = req.nextUrl.pathname;

    try {
      // Global rate limit check
      if (!config.skipGlobalLimit) {
        const checker = globalRateLimit(config.globalLimit || globalRateLimitConfig);
        const result = await checker(req);
        if (result?.limited) {
          const { userAgent } = extractRequestInfo(req);
          logGlobalRateLimit(ip, userAgent);
          trackSecurityEvent({ type: 'RATE_LIMIT_ABUSE', ipAddress: ip, details: { route, globalCount: result.currentCount } });
          const response = rateLimitResponse(result, config.globalLimit || globalRateLimitConfig);
          response.headers.set('X-Request-ID', requestId);
          return response;
        }
      }

      // Route-specific rate limit
      if (config.routeLimit && !config.skipRouteLimit) {
        const checker = slidingWindowRateLimit(config.routeLimit);
        const result = await checker(req);
        if (result?.limited) {
          const { userAgent } = extractRequestInfo(req);
          logRateLimitViolation(ip, route, ip, userAgent);
          trackSecurityEvent({ type: 'RATE_LIMIT_ABUSE', ipAddress: ip, details: { route, routeCount: result.currentCount } });
          const response = rateLimitResponse(result, config.routeLimit);
          response.headers.set('X-Request-ID', requestId);
          return response;
        }
      }

      const response = await handler(req);
      response.headers.set('X-Request-ID', requestId);
      return response;
    } catch (error) {
      const status = error instanceof Error && error.message === 'Unauthorized' ? 401
        : error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
      const body = status === 401 ? { success: false, error: 'Authentication required' }
        : status === 403 ? { success: false, error: 'Access denied' }
        : { success: false, error: 'Internal server error' };
      const response = NextResponse.json(body, { status });
      response.headers.set('X-Request-ID', requestId);
      return response;
    }
  };
}

export function withAuthSecurity(handler: RouteHandler): RouteHandler {
  return withSecurity({
    routeLimit: { windowMs: 15 * 60 * 1000, maxRequests: 5, message: 'Too many authentication attempts.' },
  }, handler);
}

export function withAdminSecurity(handler: RouteHandler): RouteHandler {
  return withSecurity({
    routeLimit: { windowMs: 60 * 1000, maxRequests: 60, message: 'Admin API rate limit exceeded.' },
  }, handler);
}
