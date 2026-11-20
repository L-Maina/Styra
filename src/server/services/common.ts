import { AppError } from '../../core/errors';
import type { Db } from '../db';
import type { SessionUser } from '../auth';

export async function ownedBusiness(db: Db, user: SessionUser): Promise<{ id: string; slug: string; status: string }> {
  const [b] = await db.query<{ id: string; slug: string; status: string }>('select id, slug, status from styra.businesses where owner_id = $1 order by created_at limit 1', [user.id]);
  if (!b) throw new AppError('NO_BUSINESS', 'create your business first', 404);
  return b;
}

export const n = (v: unknown) => Number(v);
export const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
