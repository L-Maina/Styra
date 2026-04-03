import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build the database URL for Supabase pooler (Supavisor).
 *
 * Supavisor (port 6543) does NOT support prepared statements.
 * Prisma uses prepared statements by default, which causes:
 *   Error 42P05: "prepared statement already exists"
 *
 * The pgbouncer=true flag tells Prisma to use the simple query
 * protocol instead, which avoids this error entirely.
 *
 * We also set connection_limit=1 for Vercel serverless to prevent
 * connection pool exhaustion on cold starts.
 */
function buildDatabaseUrl(url: string): string {
  // Only modify PostgreSQL URLs going through Supabase pooler
  if (!url.includes('supabase') && !url.includes('pooler')) {
    return url;
  }

  const params: string[] = [];

  if (!url.includes('pgbouncer=')) {
    params.push('pgbouncer=true');
  }
  if (!url.includes('connection_limit=')) {
    params.push('connection_limit=1');
  }
  if (!url.includes('pool_timeout=')) {
    params.push('pool_timeout=10');
  }
  if (!url.includes('sslmode=')) {
    params.push('sslmode=require');
  }

  if (params.length === 0) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.join('&')}`;
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

  // Build the URL with pooler-compatible parameters
  const databaseUrl = buildDatabaseUrl(rawDatabaseUrl);

  // CRITICAL: Pass the modified URL via datasources — do NOT rely on env var
  // because the env var does NOT have pgbouncer=true appended
  console.log(`[DB] Using database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
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
