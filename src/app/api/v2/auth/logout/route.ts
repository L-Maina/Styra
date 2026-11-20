import { clearedSessionCookie, endSession, requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';

export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req);
  await endSession(db, user.sessionId);
  return ok({ signedOut: true }, 200, { 'set-cookie': clearedSessionCookie() });
});
