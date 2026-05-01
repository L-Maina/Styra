import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton for Supabase PostgreSQL on Vercel serverless.
 *
 * Key issues on Vercel:
 * 1. Each API route is a separate function — without caching, every request
 *    opens a new DB connection, exhausting the Supabase pooler quickly.
 * 2. Cold starts create fresh instances — the singleton must use globalThis
 *    to survive across invocations of the same warm function.
 * 3. Long-lived idle connections get dropped by the pooler — we need to
 *    detect stale connections and reconnect.
 * 4. DATABASE_URL may not be available at module-load time (build phase,
 *    cold-start races). We use a lazy Proxy so the client is only created
 *    on first actual query — inside route handlers where errors can be
 *    caught by handleApiError and returned as proper HTTP responses.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildDatabaseUrl(url: string): string {
  if (url.startsWith('file:')) return url;

  const params: string[] = [];
  if (!url.includes('pgbouncer=')) params.push('pgbouncer=true');
  if (!url.includes('connection_limit=')) params.push('connection_limit=1');
  if (!url.includes('pool_timeout=')) params.push('pool_timeout=15');
  if (!url.includes('connect_timeout=')) params.push('connect_timeout=10');
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
 * Build a PrismaClient. Never throws — if DATABASE_URL is missing,
 * a client is still returned. Prisma itself will throw a
 * PrismaClientInitializationError on the first query, which is caught
 * by handleApiError in route handlers and returned as a 503 response.
 */
function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    console.error(
      '[DB] DATABASE_URL is not set. Queries will fail with PrismaClientInitializationError. ' +
      'Fix: set DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.'
    );
    // Return a minimal client — it will throw on first query, but that error
    // is caught inside API route handlers by handleApiError and returned as
    // a proper 503 JSON response instead of crashing the function.
    return new PrismaClient({
      log: ['error'],
    });
  }

  const databaseUrl = buildDatabaseUrl(rawUrl);
  console.log(`[DB] Connecting: ${safeLogUrl(databaseUrl)}`);

  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

  // Soft-close on app termination — lets in-flight queries finish
  process.on('beforeExit', async () => {
    try { await client.$disconnect(); } catch { /* ignore */ }
  });

  return client;
}

/**
 * Get or create the Prisma singleton.
 *
 * Uses globalThis so the same client is reused across requests
 * within the same Vercel function instance (warm starts).
 */
function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

/**
 * Reset the Prisma singleton (used when connection is stale).
 */
async function resetPrisma(): Promise<PrismaClient> {
  try {
    await globalForPrisma.prisma?.$disconnect();
  } catch {
    /* ignore disconnect errors */
  }
  globalForPrisma.prisma = undefined;
  return getPrisma();
}

/**
 * Database wrapper that auto-reconnects on connection errors.
 *
 * Prisma connection errors have codes like:
 *   P1001 - Can't reach database
 *   P1008 - Operation timed out
 *   P2024 - Timed out fetching a new connection from the pool
 *
 * On these errors we disconnect the stale client and create a fresh one.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;

    // Only auto-retry on connection-related Prisma errors
    const isConnectionError =
      code === 'P1001' ||
      code === 'P1008' ||
      code === 'P2024';

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
 * Usage is identical to before: db.user.findMany(...), db.business.create(...)
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

// Re-export reset for manual use if needed
export { resetPrisma, withRetry };
