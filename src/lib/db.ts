import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build a safe database URL with connection pooling parameters.
 *
 * - Adds pgbouncer=true for Supabase Supavisor (port 6543) compatibility
 * - Adds connection_limit=1 for Vercel serverless
 * - Adds sslmode=require for secure connections
 * - Adds pool_timeout for reasonable timeouts
 */
function buildDatabaseUrl(url: string): string {
  // SQLite paths — return as-is
  if (url.startsWith('file:')) {
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
 * Safely log the database URL, masking any passwords.
 */
function safeLogUrl(url: string): string {
  if (url.startsWith('file:')) {
    return url;
  }
  return url.replace(/:[^:@]+@/, ':****@');
}

/**
 * Create a PrismaClient for Supabase PostgreSQL.
 *
 * IMPORTANT for Vercel:
 *   Use the Supabase Connection Pooling URL (port 6543) as DATABASE_URL:
 *   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 *   The direct connection (port 5432) is NOT accessible from Vercel's network.
 */
function createPrismaClient() {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    if (process.env.NODE_ENV !== 'production') {
      return new PrismaClient({
        log: ['query', 'warn', 'error'],
      });
    }
    throw new Error(
      '[FATAL] DATABASE_URL is not set.\n\n' +
      'Fix: Go to Vercel Dashboard → Settings → Environment Variables → Add DATABASE_URL.\n' +
      'Value: Supabase Connection Pooling URL from Supabase → Settings → Database → Connection string.\n' +
      'Format: postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres'
    );
  }

  const databaseUrl = buildDatabaseUrl(rawDatabaseUrl);

  console.log(`[DB] Using database: ${safeLogUrl(databaseUrl)}`);

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
