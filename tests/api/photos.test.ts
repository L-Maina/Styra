import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dbReachable, freshDb, type TestDb } from '../db/harness';
import { call } from './client';

const reachable = await dbReachable();
// Smallest valid images: magic bytes plus padding.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0)]);

describe.skipIf(!reachable)('business photos (real Postgres, local storage)', () => {
  let db: TestDb;
  let dir: string;
  const r: Record<string, any> = {};
  const tk: Record<string, string> = {};

  async function upload(token: string | undefined, kind: string, bytes: Uint8Array, type = 'image/png', name = 'x.png') {
    const form = new FormData();
    form.set('kind', kind);
    form.set('caption', 'Fresh skin fade');
    form.set('file', new File([bytes], name, { type }));
    const req = new Request('http://localhost:3000/api/v2/pro/photos', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    const res = await r.photos.POST(req, { params: Promise.resolve({}) });
    return { status: res.status, json: (await res.json()) as any };
  }

  beforeAll(async () => {
    db = await freshDb();
    dir = mkdtempSync(join(tmpdir(), 'styra-photos-'));
    process.env.DATABASE_URL = db.url;
    process.env.STYRA_DEV_UPLOAD_DIR = dir;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const load = (p: string) => import(`../../src/app/api/v2/${p}/route`);
    Object.assign(r, {
      register: await load('auth/register'),
      proBusiness: await load('pro/business'),
      photos: await load('pro/photos'),
      photo: await load('pro/photos/[id]'),
      approve: await load('admin/businesses/[id]/approve'),
      business: await load('businesses/[slug]'),
      list: await load('businesses'),
    });
    for (const who of ['owner', 'other', 'admin']) tk[who] = (await call(r.register.POST, { body: { email: `${who}@p.test`, password: 'correct horse 42', name: who } })).data.token;
    await db.sql`update styra.users set role = 'ADMIN' where email = 'admin@p.test'`;
    const biz = (await call(r.proBusiness.POST, { token: tk.owner, body: { name: 'Glow Nails', category: 'NAILS', city: 'Nairobi' } })).data.business;
    await call(r.approve.POST, { token: tk.admin, body: {}, params: { id: biz.id } });
  }, 30_000);
  afterAll(async () => {
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  }, 30_000);

  test('the owner uploads a logo, a cover and gallery photos; the business page shows them', async () => {
    const logo = await upload(tk.owner, 'LOGO', PNG);
    expect(logo.status).toBe(201);
    expect(logo.json.data.photo.url).toMatch(/^\/dev-uploads\/.+\.png$/);
    expect(existsSync(join(dir, logo.json.data.photo.url.replace('/dev-uploads/', '')))).toBe(true);
    await upload(tk.owner, 'COVER', JPEG, 'image/jpeg', 'c.jpg');
    await upload(tk.owner, 'GALLERY', PNG);
    await upload(tk.owner, 'GALLERY', JPEG, 'image/jpeg', 'g.jpg');
    const page = (await call(r.business.GET, { params: { slug: 'glow-nails' } })).data.business;
    expect(page.logoUrl).toBe(logo.json.data.photo.url);
    expect(page.coverUrl).toMatch(/\.jpg$/);
    expect(page.gallery).toHaveLength(2);
    expect(page.gallery[0]).toMatchObject({ caption: 'Fresh skin fade' });
    const list = (await call(r.list.GET)).data.items[0];
    expect(list.coverUrl).toBe(page.coverUrl);
    expect(list.logoUrl).toBe(page.logoUrl);
  });

  test('a new logo replaces the old one', async () => {
    const second = await upload(tk.owner, 'LOGO', JPEG, 'image/jpeg', 'l2.jpg');
    expect(second.status).toBe(201);
    const page = (await call(r.business.GET, { params: { slug: 'glow-nails' } })).data.business;
    expect(page.logoUrl).toBe(second.json.data.photo.url);
    const [{ n }] = await db.sql`select count(*)::int as n from styra.business_photos where kind = 'LOGO'`;
    expect(n).toBe(1);
  });

  test('files that are not images are refused, whatever they claim to be', async () => {
    const fake = await upload(tk.owner, 'GALLERY', new TextEncoder().encode('<script>alert(1)</script>'), 'image/png', 'evil.png');
    expect(fake.status).toBe(422);
    expect(fake.json.error.code).toBe('FILE_TYPE');
  });

  test('files over 5 MB are refused', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 10);
    big.set(PNG);
    const res = await upload(tk.owner, 'GALLERY', big);
    expect(res.status).toBe(413);
    expect(res.json.error.code).toBe('FILE_TOO_LARGE');
  });

  test('only the owner can upload or delete; signed-out users cannot upload', async () => {
    expect((await upload(undefined, 'GALLERY', PNG)).status).toBe(401);
    expect((await upload(tk.other, 'GALLERY', PNG)).status).toBe(403);
    const [p] = await db.sql`select id from styra.business_photos where kind = 'GALLERY' limit 1`;
    const del = await call(r.photo.DELETE, { method: 'DELETE', token: tk.other, params: { id: p.id } });
    expect(del.status).toBe(403);
  });

  test('the owner deletes a gallery photo', async () => {
    const before = (await call(r.photos.GET, { token: tk.owner })).data.items.filter((x: any) => x.kind === 'GALLERY').length;
    const [p] = await db.sql`select id from styra.business_photos where kind = 'GALLERY' limit 1`;
    const del = await call(r.photo.DELETE, { method: 'DELETE', token: tk.owner, params: { id: p.id } });
    expect(del.status).toBe(200);
    const after = (await call(r.photos.GET, { token: tk.owner })).data.items.filter((x: any) => x.kind === 'GALLERY').length;
    expect(after).toBe(before - 1);
  });
});
