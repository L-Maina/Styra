import 'server-only';
import { cookies, headers } from 'next/headers';
import { sessionFromRequest, SESSION_COOKIE, type SessionUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';

/** The signed-in user for a server component, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const h = await headers();
  const req = new Request('http://local/rsc', { headers: { cookie: `${SESSION_COOKIE}=${token}`, 'user-agent': h.get('user-agent') ?? '' } });
  try {
    return await sessionFromRequest(getDb(), req);
  } catch {
    return null;
  }
}
