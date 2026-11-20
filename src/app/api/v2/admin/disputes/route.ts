import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { adminDisputes } from '@/server/services/money';

export const GET = route(async (req) => {
  const db = getDb();
  await requireUser(db, req, ['ADMIN']);
  return ok({ items: await adminDisputes(db) });
});
