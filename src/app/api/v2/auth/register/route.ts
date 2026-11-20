import { registerInput } from '@/contracts/auth';
import { createSession, registerUser, sessionCookie } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';

export const POST = route(async (req) => {
  const input = await readJson(req, registerInput);
  const db = getDb();
  const user = await registerUser(db, input);
  const token = await createSession(db, user.id, req.headers.get('user-agent'));
  return ok({ user, token }, 201, { 'set-cookie': sessionCookie(token) });
});
