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
 * This is the easiest way to set up the Supabase database for Styra.
 *
 * IMPORTANT: This endpoint uses DIRECT_URL (not DATABASE_URL) for DDL operations,
 * because Supabase's connection pooler (Supavisor) does NOT support CREATE TABLE.
 * DIRECT_URL must be set as a Vercel environment variable pointing to the direct
 * connection (port 5432, host db.[project].supabase.co).
 *
 * Just visit this endpoint once after deploying to Vercel.
 * It's idempotent — safe to run multiple times.
 */
export async function POST() {
  try {
    const { PrismaClient } = await import('@prisma/client');

    // For DDL operations (CREATE TABLE), we need a direct connection,
    // NOT the Supabase pooler (which only supports query operations).
    const directUrl = process.env.DIRECT_URL;

    if (!directUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'DIRECT_URL not set. Required for database table creation.',
          fix: 'Set DIRECT_URL in Vercel Dashboard → Settings → Environment Variables.\n' +
               'Value: Supabase Direct connection URL (port 5432) from Supabase → Settings → Database → Connection string → URI tab.',
        },
        { status: 400 }
      );
    }

    // Create a separate Prisma client using DIRECT_URL for DDL
    const ddlClient = new PrismaClient({
      datasources: {
        db: {
          url: directUrl,
        },
      },
      log: ['error'],
    });

    try {
      // Test direct connection
      await ddlClient.$queryRaw`SELECT 1 as ok`;
    } catch (connError) {
      const connMsg = connError instanceof Error ? connError.message : 'Unknown connection error';
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot connect to database using DIRECT_URL.',
          details: connMsg,
          fix: connMsg.includes('Tenant or user not found')
            ? 'DIRECT_URL should be the direct connection string (host: db.[project].supabase.co, port: 5432, user: postgres). NOT the pooler URL.'
            : connMsg.includes('authentication failed')
            ? 'Wrong password in DIRECT_URL. Get the correct string from Supabase Dashboard.'
            : 'Check DIRECT_URL format in Vercel environment variables.',
        },
        { status: 503 }
      );
    }

    // Split SQL into individual statements and execute them
    // Filter out empty lines and comments
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let created = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (const stmt of statements) {
      try {
        await ddlClient.$executeRawUnsafe(stmt);
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
    const tables = await ddlClient.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

    await ddlClient.$disconnect();

    return NextResponse.json({
      success: true,
      message: `Database setup complete! ${created} created, ${skipped} already existed. ${tables.length} tables total.`,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Database setup failed',
        details: errorMessage,
        hint: errorMessage.includes('DIRECT_URL')
          ? 'Set DIRECT_URL in Vercel Dashboard → Settings → Environment Variables. Get it from Supabase → Settings → Database → Connection string → URI tab.'
          : 'Check Vercel function logs for more details.',
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
    const extraTables = tables.map(t => t.tablename).filter(t => !expectedTables.includes(t));

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
      extraTables: extraTables.length > 0 ? extraTables : undefined,
      recordCounts: { users: userCount, businesses: businessCount },
      hasDirectUrl: !!process.env.DIRECT_URL,
      instructions: needsSetup
        ? `${missingTables.length} tables missing. Run: POST /api/db-setup to create them. (Requires DIRECT_URL env var)`
        : 'Database is fully set up!',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: errorMessage,
        hint: errorMessage.includes('Tenant or user not found')
          ? 'DATABASE_URL has wrong credentials. Use the Session mode pooler URL from Supabase Dashboard (port 6543).'
          : errorMessage.includes('relation') || errorMessage.includes('does not exist')
          ? 'Tables not created yet. POST /api/db-setup to create them.'
          : 'Check Vercel function logs.',
      },
      { status: 503 }
    );
  }
}
