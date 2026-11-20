import { availabilityInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { setAvailability } from '@/server/services/pro';

const put = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  return ok(await setAvailability(db, user, await readJson(req, availabilityInput)));
});
export const PUT = put;
export const POST = put;
