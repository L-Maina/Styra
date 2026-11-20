import { resolveDisputeInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { adminResolveDispute } from '@/server/services/money';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const db = getDb();
  const admin = await requireUser(db, req, ['ADMIN']);
  return ok({ booking: await adminResolveDispute(db, admin, id, await readJson(req, resolveDisputeInput), new Date()) });
});
