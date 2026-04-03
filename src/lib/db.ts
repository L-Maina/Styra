import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a PrismaClient optimized for Supabase + Vercel serverless.
 *
 * REQUIRED ENV VARS (set in Vercel Dashboard → Settings → Environment Variables):
 *
 *   DATABASE_URL = Supabase Connection Pooling URL (Session mode)
 *     Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *     Get it from: Supabase → Settings → Database → Connection string → Connection Pooling → Session mode
 *
 *   DIRECT_URL = Supabase Direct connection URL (for migrations only)
 *     Format: postgresql://postgres:[password]@aws-0-[region].supabase.co:5432/postgres
 *     Get it from: Supabase → Settings → Database → Connection string → URI
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
      '[FATAL] DATABASE_URL is not set.\n\n' +
      'Fix: Go to Vercel Dashboard → Settings → Environment Variables → Add DATABASE_URL.\n' +
      'Value: Supabase Connection Pooling URL (Session mode) from Supabase → Settings → Database → Connection string.'
    );
  }

  // Validate the connection URL format (helpful for debugging)
  if (process.env.NODE_ENV === 'production') {
    try {
      const url = new URL(databaseUrl);
      const host = url.hostname;

      if (!host.includes('supabase')) {
        console.warn(
          `[DB Warning] DATABASE_URL host "${host}" doesn't look like a Supabase URL. ` +
          'Make sure you\'re using the Supabase Connection Pooling URL (port 6543).'
        );
      }

      // Check if user is using direct connection (port 5432) against pooler
      if (host.includes('pooler.supabase.com') && url.port === '5432') {
        console.error(
          `[DB Error] Using port 5432 with pooler.supabase.com — this causes "Tenant or user not found". ` +
          'Change the port to 6543, or use the Session mode connection string from Supabase.'
        );
      }

      // Check if user is using pooled URL format but wrong port
      if (host.includes('pooler.supabase.com') && !url.port) {
        console.warn(
          '[DB Warning] No port specified for pooler URL. Should be port 6543 for Supabase pooler.'
        );
      }
    } catch {
      console.error(`[DB Error] DATABASE_URL is not a valid URL: "${databaseUrl.substring(0, 30)}..."`);
    }
  }

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
