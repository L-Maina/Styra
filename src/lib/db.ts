import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build the database URL with pgbouncer=true for Supabase pooler.
 * This is REQUIRED because Supabase's Supavisor (port 6543) does not
 * support prepared statements, and Prisma uses them by default.
 * Adding pgbouncer=true tells Prisma to use simple query protocol.
 */
function buildDatabaseUrl(url: string): string {
  // Only add pgbouncer=true for PostgreSQL URLs going through Supabase pooler
  if (!url.includes('supabase') && !url.includes('pooler')) {
    return url;
  }
  if (url.includes('pgbouncer=')) {
    return url; // Already has the param
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}pgbouncer=true`;
}

/**
 * Create a PrismaClient optimized for Supabase + Vercel serverless.
 *
 * REQUIRED ENV VARS (set in Vercel Dashboard → Settings → Environment Variables):
 *
 *   DATABASE_URL = Supabase Connection Pooling URL (Session mode, port 6543)
 *     Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *     The ?pgbouncer=true param is auto-appended for Supabase URLs.
 */
function createPrismaClient() {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    if (process.env.NODE_ENV !== 'production') {
      // In local dev, let Prisma use the .env DATABASE_URL (may be SQLite)
      return new PrismaClient({
        log: ['query', 'warn', 'error'],
      });
    }
    throw new Error(
      '[FATAL] DATABASE_URL is not set.\n\n' +
      'Fix: Go to Vercel Dashboard → Settings → Environment Variables → Add DATABASE_URL.\n' +
      'Value: Supabase Connection Pooling URL (Session mode) from Supabase → Settings → Database → Connection string.'
    );
  }

  // Append pgbouncer=true for Supabase pooler connections
  const databaseUrl = buildDatabaseUrl(rawDatabaseUrl);

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
