import type { Pool, PoolClient } from 'pg';

export type Row = Record<string, unknown>;

export interface Tx {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Tx {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Bigints travel as strings so every driver accepts them. */
export const param = (v: unknown) => (typeof v === 'bigint' ? v.toString() : v);
export const toBig = (v: unknown): bigint => BigInt(v as string | number | bigint);

/** SQLSTATE of a driver error (pg uses `code`, Bun.SQL uses `errno`). */
export function sqlState(e: unknown): string | undefined {
  const err = e as { code?: unknown; errno?: unknown };
  for (const v of [err?.errno, err?.code]) if (typeof v === 'string' && /^[0-9A-Z]{5}$/.test(v)) return v;
  return undefined;
}

export function pgDb(pool: Pool): Db {
  const wrap = (c: Pool | PoolClient): Tx => ({
    async query<T>(text: string, params: unknown[] = []) {
      const r = await c.query(text, params.map(param));
      return r.rows as T[];
    },
  });
  return {
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn(wrap(client));
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
