import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { approveBusiness } from '@/server/services/admin';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const db = getDb();
  const admin = await requireUser(db, req, ['ADMIN']);
  return ok({ business: await approveBusiness(db, admin, id) });
});
