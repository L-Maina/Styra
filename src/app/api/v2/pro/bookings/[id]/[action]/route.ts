import { cancelInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { providerAction } from '@/server/services/bookings';

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id, action } = await params;
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  const body = await readJson(req, cancelInput);
  return ok({ booking: await providerAction(db, user, id, action, body, new Date()) });
});
