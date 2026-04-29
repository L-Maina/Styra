import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint — shows environment variable INFO (no secrets exposed).
 * Visit /api/debug-env to see what Vercel actually has configured.
 *
 * DELETE THIS ENDPOINT AFTER DEBUGGING.
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const parsed = dbUrl ? (() => {
    try {
      const u = new URL(dbUrl);
      return {
        raw: dbUrl.substring(0, 50) + '...(truncated)',
        protocol: u.protocol,
        username: u.username,
        host: u.hostname,
        port: u.port || 'default(5432)',
        database: u.pathname.replace('/', ''),
        hasQueryParams: !!u.search,
        queryParams: u.searchParams.toString().substring(0, 100),
        isPooler: u.hostname.includes('pooler.supabase.com'),
        isDirect: u.hostname.includes('.supabase.co') && !u.hostname.includes('pooler'),
      };
    } catch {
      return { raw: dbUrl.substring(0, 50), parseError: true };
    }
  })() : { raw: '(not set)' };

  const allEnvKeys = Object.keys(process.env)
    .filter(k => k.startsWith('DATABASE') || k.startsWith('DIRECT') || k.startsWith('JWT') || k.startsWith('NEXT_PUBLIC'))
    .sort();

  return NextResponse.json({
    message: 'Debug env info (no secrets exposed)',
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    region: process.env.VERCEL_REGION || 'unknown',
    url: process.env.VERCEL_URL || 'unknown',
    databaseUrl: parsed,
    envVarCount: Object.keys(process.env).length,
    relevantEnvKeys: allEnvKeys,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
  });
}
