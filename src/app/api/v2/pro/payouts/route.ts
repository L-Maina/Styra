import { payoutInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { requestPayout } from '@/server/services/money';

export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  const input = await readJson(req, payoutInput);
  return ok({ payout: await requestPayout(db, user, input, req.headers.get('idempotency-key'), new Date()) }, 201);
});
