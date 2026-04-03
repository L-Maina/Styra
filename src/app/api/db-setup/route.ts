import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

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
 * Uses pg directly (not Prisma) because Supabase's pooler doesn't support
 * prepared statements well for DDL operations.
 *
 * Idempotent — safe to run multiple times.
 */
export async function POST() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'DATABASE_URL not set.',
        fix: 'Set it in Vercel Dashboard → Settings → Environment Variables.',
      },
      { status: 400 }
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  let client;

  try {
    client = await pool.connect();

    // Test connection
    const test = await client.query('SELECT 1 as ok, current_database() as db');
    const dbName = test.rows[0].db;

    // Split SQL on semicolons — don't filter by comment prefix (CREATE TABLE
    // statements have -- comments before them which would be filtered out)
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        created++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          skipped++;
        } else {
          const firstLine = stmt.split('\n').find(l => l.trim().length > 0 && !l.trim().startsWith('--'));
          errors.push(`${(firstLine || stmt).substring(0, 50)} → ${msg.substring(0, 100)}`);
        }
      }
    }

    // Verify table count
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );

    return NextResponse.json({
      success: true,
      message: `Database setup complete! ${created} statements executed, ${skipped} already existed. ${tables.rows.length} tables in "${dbName}".`,
      details: {
        database: dbName,
        statementsExecuted: created,
        statementsSkipped: skipped,
        totalStatements: statements.length,
        errors: errors.length > 0 ? errors : undefined,
        tables: tables.rows.map((r: { tablename: string }) => r.tablename),
        tableCount: tables.rows.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Database setup failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

/**
 * GET /api/db-setup
 * Returns info about the database state (table count, missing tables)
 */
export async function GET() {
  try {
    const { db } = await import('@/lib/db');

    const start = Date.now();
    await db.$queryRaw`SELECT 1 as ok`;
    const latency = Date.now() - start;

    const tables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

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

    let businessCount = 0;
    let userCount = 0;
    try {
      const [bc, uc] = await Promise.all([
        db.business.count(),
        db.user.count(),
      ]);
      businessCount = bc;
      userCount = uc;
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      connected: true,
      latencyMs: latency,
      tableCount: tables.length,
      expectedTableCount: expectedTables.length,
      needsSetup: missingTables.length > 0,
      missingTables: missingTables.length > 0 ? missingTables : undefined,
      recordCounts: { users: userCount, businesses: businessCount },
      instructions: missingTables.length > 0
        ? `${missingTables.length} tables missing. Run: POST /api/db-setup to create them.`
        : 'Database is fully set up!',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, connected: false, error: errorMessage },
      { status: 503 }
    );
  }
}
