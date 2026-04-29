import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton for Supabase PostgreSQL on Vercel serverless.
 *
 * CRITICAL: In Vercel serverless, each API route runs in its own function.
 * Without global caching, every request creates a new connection, quickly
 * exhausting Supabase's connection pool. That causes the "works for a minute
 * then breaks" pattern.
 *
 * The globalThis singleton ensures one PrismaClient per function instance,
 * reusing the connection across requests.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build database URL with Supabase pooler parameters.
 */
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

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    if (process.env.NODE_ENV !== 'production') {
      return new PrismaClient({ log: ['warn', 'error'] });
    }
    throw new Error(
      '[FATAL] DATABASE_URL is not set. Set it in Vercel Dashboard → Settings → Environment Variables.'
    );
  }

  const databaseUrl = buildDatabaseUrl(rawUrl);

  console.log(`[DB] Connecting: ${safeLogUrl(databaseUrl)}`);

  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });
}

function getPrisma(): PrismaClient {
  // Use globalThis in ALL environments (not just dev) to survive
  // Vercel's hot-reloading and function reuse within the same instance
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Single shared instance — always use globalThis
export const db = getPrisma();

// Cleanup on process exit (dev only)
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await globalForPrisma.prisma?.$disconnect();
  });
}

export default db;
