import { refundPaidInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { adminRefundPaid } from '@/server/services/money';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const db = getDb();
  await requireUser(db, req, ['ADMIN']);
  const { providerRef } = await readJson(req, refundPaidInput);
  await adminRefundPaid(db, id, providerRef, new Date());
  return ok({ refunded: true });
});
