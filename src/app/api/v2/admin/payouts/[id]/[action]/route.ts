import { payoutActionInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { adminPayoutAction } from '@/server/services/money';

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id, action } = await params;
  const db = getDb();
  await requireUser(db, req, ['ADMIN']);
  return ok({ payout: await adminPayoutAction(db, id, action, await readJson(req, payoutActionInput), new Date()) });
});
