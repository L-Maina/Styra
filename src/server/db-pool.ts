import { Pool } from 'pg';
import { pgDb, type Db } from './db';

let pool: Pool | null = null;
let db: Db | null = null;

/** Strips Prisma-only parameters (pgbouncer, connection_limit) that `pg` does not understand. */
function connectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  for (const p of ['pgbouncer', 'connection_limit', 'schema']) url.searchParams.delete(p);
  return url.toString();
}

/** The server's one database handle. Created on first use. */
export function getDb(): Db {
  if (!db) {
    pool = new Pool({ connectionString: connectionString(), max: Number(process.env.STYRA_DB_POOL_MAX ?? 5) });
    db = pgDb(pool);
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}
