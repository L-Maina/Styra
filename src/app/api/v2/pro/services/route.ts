import { serviceInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { addService } from '@/server/services/pro';

export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  return ok({ service: await addService(db, user, await readJson(req, serviceInput)) }, 201);
});
