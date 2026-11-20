import bcrypt from 'bcryptjs';
import { AppError } from '../core/errors';
import type { UserDto } from '../contracts/auth';
import type { Db } from './db';

export const SESSION_COOKIE = 'styra_session';
const SESSION_DAYS = 30;
const BCRYPT_COST = 11;
// Compared against when the email is unknown, so that costs the same time as a wrong password.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync(crypto.randomUUID(), BCRYPT_COST));

export interface SessionUser extends UserDto {
  sessionId: string;
  via: 'cookie' | 'bearer';
}

const toDto = (r: { id: string; email: string | null; phone: string | null; name: string; role: UserDto['role']; locale: string }): UserDto => ({
  id: r.id,
  email: r.email,
  phone: r.phone,
  name: r.name,
  role: r.role,
  locale: r.locale,
});

async function sha256(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(digest).toString('hex');
}

function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
export function clearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function registerUser(db: Db, input: { email: string; password: string; name: string; phone?: string }): Promise<UserDto> {
  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  try {
    const [u] = await db.query<Parameters<typeof toDto>[0]>(
      `insert into styra.users (email, phone, name, password_hash) values ($1, $2, $3, $4)
       returning id, email, phone, name, role, locale`,
      [input.email, input.phone ?? null, input.name, hash],
    );
    return toDto(u);
  } catch (e) {
    if (/users_email_key/.test(String((e as Error).message))) throw new AppError('EMAIL_TAKEN', 'an account with this email exists', 409);
    if (/users_phone_key/.test(String((e as Error).message))) throw new AppError('PHONE_TAKEN', 'an account with this phone exists', 409);
    throw e;
  }
}

export async function verifyLogin(db: Db, email: string, password: string): Promise<UserDto> {
  const [u] = await db.query<Parameters<typeof toDto>[0] & { password_hash: string | null; status: string }>(
    `select id, email, phone, name, role, locale, password_hash, status from styra.users where lower(email) = lower($1)`,
    [email],
  );
  const okPassword = await bcrypt.compare(password, u?.password_hash ?? getDummyHash());
  if (!u || !okPassword) throw new AppError('INVALID_CREDENTIALS', 'email or password is not right', 401);
  if (u.status !== 'ACTIVE') throw new AppError('ACCOUNT_SUSPENDED', 'this account is suspended', 403);
  return toDto(u);
}

export async function createSession(db: Db, userId: string, userAgent: string | null): Promise<string> {
  const token = newToken();
  await db.query(`insert into styra.sessions (user_id, token_hash, expires_at, user_agent) values ($1, $2, now() + make_interval(days => $3), $4)`, [
    userId,
    await sha256(token),
    SESSION_DAYS,
    userAgent?.slice(0, 300) ?? null,
  ]);
  return token;
}

function readToken(req: Request): { token: string; via: 'cookie' | 'bearer' } | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return { token: auth.slice(7).trim(), via: 'bearer' };
  const cookie = req.headers.get('cookie') ?? '';
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
  return m ? { token: decodeURIComponent(m[1]), via: 'cookie' } : null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Cookie-authenticated writes must come from our own origin (CSRF). Bearer requests carry no ambient credential. */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const allowed = new Set([new URL(req.url).origin, process.env.APP_URL].filter(Boolean) as string[]);
  if (!allowed.has(origin)) throw new AppError('FORBIDDEN_ORIGIN', 'request came from another site', 403);
}

export async function sessionFromRequest(db: Db, req: Request): Promise<SessionUser | null> {
  const t = readToken(req);
  if (!t) return null;
  const [r] = await db.query<Parameters<typeof toDto>[0] & { session_id: string }>(
    `select u.id, u.email, u.phone, u.name, u.role, u.locale, s.id as session_id
       from styra.sessions s join styra.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.status = 'ACTIVE'`,
    [await sha256(t.token)],
  );
  if (!r) return null;
  if (t.via === 'cookie' && MUTATING.has(req.method)) assertSameOrigin(req);
  return { ...toDto(r), sessionId: r.session_id, via: t.via };
}

export async function requireUser(db: Db, req: Request, roles?: UserDto['role'][]): Promise<SessionUser> {
  const u = await sessionFromRequest(db, req);
  if (!u) throw new AppError('UNAUTHENTICATED', 'sign in to continue', 401);
  if (roles && !roles.includes(u.role)) throw new AppError('FORBIDDEN', 'this account cannot do that', 403);
  return u;
}

export async function endSession(db: Db, sessionId: string): Promise<void> {
  await db.query('delete from styra.sessions where id = $1', [sessionId]);
}
