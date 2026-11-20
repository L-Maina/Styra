import { createBusinessInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { createBusiness, getOwnBusiness } from '@/server/services/pro';

export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req);
  return ok({ business: await createBusiness(db, user, await readJson(req, createBusinessInput)) }, 201);
});

export const GET = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER', 'ADMIN']);
  return ok({ business: await getOwnBusiness(db, user) });
});
