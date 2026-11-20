import { AppError } from '../../core/errors';
import type { Db } from '../db';

/**
 * Stores a provider event once (unique per provider and event id), then applies it. Replays return
 * { duplicate: true } and change nothing. Errors are written to the event for an admin to see.
 */
export async function handleOnce(
  db: Db,
  provider: string,
  eventId: string,
  payload: unknown,
  apply: () => Promise<void>,
): Promise<{ duplicate: boolean; parked?: string }> {
  const [row] = await db.query<{ id: string }>(
    `insert into styra.webhook_events (provider, event_id, payload) values ($1, $2, $3)
     on conflict (provider, event_id) do nothing returning id`,
    [provider, eventId, JSON.stringify(payload)],
  );
  if (!row) return { duplicate: true };
  try {
    await apply();
    await db.query('update styra.webhook_events set processed_at = now() where id = $1', [row.id]);
    return { duplicate: false };
  } catch (e) {
    const parked = e instanceof AppError ? `${e.code}: ${e.message}` : String((e as Error).message ?? e);
    await db.query('update styra.webhook_events set error = $2 where id = $1', [row.id, parked.slice(0, 1000)]);
    // Known business outcomes (amount mismatch, booking already moved) are parked for an admin; a crash is retried.
    if (e instanceof AppError) return { duplicate: false, parked };
    throw e;
  }
}
