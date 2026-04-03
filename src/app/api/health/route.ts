import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

export async function GET() {
  try {
    // Test database connectivity
    const start = Date.now();
    await db.$queryRaw`SELECT 1 as ok`;
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
        businesses: businessCount,
        users: userCount,
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPrefix: process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@')?.substring(0, 40) || 'NOT SET',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorType = error instanceof Error ? error.constructor.name : typeof error;
    console.error(`[Health Check Failed] Type: ${errorType}, Message: ${errorMessage}`);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
        errorType,
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          databaseUrlPrefix: process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@')?.substring(0, 40) || 'NOT SET',
        },
      },
      { status: 503 }
    );
  }
}
