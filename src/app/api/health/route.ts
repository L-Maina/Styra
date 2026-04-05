import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

interface HealthResponse {
  status: 'ok' | 'setup_needed' | 'error';
  timestamp: string;
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
    urlAnalysis: {
      protocol: string;
      host: string;
      port: string;
      user: string;
      database: string;
      isPooler: boolean;
      isDirectConnection: boolean;
      warnings: string[];
    };
  };
  error?: string;
  fix?: string;
  actions?: { message: string; url?: string };
}

function analyzeConnectionUrl(url: string | undefined) {
  if (!url) {
    return {
      protocol: 'none',
      host: 'none',
      port: 'none',
      user: 'none',
      database: 'none',
      isPooler: false,
      isDirectConnection: false,
      warnings: ['DATABASE_URL is not set — database will not work'],
    };
  }

  try {
    const parsed = new URL(url);
    const warnings: string[] = [];

    const isPooler = parsed.hostname.includes('pooler.supabase.com');
    const isDirectConnection = parsed.hostname.includes('.supabase.co') && !isPooler;
    const port = parsed.port || '5432';
    const user = parsed.username;

    // Check for common misconfigurations

    // 1. Using direct connection URL (port 5432) when pooler is expected
    if (isDirectConnection && process.env.NODE_ENV === 'production') {
      warnings.push(
        'Using direct connection (port 5432). Vercel serverless requires the Connection Pooler URL (port 6543). ' +
        'Get the pooler URL from: Supabase → Settings → Database → Connection string → Connection Pooling → Session mode'
      );
    }

    // 2. Using pooler with wrong port
    if (isPooler && port === '5432') {
      warnings.push(
        'FATAL: Using port 5432 with pooler.supabase.com — this causes "Tenant or user not found" error. ' +
        'Change to port 6543, or use the full Session mode connection string from Supabase.'
      );
    }

    // 3. Pooler URL but wrong username format
    if (isPooler && !user.includes('.')) {
      warnings.push(
        'Pooler URL username should be "postgres.[project-ref]", not just "postgres". ' +
        'Get the correct string from: Supabase → Settings → Database → Connection string → Connection Pooling → Session mode'
      );
    }

    // 4. No port specified with pooler
    if (isPooler && !parsed.port) {
      warnings.push('No port specified for pooler URL. Supabase pooler requires port 6543.');
    }

    // 5. Not a Supabase URL at all
    if (!parsed.hostname.includes('supabase')) {
      warnings.push('Host does not look like a Supabase URL. Expected *.supabase.co or *.pooler.supabase.com');
    }

    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port,
      user,
      database: parsed.pathname.replace('/', '') || 'none',
      isPooler,
      isDirectConnection,
      warnings,
    };
  } catch {
    return {
      protocol: 'invalid',
      host: 'invalid',
      port: 'invalid',
      user: 'invalid',
      database: 'invalid',
      isPooler: false,
      isDirectConnection: false,
      warnings: [`DATABASE_URL is not a valid URL. Value starts with: "${url.substring(0, 20)}..."`],
    };
  }
}

export async function GET() {
  const urlAnalysis = analyzeConnectionUrl(process.env.DATABASE_URL);

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

    const response: HealthResponse = {
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
        urlAnalysis,
      },
      actions: allTablesExist
        ? { message: 'Everything looks good!' }
        : {
            message: 'Database tables are missing. Send a POST request to /api/db-setup to create all tables automatically.',
            url: '/api/db-setup',
          },
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Health Check Failed] ${errorMessage}`);

    // Analyze the error to provide specific fix instructions
    let fix = 'Check Vercel function logs for details.';

    if (errorMessage.includes('Tenant or user not found')) {
      fix =
        'DATABASE_URL authentication failed with Supabase pooler.\n\n' +
        'This means the connection string credentials are wrong. Fix:\n' +
        '1. Go to Supabase Dashboard → Settings → Database\n' +
        '2. Under "Connection string", select "Connection Pooling" tab\n' +
        '3. Choose "Session mode" (NOT Transaction mode)\n' +
        '4. Copy the full connection string\n' +
        '5. In Vercel Dashboard → Settings → Environment Variables → Update DATABASE_URL with that string\n' +
        '6. Also add DIRECT_URL with the "URI" tab connection string (direct, port 5432)\n' +
        '7. Redeploy the app\n\n' +
        'The Session mode string should look like:\n' +
        'postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      fix =
        'Cannot reach the database server.\n\n' +
        'Check:\n' +
        '1. DATABASE_URL host is correct (should end in .supabase.co or .pooler.supabase.com)\n' +
        '2. Port is 6543 for pooler, 5432 for direct\n' +
        '3. Your Supabase project is not paused';
    } else if (errorMessage.includes('authentication failed') || errorMessage.includes('password authentication')) {
      fix =
        'Database password is wrong.\n\n' +
        '1. Go to Supabase Dashboard → Settings → Database\n' +
        '2. Click "Reset database password" if needed\n' +
        '3. Copy the new connection string\n' +
        '4. Update DATABASE_URL in Vercel Dashboard';
    } else if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      fix =
        'Database tables have not been created yet.\n\n' +
        'Fix: Send a POST request to /api/db-setup to create all tables automatically.';
    } else if (errorMessage.includes('DATABASE_URL')) {
      fix =
        'DATABASE_URL environment variable is not set.\n\n' +
        'Fix: Vercel Dashboard → Settings → Environment Variables → Add DATABASE_URL.\n' +
        'Value: Supabase Connection Pooling URL (Session mode)';
    }

    const response: HealthResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_URL,
        urlAnalysis,
      },
      error: errorMessage,
      fix,
    };

    return NextResponse.json(response, { status: 503 });
  }
}
