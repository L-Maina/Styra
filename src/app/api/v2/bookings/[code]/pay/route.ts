import { payInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { payForBooking } from '@/server/services/payments';

type Ctx = { params: Promise<{ code: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { code } = await params;
  const db = getDb();
  const user = await requireUser(db, req);
  const input = await readJson(req, payInput);
  return ok(await payForBooking(db, user, code, input, req.headers.get('idempotency-key'), new Date()));
});
