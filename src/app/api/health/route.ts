import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

interface PublicHealthResponse {
  status: 'ok' | 'setup_needed' | 'error';
  timestamp: string;
}

interface DetailedHealthResponse extends PublicHealthResponse {
  database?: {
    connected: boolean;
    latencyMs: number;
  };
  tables?: {
    allExist: boolean;
    checked: { name: string; exists: boolean }[];
  };
  records?: { users: number; businesses: number };
  env?: {
    nodeEnv: string;
    hasDatabaseUrl: boolean;
    hasDirectUrl: boolean;
    hasJwtSecret: boolean;
    hasResendKey: boolean;
    hasStripeKey: boolean;
  };
  error?: string;
  fix?: string;
  actions?: { message: string; url?: string };
}

export async function GET(request: Request) {
  try {
    const { db } = await import('@/lib/db');

    // Test database connectivity
    const start = Date.now();
    await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    const dbLatency = Date.now() - start;

    // Check if key tables exist
    let allTablesExist = true;
    let tableInfo: { exists: boolean; name: string }[] = [];
    let counts = { users: 0, businesses: 0 };

    try {
      const tables = await db.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      const tableNames = new Set(tables.map(t => t.tablename));

      const critical = ['User', 'Business', 'Service', 'Booking', 'Payment'];
      tableInfo = critical.map(name => ({
        name,
        exists: tableNames.has(name),
      }));

      allTablesExist = tableInfo.every(t => t.exists);

      if (allTablesExist) {
        try {
          const [uc, bc] = await Promise.all([db.user.count(), db.business.count()]);
          counts = { users: uc, businesses: bc };
        } catch {
          // ignore
        }
      }
    } catch {
      allTablesExist = false;
      tableInfo = [
        { name: 'User', exists: false },
        { name: 'Business', exists: false },
      ];
    }

    // Try to determine if this is an admin request
    let isAdmin = false;
    try {
      await requireAdmin();
      isAdmin = true;
    } catch {
      // Not admin — return minimal public health info
    }

    // ── PUBLIC RESPONSE (no sensitive data) ──
    if (!isAdmin) {
      const publicResponse: PublicHealthResponse = {
        status: allTablesExist ? 'ok' : 'setup_needed',
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(publicResponse);
    }

    // ── ADMIN RESPONSE (includes diagnostic info) ──
    const adminResponse: DetailedHealthResponse = {
      status: allTablesExist ? 'ok' : 'setup_needed',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latencyMs: dbLatency,
      },
      tables: {
        allExist: allTablesExist,
        checked: tableInfo,
      },
      records: counts,
      env: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      },
      actions: allTablesExist
        ? { message: 'Everything looks good!' }
        : {
            message: 'Database tables are missing. Send a POST request to /api/db-setup to create all tables automatically.',
            url: '/api/db-setup',
          },
    };

    return NextResponse.json(adminResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Health Check Failed] ${errorMessage}`);

    // Try to determine if this is an admin request
    let isAdmin = false;
    try {
      await requireAdmin();
      isAdmin = true;
    } catch {
      // Not admin
    }

    // ── PUBLIC ERROR RESPONSE (no sensitive details) ──
    if (!isAdmin) {
      return NextResponse.json({
        status: 'error',
        timestamp: new Date().toISOString(),
      } as PublicHealthResponse, { status: 503 });
    }

    // ── ADMIN ERROR RESPONSE (includes fix instructions) ──
    let fix = 'Check Vercel function logs for details.';

    if (errorMessage.includes('Tenant or user not found')) {
      fix = 'DATABASE_URL authentication failed with Supabase pooler. Check your connection string format.';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      fix = 'Cannot reach the database server. Check DATABASE_URL host and port.';
    } else if (errorMessage.includes('authentication failed') || errorMessage.includes('password authentication')) {
      fix = 'Database password is wrong. Update DATABASE_URL in Vercel Dashboard.';
    } else if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      fix = 'Database tables not created yet. POST /api/db-setup to create them.';
    } else if (errorMessage.includes('DATABASE_URL')) {
      fix = 'DATABASE_URL environment variable is not set. Add it in Vercel Dashboard.';
    }

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      },
      error: errorMessage,
      fix,
    } as DetailedHealthResponse, { status: 503 });
  }
}
