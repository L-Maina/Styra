import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { earnings } from '@/server/services/money';

export const GET = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  return ok(await earnings(db, user));
});
