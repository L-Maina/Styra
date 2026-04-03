import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a PrismaClient optimized for Supabase + Vercel serverless.
 *
 * Supabase uses PgBouncer (transaction-mode pooler) on port 6543.
 * Vercel serverless functions are ephemeral — each cold start creates a new instance.
 * We must limit Prisma's connection pool to avoid exhausting PgBouncer.
 * The pooler manages real DB connections; Prisma just needs a small pool.
 */
function createPrismaClient() {
  // Build the connection URL with pooler-friendly parameters
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // In development, fall back to local SQLite
    if (process.env.NODE_ENV !== 'production') {
      return new PrismaClient({
        log: ['query', 'warn', 'error'],
      });
    }
    // In production, DATABASE_URL MUST be set — fail clearly
    throw new Error(
      '[FATAL] DATABASE_URL environment variable is not set. ' +
      'Please add it in Vercel Dashboard → Settings → Environment Variables.'
    );
  }

  // Only append pooler params for PostgreSQL URLs (not SQLite)
  let finalUrl = databaseUrl;
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    try {
      const url = new URL(databaseUrl);
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', '1');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', '10');
      }
      if (!url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true');
      }
      finalUrl = url.toString();
    } catch {
      // If URL parsing fails, use the raw URL
      finalUrl = databaseUrl;
    }
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: finalUrl,
      },
    },
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'warn', 'error'],
  });
}

// Lazy singleton: only create the client when first accessed.
// This avoids crashes during Next.js build or when DATABASE_URL is missing.
let _prisma: PrismaClient | undefined;

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  _prisma = createPrismaClient();
  return _prisma;
}

// Export a proxy so the client is created lazily on first use, not at module load time.
// This prevents new URL() crashes during SSR if DATABASE_URL is somehow unavailable.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// In development, cache on globalThis to survive HMR re-renders
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = getPrisma();
}

export default db;
