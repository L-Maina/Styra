import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Read the SQL schema at build time
const schemaSql = readFileSync(
  join(process.cwd(), 'prisma', 'schema.sql'),
  'utf-8'
);

/**
 * POST /api/db-setup
 *
 * Creates all 48 database tables if they don't exist.
 *
 * Uses DATABASE_URL (Supabase pooler, port 6543) — Supavisor in Session mode
 * supports DDL (CREATE TABLE) operations. Falls back to DIRECT_URL if needed.
 *
 * Just visit this endpoint once after deploying to Vercel.
 * It's idempotent — safe to run multiple times.
 */
export async function POST() {
  let client: InstanceType<typeof import('@prisma/client').PrismaClient> | null = null;
  let usedUrl = '';

  try {
    const { PrismaClient } = await import('@prisma/client');

    // Try DATABASE_URL first (pooler), then DIRECT_URL (direct)
    const urls = [
      process.env.DATABASE_URL,
      process.env.DIRECT_URL,
    ].filter(Boolean);

    if (urls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No database URL configured.',
          fix: 'Set DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.\n' +
               'Get it from Supabase → Settings → Database → Connection string → Connection Pooling → Session mode (port 6543).',
        },
        { status: 400 }
      );
    }

    // Find a working connection
    const attemptResults: { label: string; maskedUrl: string; error: string }[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const label = i === 0 ? 'DATABASE_URL' : 'DIRECT_URL';
      const maskedUrl = url
        .replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@')
        .substring(0, 100);

      try {
        console.log(`[db-setup] Trying ${label}: ${maskedUrl}`);

        client = new PrismaClient({
          datasources: { db: { url } },
          log: ['error'],
        });

        await client.$queryRaw`SELECT 1 as ok`;
        usedUrl = label;
        console.log(`[db-setup] Connected via ${label}`);
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[db-setup] ${label} failed: ${errMsg}`);
        attemptResults.push({ label, maskedUrl, error: errMsg.substring(0, 300) });
        if (client) {
          try { await client.$disconnect(); } catch { /* ignore */ }
          client = null;
        }
      }
    }

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot connect to database with any URL.',
          attempts: attemptResults,
          envCheck: {
            hasDatabaseUrl: !!process.env.DATABASE_URL,
            hasDirectUrl: !!process.env.DIRECT_URL,
            databaseUrlPrefix: process.env.DATABASE_URL?.replace(/:\/\/[^:]+:[^@]+@/, '://$1:***@').substring(0, 100) || 'NOT SET',
            directUrlPrefix: process.env.DIRECT_URL?.replace(/:\/\/[^:]+:[^@]+@/, '://$1:***@').substring(0, 100) || 'NOT SET',
          },
          fix: 'Visit /api/health for detailed diagnostics on your connection strings.',
        },
        { status: 503 }
      );
    }

    // Split SQL into individual statements and execute them
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let created = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (const stmt of statements) {
      try {
        await client.$executeRawUnsafe(stmt);
        created++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Ignore "already exists" errors (expected for idempotent runs)
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          skipped++;
          continue;
        }
        errors.push(`[${stmt.substring(0, 50).replace(/\n/g, ' ')}...] ${msg.substring(0, 150)}`);
      }
    }

    // Verify by counting tables
    const tables = await client.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

    await client.$disconnect();

    return NextResponse.json({
      success: true,
      message: `Database setup complete! ${created} created, ${skipped} already existed. ${tables.length} tables total.`,
      connectedVia: usedUrl,
      details: {
        statementsCreated: created,
        statementsSkipped: skipped,
        totalStatements: statements.length,
        errors: errors.length > 0 ? errors : undefined,
        tablesCreated: tables.map(t => t.tablename),
        tableCount: tables.length,
      },
    });
  } catch (error) {
    if (client) {
      try { await client.$disconnect(); } catch { /* ignore */ }
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Database setup failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/db-setup
 * Returns info about the database state (table count, missing tables)
 */
export async function GET() {
  try {
    const { db } = await import('@/lib/db');

    // Test connection
    const start = Date.now();
    await db.$queryRaw`SELECT 1 as ok`;
    const latency = Date.now() - start;

    // Get existing tables
    const tables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

    // Expected tables
    const expectedTables = [
      'User', 'Business', 'Service', 'Staff', 'PortfolioItem',
      'Booking', 'Review', 'Favorite', 'Payment', 'Payout',
      'Escrow', 'PlatformTransaction', 'TransactionLog', 'Category',
      'DiscountCode', 'Promotion', 'Advertisement', 'PremiumListing',
      'Conversation', 'ChatMessage', 'Message', 'Notification',
      'NotificationPreference', 'PushSubscription', 'Wallet',
      'OTPVerification', 'PasswordReset', 'EmailVerificationToken',
      'UserBan', 'BlockedUser', 'Dispute', 'InsuranceClaim',
      'AuditLog', 'SecurityAuditLog', 'SecurityAlert', 'MonitoringError',
      'AdminReport', 'SupportTicket', 'TicketReply', 'FormSubmission',
      'WebhookEvent', 'AnalyticsEvent', 'RateLimit', 'Media',
      'TimeSlot', 'PageContent', 'BlogArticle', 'PlatformSetting',
    ];

    const existingNames = new Set(tables.map(t => t.tablename));
    const missingTables = expectedTables.filter(t => !existingNames.has(t));

    // Count records in key tables
    let businessCount = 0;
    let userCount = 0;
    try {
      const [bc, uc] = await Promise.all([
        db.business.count(),
        db.user.count(),
      ]);
      businessCount = bc;
      userCount = uc;
    } catch {
      // Tables might not exist yet
    }

    const needsSetup = missingTables.length > 0;

    return NextResponse.json({
      success: true,
      connected: true,
      latencyMs: latency,
      tableCount: tables.length,
      expectedTableCount: expectedTables.length,
      needsSetup,
      missingTables: missingTables.length > 0 ? missingTables : undefined,
      recordCounts: { users: userCount, businesses: businessCount },
      instructions: needsSetup
        ? `${missingTables.length} tables missing. Run: POST /api/db-setup to create them.`
        : 'Database is fully set up!',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: errorMessage,
      },
      { status: 503 }
    );
  }
}
