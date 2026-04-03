// Styra RLS Migration API Route
// ==================================
// Admin-only endpoint to apply Row Level Security policies
// to the Supabase PostgreSQL database.
//
// Uses the pg driver directly (not Prisma) because:
// 1. Prisma cannot execute DDL (ALTER TABLE, CREATE POLICY)
// 2. Pgbouncer blocks prepared statements needed by Prisma
// 3. Direct pg connection is required for RLS DDL operations

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await requireAdmin();

    // Get connection string from environment
    // DIRECT_URL is preferred for DDL operations (bypasses pooler)
    const connectionString =
      process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      );
    }

    // Read the RLS SQL script
    const sqlPath = join(process.cwd(), 'supabase', 'rls-policies.sql');
    let sql: string;
    try {
      sql = readFileSync(sqlPath, 'utf-8');
    } catch {
      return NextResponse.json(
        { error: 'RLS SQL script not found', path: sqlPath },
        { status: 500 }
      );
    }

    // Connect using pg driver (not Prisma)
    const client = new pg.Client({
      connectionString,
      statement_timeout: 120000, // 2 minutes for DDL
      connectionTimeoutMillis: 15000,
    });

    try {
      await client.connect();

      // Verify connection
      const version = await client.query('SELECT version()');
      const pgVersion = version.rows[0].version.split(',')[0];

      // Apply RLS policies
      const startTime = Date.now();
      await client.query(sql);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // Get summary
      const policies = await client.query(
        `SELECT tablename, COUNT(*) as policy_count
         FROM pg_policies
         WHERE schemaname = 'public'
         GROUP BY tablename
         ORDER BY tablename`
      );

      const totalPolicies = policies.rows.reduce(
        (sum, r) => sum + parseInt(r.policy_count),
        0
      );

      // Check RLS status on all tables
      const rlsStatus = await client.query(
        `SELECT
           c.relname as table_name,
           c.relrowsecurity as rls_enabled,
           (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') as policy_count
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
         ORDER BY c.relname`
      );

      return NextResponse.json({
        success: true,
        message: 'RLS policies applied successfully',
        appliedBy: session.email,
        timestamp: new Date().toISOString(),
        duration: `${elapsed}s`,
        postgresVersion: pgVersion,
        summary: {
          totalTables: rlsStatus.rows.length,
          rlsEnabled: rlsStatus.rows.filter(r => r.rls_enabled).length,
          tablesWithPolicies: rlsStatus.rows.filter(
            r => parseInt(r.policy_count) > 0
          ).length,
          totalPolicies,
        },
        tables: rlsStatus.rows.map((r) => ({
          table: r.table_name,
          rlsEnabled: r.rls_enabled,
          policyCount: parseInt(r.policy_count),
        })),
      });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    const err = error as Error & { code?: string; hint?: string };

    // Don't leak internal details
    if (err.code === 'ECONNREFUSED' || err.code === 'XX000') {
      return NextResponse.json(
        {
          error: 'Database connection failed',
          hint: 'Check DIRECT_URL and DATABASE_URL in .env',
        },
        { status: 503 }
      );
    }

    console.error('[RLS Migration Error]', err);
    return NextResponse.json(
      { error: 'Failed to apply RLS policies' },
      { status: 500 }
    );
  }
}

// GET: Check current RLS status without making changes
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const connectionString =
      process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      );
    }

    const client = new pg.Client({
      connectionString,
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();

      // Get RLS status
      const rlsStatus = await client.query(
        `SELECT
           c.relname as table_name,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced,
           (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') as policy_count
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
         ORDER BY c.relname`
      );

      // Get all policies
      const allPolicies = await client.query(
        `SELECT tablename, policyname, cmd, qual, with_check, roles
         FROM pg_policies
         WHERE schemaname = 'public'
         ORDER BY tablename, policyname`
      );

      const totalPolicies = allPolicies.rows.length;
      const rlsEnabled = rlsStatus.rows.filter(r => r.rls_enabled).length;
      const tablesWithPolicies = rlsStatus.rows.filter(
        r => parseInt(r.policy_count) > 0
      ).length;

      return NextResponse.json({
        success: true,
        checkedBy: session.email,
        timestamp: new Date().toISOString(),
        summary: {
          totalTables: rlsStatus.rows.length,
          rlsEnabled,
          rlsForced: rlsStatus.rows.filter(r => r.relforcerowsecurity).length,
          tablesWithPolicies,
          totalPolicies,
        },
        tables: rlsStatus.rows.map((r) => ({
          table: r.table_name,
          rlsEnabled: r.rls_enabled,
          rlsForced: r.relforcerowsecurity,
          policyCount: parseInt(r.policy_count),
          status:
            r.rls_enabled && parseInt(r.policy_count) > 0
              ? 'SECURED'
              : r.rls_enabled
                ? 'NO_POLICIES'
                : 'RLS_DISABLED',
        })),
        policies: allPolicies.rows.map((p) => ({
          table: p.tablename,
          name: p.policyname,
          operation: p.cmd,
          roles: p.roles,
        })),
      });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error('[RLS Status Check Error]', err);
    return NextResponse.json(
      { error: 'Failed to check RLS status' },
      { status: 500 }
    );
  }
}
