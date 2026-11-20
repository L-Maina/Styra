import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';

export const GET = route(async (req) => {
  const { sessionId: _s, via: _v, ...user } = await requireUser(getDb(), req);
  return ok({ user });
});
