import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  try {
    const { db } = await import('@/lib/db');

    // Test database connectivity
    const start = Date.now();
    const result = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    const dbLatency = Date.now() - start;

    // Check if key tables exist
    let tableInfo: { exists: boolean; name: string }[] = [];
    try {
      const tables = await db.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      const tableNames = new Set(tables.map(t => t.tablename));

      // Check critical tables
      const critical = ['User', 'Business', 'Service', 'Booking', 'Payment'];
      tableInfo = critical.map(name => ({
        name,
        exists: tableNames.has(name),
      }));
    } catch {
      // If pg_tables fails, tables might not exist at all
      tableInfo = [
        { name: 'User', exists: false },
        { name: 'Business', exists: false },
      ];
    }

    const allTablesExist = tableInfo.every(t => t.exists);

    // Count records if tables exist
    let counts = { users: 0, businesses: 0 };
    if (allTablesExist) {
      try {
        const [uc, bc] = await Promise.all([db.user.count(), db.business.count()]);
        counts = { users: uc, businesses: bc };
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
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
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPrefix: process.env.DATABASE_URL
          ?.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
          ?.substring(0, 80) || 'NOT SET',
      },
      actions: allTablesExist
        ? { message: 'Everything looks good!' }
        : {
            message: 'Database tables are missing.',
            fix: 'Send a POST request to /api/db-setup to create all tables automatically.',
            url: '/api/db-setup',
          },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Health Check Failed] ${errorMessage}`);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          databaseUrlPrefix: process.env.DATABASE_URL
            ?.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
            ?.substring(0, 80) || 'NOT SET',
        },
        fix: errorMessage.includes('DATABASE_URL')
          ? 'Set DATABASE_URL in Vercel Dashboard → Settings → Environment Variables. Get it from Supabase → Settings → Database → Connection string (URI).'
          : errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')
          ? 'Cannot connect to database. Check your DATABASE_URL — it should be the full Supabase PostgreSQL URL.'
          : errorMessage.includes('relation') || errorMessage.includes('does not exist')
          ? 'Database tables are missing. POST to /api/db-setup to create them.'
          : 'Check Vercel function logs for details.',
      },
      { status: 503 }
    );
  }
}
