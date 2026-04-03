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
  const databaseUrl = process.env.DATABASE_URL || '';

  // Append pooler parameters if not already present
  const url = new URL(databaseUrl);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '1');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }
  // Ensure pgbouncer mode for transaction-mode pooler
  if (!url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: url.toString(),
      },
    },
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'warn', 'error'],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// In development, cache on globalThis to survive HMR re-renders
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = db;
}

export default db;
