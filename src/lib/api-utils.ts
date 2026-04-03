import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(error: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

export function messageResponse(message: string, status = 200): NextResponse<ApiResponse> {
  return NextResponse.json({ success: true, message }, { status });
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): NextResponse<ApiResponse<T[]>> {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  // Handle Response throws from auth middleware (requireAuth, requireAdmin, etc.)
  if (error instanceof Response) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: error.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // SECURITY: Do NOT log full error objects — they may contain sensitive data
  // (tokens, passwords, connection strings, internal paths).
  // Only log a safe error type indicator in production.
  if (process.env.NODE_ENV === 'development') {
    // In dev, log error type (not full details) for debugging
    const errorType = error instanceof Error ? error.constructor.name : typeof error;
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    console.error(`[API Error] Type: ${errorType}, Message: ${errorMessage}`);
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    return errorResponse(messages.join(', '), 400);
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return errorResponse('A record with this value already exists', 409);
      case 'P2025':
        return errorResponse('Record not found', 404);
      case 'P2003':
        return errorResponse('Invalid reference to related record', 400);
      default:
        // SECURITY: Do not expose Prisma error codes or messages to client
        return errorResponse('A database error occurred', 500);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse('Invalid data provided', 400);
  }

  // Custom errors (used by auth middleware)
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Authentication required', 401);
    }
    if (error.message === 'Forbidden') {
      return errorResponse('You do not have permission to perform this action', 403);
    }
    // SECURITY: Do not expose internal error messages to client
    return errorResponse('An error occurred', 400);
  }

  return errorResponse('An unexpected error occurred', 500);
}

// Rate limiting uses lib/rate-limit.ts with Redis (ioredis) as primary store.
// Falls back to in-memory when Redis is unavailable.
// CSRF protection is handled centrally in middleware.ts for all state-changing API routes.
// Audit logging uses lib/audit-log.ts — fire-and-forget to Prisma SecurityAuditLog.
//
// For per-route rate limiting, import from @/lib/rate-limit:
//   import { rateLimit, authRateLimitConfig } from '@/lib/rate-limit';
//   const limiter = rateLimit(authRateLimitConfig);
//   const response = await limiter(request);
//   if (response) return response;

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// Generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Format currency
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Parse pagination params — re-exported from query-optimization for backward compatibility
// Handles NaN gracefully (e.g., ?page=abc defaults to page 1)
export { parsePagination } from './query-optimization';
