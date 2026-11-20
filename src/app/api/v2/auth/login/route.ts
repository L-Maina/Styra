import { loginInput } from '@/contracts/auth';
import { createSession, sessionCookie, verifyLogin } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';

export const POST = route(async (req) => {
  const input = await readJson(req, loginInput);
  const db = getDb();
  const user = await verifyLogin(db, input.email, input.password);
  const token = await createSession(db, user.id, req.headers.get('user-agent'));
  return ok({ user, token }, 200, { 'set-cookie': sessionCookie(token) });
});
