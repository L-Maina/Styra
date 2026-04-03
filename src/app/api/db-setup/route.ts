import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
 * Just visit this endpoint once after deploying to Vercel.
 * It's idempotent — safe to run multiple times.
 */
export async function POST() {
  try {
    const { db } = await import('@/lib/db');

    // Test connection first
    await db.$queryRaw`SELECT 1 as ok`;

    // Split SQL into individual statements and execute them
    // Filter out empty lines and comments
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let created = 0;
    let errors: string[] = [];

    for (const stmt of statements) {
      try {
        await db.$executeRawUnsafe(stmt);
        created++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Ignore "already exists" errors (expected for idempotent runs)
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          created++;
          continue;
        }
        errors.push(msg.substring(0, 200));
      }
    }

    // Verify by counting tables
    const tables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

    return NextResponse.json({
      success: true,
      message: `Database setup complete! ${created} statements executed, ${tables.length} tables exist.`,
      details: {
        statementsExecuted: created,
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
        hint: errorMessage.includes('DATABASE_URL')
          ? 'Set DATABASE_URL in Vercel Dashboard → Settings → Environment Variables. Get it from Supabase → Settings → Database → Connection string.'
          : errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')
          ? 'Could not connect to the database. Check your DATABASE_URL — it should be the Supabase PostgreSQL connection string.'
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

    const existingNames = tables.map(t => t.tablename);
    const missingTables = expectedTables.filter(t => !existingNames.includes(t));
    const extraTables = existingNames.filter(t => !expectedTables.includes(t));

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
      instructions: needsSetup
        ? `POST to /api/db-setup to create ${missingTables.length} missing tables.`
        : 'Database is fully set up!',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: errorMessage,
        hint: errorMessage.includes('DATABASE_URL')
          ? 'DATABASE_URL not set. Add it in Vercel Dashboard → Settings → Environment Variables.'
          : errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')
          ? 'Cannot reach the database. Check your DATABASE_URL connection string.'
          : 'Check Vercel function logs.',
      },
      { status: 503 }
    );
  }
}
