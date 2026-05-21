import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton for Supabase PostgreSQL on Vercel serverless.
 *
 * IMPORTANT: This module must NOT import or require any Node.js-only
 * modules ('fs', 'path', etc.) because it is indirectly referenced by
 * client-side code. Turbopack traces require() calls too.
 *
 * In production (Vercel), DATABASE_URL is set directly in environment variables.
 * In development, Next.js auto-loads .env files into process.env.
 * If DATABASE_URL is a SQLite override (sandbox), we fall back to
 * SUPABASE_DATABASE_URL env var.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildDatabaseUrl(url: string): string {
  if (url.startsWith('file:')) return url;

  const params: string[] = [];
  if (!url.includes('pgbouncer=')) params.push('pgbouncer=true');
  if (!url.includes('connection_limit=')) params.push('connection_limit=5');
  if (!url.includes('pool_timeout=')) params.push('pool_timeout=30');
  if (!url.includes('connect_timeout=')) params.push('connect_timeout=15');
  if (!url.includes('sslmode=')) params.push('sslmode=require');

  if (params.length === 0) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${params.join('&')}`;
}

function safeLogUrl(url: string): string {
  if (url.startsWith('file:')) return url;
  return url.replace(/:[^:@]+@/, ':****@');
}

/**
 * Resolve DATABASE_URL from process.env.
 * Handles common cases:
 * - PostgreSQL URL → use directly
 * - SQLite file: URL → try SUPABASE_DATABASE_URL fallback
 * - Missing → try SUPABASE_DATABASE_URL
 *
 * In production (Vercel), DATABASE_URL is set via environment variables.
 * In development, Next.js auto-loads .env files into process.env.
 * The SUPABASE_DATABASE_URL fallback handles sandbox environments
 * where DATABASE_URL might be overridden to a SQLite URL.
 */
function resolveDatabaseUrl(): string | undefined {
  const envUrl = process.env.DATABASE_URL;

  // If DATABASE_URL is a PostgreSQL URL, use it directly
  if (envUrl && (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://'))) {
    return envUrl;
  }

  // If DATABASE_URL is a SQLite file: URL (sandbox override), try fallback
  if (envUrl && envUrl.startsWith('file:')) {
    const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
    if (supabaseUrl && supabaseUrl.startsWith('postgresql://')) {
      console.log('[DB] Using SUPABASE_DATABASE_URL (DATABASE_URL was SQLite override).');
      return supabaseUrl;
    }

    console.warn(
      `[DB] DATABASE_URL is SQLite ("${envUrl}") but no PostgreSQL fallback found. ` +
      'Set SUPABASE_DATABASE_URL or ensure DATABASE_URL is a PostgreSQL URL.'
    );
    return envUrl;
  }

  // No DATABASE_URL — try SUPABASE_DATABASE_URL
  if (!envUrl) {
    const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
    if (supabaseUrl && supabaseUrl.startsWith('postgresql://')) {
      console.log('[DB] Using SUPABASE_DATABASE_URL (DATABASE_URL was not set).');
      return supabaseUrl;
    }
  }

  return envUrl;
}

/**
 * Build a PrismaClient. Never throws — if DATABASE_URL is missing,
 * a client is still returned. Prisma itself will throw on the first
 * query, caught by handleApiError in route handlers.
 */
function createPrismaClient(): PrismaClient {
  const rawUrl = resolveDatabaseUrl();

  if (!rawUrl) {
    console.error(
      '[DB] DATABASE_URL is not set. Queries will fail with PrismaClientInitializationError. ' +
      'Fix: set DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.'
    );
    return new PrismaClient({ log: ['error'] });
  }

  const databaseUrl = buildDatabaseUrl(rawUrl);
  console.log(`[DB] Connecting: ${safeLogUrl(databaseUrl)}`);

  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

  process.on('beforeExit', async () => {
    try { await client.$disconnect(); } catch { /* ignore */ }
  });

  return client;
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

async function resetPrisma(): Promise<PrismaClient> {
  try { await globalForPrisma.prisma?.$disconnect(); } catch { /* ignore */ }
  globalForPrisma.prisma = undefined;
  return getPrisma();
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    const isConnectionError = code === 'P1001' || code === 'P1008' || code === 'P2024';
    if (!isConnectionError) throw error;
    console.warn(`[DB] Connection error (${code}), reconnecting...`);
    const freshClient = await resetPrisma();
    return await operation.call(freshClient);
  }
}

// ── Lazy Proxy Export ────────────────────────────────────────────────────

/**
 * Prisma client — LAZY proxy.
 *
 * The actual PrismaClient is only created on first property access (i.e.
 * when you call db.business.findMany(...)). This prevents the module from
 * crashing at import time if DATABASE_URL is temporarily unavailable.
 *
 * Usage: db.user.findMany(...), db.business.create(...)
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export default db;
export { resetPrisma, withRetry };
