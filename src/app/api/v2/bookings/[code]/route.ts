import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { getBooking } from '@/server/services/bookings';

type Ctx = { params: Promise<{ code: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { code } = await params;
  const db = getDb();
  const user = await requireUser(db, req);
  return ok({ booking: await getBooking(db, user, code) });
});
