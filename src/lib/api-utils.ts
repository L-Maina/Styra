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

  // Log error details
  const errorType = error instanceof Error ? error.constructor.name : typeof error;
  const errorMessage = error instanceof Error ? error.message : 'unknown';
  console.error(`[API Error] Type: ${errorType}, Message: ${errorMessage}`);
  if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
    console.error(`[API Error Stack] ${error.stack}`);
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    return errorResponse(messages.join(', '), 400);
  }

  // Prisma errors — detect specific issues and give actionable messages
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return errorResponse('A record with this value already exists', 409);
      case 'P2025':
        return errorResponse('Record not found', 404);
      case 'P2003':
        return errorResponse('Invalid reference to related record', 400);
      default:
        return errorResponse('A database error occurred', 500);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse('Invalid data provided', 400);
  }

  // Generic errors — detect common database issues
  if (error instanceof Error) {
    const msg = error.message;

    if (msg === 'Unauthorized') {
      return errorResponse('Authentication required', 401);
    }
    if (msg === 'Forbidden') {
      return errorResponse('You do not have permission to perform this action', 403);
    }

    // DATABASE_URL not set
    if (msg.includes('DATABASE_URL')) {
      return errorResponse(
        'Database not configured. Set DATABASE_URL in Vercel environment variables.',
        500
      );
    }

    // Connection refused / timeout
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('connect')) {
      return errorResponse(
        'Cannot connect to database. Check your DATABASE_URL.',
        500
      );
    }

    // Missing table — most common issue when Supabase tables aren't created yet
    if (msg.includes('relation') && msg.includes('does not exist')) {
      const tableMatch = msg.match(/relation "(\w+)"/);
      const tableName = tableMatch ? tableMatch[1] : 'unknown';
      return errorResponse(
        `Database table "${tableName}" does not exist. Run database setup: POST /api/db-setup`,
        500
      );
    }

    // Authentication failed (wrong password in connection URL)
    if (msg.includes('authentication failed') || msg.includes('password authentication')) {
      return errorResponse(
        'Database authentication failed. Check your DATABASE_URL credentials.',
        500
      );
    }

    // Database does not exist
    if (msg.includes('database') && msg.includes('does not exist')) {
      return errorResponse(
        'Database does not exist. Create it in Supabase Dashboard, then set DATABASE_URL.',
        500
      );
    }

    return errorResponse('An error occurred', 400);
  }

  return errorResponse('An unexpected error occurred', 500);
}

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
  const R = 6371;
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

// Parse pagination params
export { parsePagination } from './query-optimization';
