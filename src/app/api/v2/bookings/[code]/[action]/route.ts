import type { ZodType } from 'zod';
import { cancelInput, disputeInput, reviewInput } from '@/contracts/booking';
import { AppError } from '@/core/errors';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { customerAction } from '@/server/services/bookings';

type Ctx = { params: Promise<{ code: string; action: string }> };
const schemas: Record<string, ZodType<{ reason?: string; details?: string; rating?: number; comment?: string }>> = {
  cancel: cancelInput,
  confirm: cancelInput,
  dispute: disputeInput,
  review: reviewInput,
};

export const POST = route<Ctx>(async (req, { params }) => {
  const { code, action } = await params;
  const schema = schemas[action];
  if (!schema) throw new AppError('NOT_FOUND', 'unknown action', 404);
  const db = getDb();
  const user = await requireUser(db, req);
  const body = await readJson(req, schema);
  return ok({ booking: await customerAction(db, user, code, action, body, new Date()) });
});
