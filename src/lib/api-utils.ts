import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  code?: string;
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

export function errorResponse(error: string, status = 400, details?: string, code?: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error, details, code }, { status } as const);
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

  // Log error details — ALWAYS log, even in production
  const errorType = error instanceof Error ? error.constructor.name : typeof error;
  const errorMessage = error instanceof Error ? error.message : 'unknown';
  console.error(`[API Error] Type: ${errorType}, Message: ${errorMessage}`);

  // Log stack only in development for debugging
  if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
    console.error(`[API Error Stack] ${error.stack}`);
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    return errorResponse(messages.join(', '), 400);
  }

  // Prisma Initialization Errors — connection failures, engine errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    const msg = error.message;
    const errorCode = error.errorCode;

    // Log the actual Prisma error code for debugging
    console.error(`[DB Init Error] Code: ${errorCode}, Message: ${msg}`);

    if (msg.includes('Tenant or user not found') || errorCode === 'P1000') {
      return errorResponse(
        'Database connection error: Supabase pooler cannot authenticate. Your DATABASE_URL is likely wrong.',
        503,
        'Go to Supabase Dashboard → Settings → Database → Connection string → Connection Pooling → Session mode. Copy that URL and set it as DATABASE_URL in Vercel. Make sure the port is 6543.',
        errorCode
      );
    }

    if (msg.includes('ECONNREFUSED') || errorCode === 'P1001') {
      return errorResponse(
        'Database unreachable. The server at the DATABASE_URL host/port is not responding.',
        503,
        'Check your DATABASE_URL. The host should be *.pooler.supabase.com (port 6543) or *.supabase.co (port 5432).',
        errorCode
      );
    }

    if (msg.includes('timed out') || errorCode === 'P1008') {
      return errorResponse(
        'Database connection timed out.',
        503,
        'The database took too long to respond. This may be due to network issues or a paused Supabase project.',
        errorCode
      );
    }

    if (msg.includes('DATABASE_URL') || errorCode === 'P1003') {
      return errorResponse(
        'DATABASE_URL environment variable is not set or invalid.',
        500,
        'Set DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.',
        errorCode
      );
    }

    return errorResponse(
      'Database connection failed.',
      503,
      msg,
      errorCode
    );
  }

  // Prisma Known Request Errors — query-level issues
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const msg = error.message;
    const code = error.code;

    // Log the actual Prisma error code for debugging
    console.error(`[DB Query Error] Code: ${code}, Message: ${msg}`);

    switch (code) {
      case 'P2002':
        return errorResponse('A record with this value already exists', 409, undefined, code);
      case 'P2025':
        return errorResponse('Record not found', 404, undefined, code);
      case 'P2003':
        return errorResponse('Invalid reference to related record', 400, undefined, code);
      case 'P2032':
        return errorResponse('Database type mismatch — please contact support', 500);
      case 'P2021':
        // Table does not exist in database
        const tableMatch = msg.match(/table `?\w+`\.`?(\w+)`?/i) || msg.match(/relation "(\w+)"/);
        const tableName = tableMatch ? tableMatch[1] : 'unknown';
        return errorResponse(
          `Database not set up. Table "${tableName}" is missing.`,
          503,
          'Run database setup: POST /api/db-setup — this creates all required tables in your Supabase database.',
          code
        );
      case 'P1001':
        return errorResponse(
          'Cannot connect to database.',
          503,
          'Check your DATABASE_URL and ensure your Supabase project is not paused.',
          code
        );
      case 'P1000':
        return errorResponse(
          'Database authentication failed.',
          503,
          'Your DATABASE_URL has wrong credentials. Get the correct connection string from Supabase Dashboard → Settings → Database → Connection string.',
          code
        );
      default:
        // For any unknown Prisma error, include the actual error message and code
        return errorResponse(
          'A database error occurred.',
          500,
          `[${code}] ${msg.substring(0, 300)}`,
          code
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error(`[Prisma Validation Error] ${error.message}`);
    return errorResponse('Invalid data provided', 400, error.message.substring(0, 300));
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
        500,
        msg
      );
    }

    // Connection refused / timeout
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
      return errorResponse(
        'Cannot connect to database. Check your DATABASE_URL.',
        503,
        msg
      );
    }

    // Missing table — most common issue when Supabase tables aren't created yet
    if (msg.includes('relation') && msg.includes('does not exist')) {
      const tableMatch = msg.match(/relation "(\w+)"/);
      const tableName = tableMatch ? tableMatch[1] : 'unknown';
      return errorResponse(
        `Database table "${tableName}" does not exist. Run database setup: POST /api/db-setup`,
        503,
        msg
      );
    }

    // Supabase pooler: Tenant or user not found
    if (msg.includes('Tenant or user not found')) {
      return errorResponse(
        'Database connection error: Supabase pooler cannot find your project. ' +
        'Your DATABASE_URL likely has the wrong format.',
        503,
        'Fix: Get the "Session mode" connection string from Supabase Dashboard → Settings → Database → Connection string → Connection Pooling. Make sure port is 6543.'
      );
    }

    // Authentication failed (wrong password in connection URL)
    if (msg.includes('authentication failed') || msg.includes('password authentication')) {
      return errorResponse(
        'Database authentication failed. Your DATABASE_URL has wrong credentials.',
        503,
        'Get the correct connection string from Supabase Dashboard → Settings → Database → Connection string.'
      );
    }

    // Database does not exist
    if (msg.includes('database') && msg.includes('does not exist')) {
      return errorResponse(
        'Database does not exist. Create it in Supabase Dashboard.',
        503,
        msg
      );
    }

    // Include the actual error message in the error field so the frontend can show it
    const userMessage = msg.length > 200 ? msg.substring(0, 200) + '...' : msg;
    return errorResponse(userMessage, 400);
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
