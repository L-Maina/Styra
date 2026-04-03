import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a PrismaClient optimized for Supabase + Vercel serverless.
 *
 * Supabase connection string format:
 *   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * IMPORTANT: Use the pooler URL (port 6543) from Supabase → Settings → Database.
 * Do NOT append pgbouncer=true or connection_limit params — Supabase handles this.
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    if (process.env.NODE_ENV !== 'production') {
      // In local dev, let Prisma use the .env DATABASE_URL (may be SQLite)
      return new PrismaClient({
        log: ['query', 'warn', 'error'],
      });
    }
    throw new Error(
      '[FATAL] DATABASE_URL is not set. ' +
      'Go to Vercel Dashboard → Settings → Environment Variables → Add DATABASE_URL. ' +
      'Get it from Supabase → Settings → Database → Connection string (URI).'
    );
  }

  // Use the DATABASE_URL as-is — don't modify it.
  // Supabase pooler URLs already have the correct params.
  // Appending extra params (pgbouncer=true, connection_limit=1) can break the connection.
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'warn', 'error'],
  });
}

// Lazy singleton
let _prisma: PrismaClient | undefined;

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  _prisma = createPrismaClient();
  return _prisma;
}

// Proxy-based lazy export — PrismaClient is only created when first accessed
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

// Cache in dev for HMR
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = getPrisma();
}

export default db;
