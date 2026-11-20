import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { listBusinessesForReview } from '@/server/services/admin';

export const GET = route(async (req) => {
  const db = getDb();
  await requireUser(db, req, ['ADMIN']);
  return ok({ items: await listBusinessesForReview(db) });
});
