import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SQL } from 'bun';

/** Server where the tests may create and drop databases. Tests skip when it is unreachable. */
export const ADMIN_URL = process.env.STYRA_TEST_DATABASE_URL ?? 'postgres://localhost:5432/postgres';
const MIGRATIONS = join(import.meta.dir, '../../supabase/migrations');

export async function dbReachable(): Promise<boolean> {
  try {
    const sql = new SQL(ADMIN_URL, { max: 1, connectionTimeout: 2 });
    await sql`select 1`;
    await sql.close();
    return true;
  } catch {
    return false;
  }
}

export function v2MigrationFiles(): string[] {
  return readdirSync(MIGRATIONS).filter((f) => /_styra_.*\.sql$/.test(f)).sort();
}

export interface TestDb {
  sql: SQL;
  url: string;
  drop(): Promise<void>;
}

/** A fresh database with every v2 migration applied (twice, to prove they are idempotent). */
export async function freshDb(): Promise<TestDb> {
  const name = `styra_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new SQL(ADMIN_URL, { max: 1 });
  await admin.unsafe(`create database ${name}`);
  const url = ADMIN_URL.replace(/\/[^/]*$/, `/${name}`);
  const sql = new SQL(url, { max: 4 });
  for (let pass = 0; pass < 2; pass++)
    for (const f of v2MigrationFiles()) await sql.unsafe(readFileSync(join(MIGRATIONS, f), 'utf8')).simple();
  return {
    sql,
    url,
    async drop() {
      await sql.close();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.close();
    },
  };
}

/** Small fixture builders that write straight to the tables (the engine is tested separately). */
export function fixtures(sql: SQL) {
  let n = 0;
  const uniq = () => `${Date.now().toString(36)}${(n++).toString(36)}`;
  return {
    async user(role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' = 'CUSTOMER') {
      const [u] = await sql`insert into styra.users (email, name, role, password_hash) values (${`u${uniq()}@example.test`}, 'Test', ${role}, 'x') returning id`;
      return u.id as string;
    },
    async business(ownerId: string) {
      const [b] = await sql`insert into styra.businesses (owner_id, slug, name, category, status) values (${ownerId}, ${`biz-${uniq()}`}, 'Kinyozi Pro', 'BARBER', 'ACTIVE') returning id`;
      const [s] = await sql`select id from styra.staff where business_id = ${b.id} limit 1`;
      return { id: b.id as string, staffId: s.id as string };
    },
    async service(businessId: string, priceMinor = 150000n) {
      const [s] = await sql`insert into styra.services (business_id, name, category, duration_min, price_minor) values (${businessId}, 'Classic cut', 'BARBER', 30, ${priceMinor}) returning id`;
      return s.id as string;
    },
    async booking(o: { customerId: string; businessId: string; staffId: string; serviceId: string; start: string; minutes?: number; price?: bigint; status?: string }) {
      const end = new Date(new Date(o.start).getTime() + (o.minutes ?? 30) * 60_000).toISOString();
      const [b] = await sql`insert into styra.bookings (code, customer_id, business_id, staff_id, service_id, start_at, end_at, price_minor, status, escrow_state, expires_at)
        values (${`STY-${uniq().toUpperCase()}`}, ${o.customerId}, ${o.businessId}, ${o.staffId}, ${o.serviceId}, ${o.start}, ${end}, ${o.price ?? 150000n}, ${o.status ?? 'PENDING'}, 'NONE', now() + interval '15 minutes') returning id`;
      return b.id as string;
    },
    async account(kind: string, businessId: string | null = null) {
      const [a] = await sql`insert into styra.ledger_accounts (kind, business_id) values (${kind}, ${businessId})
        on conflict (kind, business_id, currency) do update set kind = excluded.kind returning id`;
      return a.id as string;
    },
  };
}
