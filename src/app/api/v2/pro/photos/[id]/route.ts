import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { deletePhoto } from '@/server/services/photos';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  await deletePhoto(db, user, id);
  return ok({ deleted: true });
});
