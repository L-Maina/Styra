import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dbReachable, freshDb, type TestDb } from '../db/harness';

const reachable = await dbReachable();

/** Calls a route handler the way Next.js does. */
async function call(handler: (req: Request, ctx?: unknown) => Promise<Response>, init: { method?: string; body?: unknown; headers?: Record<string, string>; url?: string } = {}, ctx?: unknown) {
  const req = new Request(init.url ?? 'http://localhost:3000/api/v2/test', {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const res = await handler(req, ctx);
  return { res, json: (await res.json()) as any };
}

describe.skipIf(!reachable)('auth API (real Postgres)', () => {
  let db: TestDb;
  let routes: Record<string, any>;
  beforeAll(async () => {
    db = await freshDb();
    process.env.DATABASE_URL = db.url;
    routes = {
      register: await import('../../src/app/api/v2/auth/register/route'),
      login: await import('../../src/app/api/v2/auth/login/route'),
      logout: await import('../../src/app/api/v2/auth/logout/route'),
      me: await import('../../src/app/api/v2/me/route'),
    };
  });
  afterAll(async () => {
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  });

  const creds = { email: 'Amina@Example.test', password: 'correct horse 42', name: 'Amina Wanjiru' };

  test('register creates a customer and a session cookie', async () => {
    const { res, json } = await call(routes.register.POST, { method: 'POST', body: creds });
    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.data.user).toMatchObject({ email: 'amina@example.test', name: 'Amina Wanjiru', role: 'CUSTOMER' });
    expect(json.data.user.passwordHash).toBeUndefined();
    expect(typeof json.data.token).toBe('string');
    expect(res.headers.get('set-cookie')).toMatch(/styra_session=.+; Path=\/; .*HttpOnly/i);
  });

  test('registering the same email again answers EMAIL_TAKEN', async () => {
    const { res, json } = await call(routes.register.POST, { method: 'POST', body: { ...creds, email: 'amina@example.test' } });
    expect(res.status).toBe(409);
    expect(json).toEqual({ ok: false, error: { code: 'EMAIL_TAKEN', message: expect.any(String) } });
  });

  test('invalid input answers VALIDATION with the field', async () => {
    const { res, json } = await call(routes.register.POST, { method: 'POST', body: { email: 'nope', password: 'short', name: '' } });
    expect(res.status).toBe(422);
    expect(json.error.code).toBe('VALIDATION');
    expect(json.error.fields).toHaveProperty('email');
    expect(json.error.fields).toHaveProperty('password');
  });

  test('login with the wrong password answers INVALID_CREDENTIALS, same as an unknown email', async () => {
    const a = await call(routes.login.POST, { method: 'POST', body: { email: creds.email, password: 'wrong password' } });
    const b = await call(routes.login.POST, { method: 'POST', body: { email: 'nobody@example.test', password: 'wrong password' } });
    expect(a.res.status).toBe(401);
    expect(a.json.error.code).toBe('INVALID_CREDENTIALS');
    expect(b.json.error).toEqual(a.json.error);
  });

  test('login, then /me with the bearer token (mobile) and with the cookie (web)', async () => {
    const { json } = await call(routes.login.POST, { method: 'POST', body: { email: creds.email, password: creds.password } });
    const token = json.data.token as string;
    const bearer = await call(routes.me.GET, { headers: { authorization: `Bearer ${token}` } });
    expect(bearer.json.data.user.email).toBe('amina@example.test');
    const cookie = await call(routes.me.GET, { headers: { cookie: `styra_session=${token}` } });
    expect(cookie.json.data.user.email).toBe('amina@example.test');
  });

  test('the database stores only a hash of the session token', async () => {
    const { json } = await call(routes.login.POST, { method: 'POST', body: { email: creds.email, password: creds.password } });
    const rows = await db.sql`select token_hash from styra.sessions`;
    expect(rows.some((r: { token_hash: string }) => r.token_hash === json.data.token)).toBe(false);
  });

  test('/me without a session answers UNAUTHENTICATED', async () => {
    const { res, json } = await call(routes.me.GET);
    expect(res.status).toBe(401);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  test('logout ends the session', async () => {
    const { json } = await call(routes.login.POST, { method: 'POST', body: { email: creds.email, password: creds.password } });
    const auth = { authorization: `Bearer ${json.data.token}` };
    const out = await call(routes.logout.POST, { method: 'POST', headers: auth });
    expect(out.res.status).toBe(200);
    expect(out.res.headers.get('set-cookie')).toMatch(/styra_session=;.*Max-Age=0/i);
    const me = await call(routes.me.GET, { headers: auth });
    expect(me.res.status).toBe(401);
  });

  test('a cookie-authenticated write from another origin is refused', async () => {
    const { json } = await call(routes.login.POST, { method: 'POST', body: { email: creds.email, password: creds.password } });
    const out = await call(routes.logout.POST, { method: 'POST', headers: { cookie: `styra_session=${json.data.token}`, origin: 'https://evil.example' } });
    expect(out.res.status).toBe(403);
    expect(out.json.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  test('a session past its expiry no longer authenticates', async () => {
    const { json } = await call(routes.login.POST, { method: 'POST', body: { email: creds.email, password: creds.password } });
    await db.sql`update styra.sessions set expires_at = now() - interval '1 minute'`;
    const me = await call(routes.me.GET, { headers: { authorization: `Bearer ${json.data.token}` } });
    expect(me.res.status).toBe(401);
  });
});
