import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

export async function GET() {
  try {
    // Dynamic import to catch Prisma init errors
    const { db } = await import('@/lib/db');

    // Test database connectivity with a raw query
    const start = Date.now();
    const result = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    const dbLatency = Date.now() - start;

    // Count key tables
    const [businessCount, userCount] = await Promise.all([
      db.business.count(),
      db.user.count(),
    ]);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latencyMs: dbLatency,
        rawResult: result,
        businesses: businessCount,
        users: userCount,
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_DATABASE_URL,
        databaseUrlPrefix: process.env.DATABASE_URL?.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')?.substring(0, 80) || 'NOT SET',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : null;
    const errorType = error instanceof Error ? error.constructor.name : typeof error;
    console.error(`[Health Check Failed] Type: ${errorType}, Message: ${errorMessage}`);
    if (errorStack) {
      console.error(`[Health Check Stack] ${errorStack}`);
    }

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
        errorType,
        stack: errorStack?.split('\n').slice(0, 5), // First 5 stack lines
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasDirectUrl: !!process.env.DIRECT_DATABASE_URL,
          databaseUrlPrefix: process.env.DATABASE_URL?.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')?.substring(0, 80) || 'NOT SET',
        },
      },
      { status: 503 }
    );
  }
}
