import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dbReachable, freshDb, type TestDb } from '../db/harness';
import { call } from './client';

const reachable = await dbReachable();

describe.skipIf(!reachable)('messaging (real Postgres)', () => {
  let db: TestDb;
  const r: Record<string, any> = {};
  const tk: Record<string, string> = {};
  let convoId = '';

  beforeAll(async () => {
    db = await freshDb();
    process.env.DATABASE_URL = db.url;
    const load = (p: string) => import(`../../src/app/api/v2/${p}/route`);
    Object.assign(r, {
      register: await load('auth/register'),
      proBusiness: await load('pro/business'),
      approve: await load('admin/businesses/[id]/approve'),
      convos: await load('conversations'),
      thread: await load('conversations/[id]/messages'),
    });
    for (const who of ['owner', 'amina', 'otieno', 'admin']) tk[who] = (await call(r.register.POST, { body: { email: `${who}@c.test`, password: 'correct horse 42', name: `${who[0].toUpperCase()}${who.slice(1)} Test` } })).data.token;
    await db.sql`update styra.users set role = 'ADMIN' where email = 'admin@c.test'`;
    const biz = (await call(r.proBusiness.POST, { token: tk.owner, body: { name: 'Line Up Lab', category: 'BARBER', city: 'Nairobi' } })).data.business;
    await call(r.approve.POST, { token: tk.admin, body: {}, params: { id: biz.id } });
  }, 30_000);
  afterAll(async () => {
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  }, 30_000);

  test('a customer starts a conversation with a business; starting again returns the same one', async () => {
    const a = await call(r.convos.POST, { token: tk.amina, body: { businessSlug: 'line-up-lab' } });
    expect(a.status).toBe(201);
    convoId = a.data.conversation.id;
    expect(a.data.conversation).toMatchObject({ business: { name: 'Line Up Lab' }, viewer: 'CUSTOMER' });
    const b = await call(r.convos.POST, { token: tk.amina, body: { businessSlug: 'line-up-lab' } });
    expect(b.data.conversation.id).toBe(convoId);
  });

  test('a business cannot start a conversation with itself', async () => {
    expect((await call(r.convos.POST, { token: tk.owner, body: { businessSlug: 'line-up-lab' } })).status).toBe(409);
  });

  test('messages flow both ways and unread counts follow', async () => {
    await call(r.thread.POST, { token: tk.amina, body: { body: 'Hi, do you do beard trims on Sunday?' }, params: { id: convoId } });
    const ownerInbox = await call(r.convos.GET, { token: tk.owner });
    expect(ownerInbox.data.items).toHaveLength(1);
    expect(ownerInbox.data.items[0]).toMatchObject({ unread: 1, viewer: 'BUSINESS', lastMessage: { body: 'Hi, do you do beard trims on Sunday?' }, counterpart: { name: 'Amina Test' } });
    const thread = await call(r.thread.GET, { token: tk.owner, params: { id: convoId } });
    expect(thread.data.messages.map((m: any) => [m.body, m.mine])).toEqual([['Hi, do you do beard trims on Sunday?', false]]);
    expect((await call(r.convos.GET, { token: tk.owner })).data.items[0].unread).toBe(0); // reading marks it read
    await call(r.thread.POST, { token: tk.owner, body: { body: 'Yes, from 10 am. Book any open slot.' }, params: { id: convoId } });
    const aminaInbox = await call(r.convos.GET, { token: tk.amina });
    expect(aminaInbox.data.items[0]).toMatchObject({ unread: 1, counterpart: { name: 'Line Up Lab' } });
  });

  test('polling with after returns only newer messages', async () => {
    const all = (await call(r.thread.GET, { token: tk.amina, params: { id: convoId } })).data.messages;
    const newer = await call(r.thread.GET, { token: tk.amina, params: { id: convoId }, query: { after: all[0].createdAt } });
    expect(newer.data.messages.map((m: any) => m.body)).toEqual(['Yes, from 10 am. Book any open slot.']);
  });

  test('outsiders cannot read or post; empty and huge messages are refused', async () => {
    expect((await call(r.thread.GET, { token: tk.otieno, params: { id: convoId } })).status).toBe(404);
    expect((await call(r.thread.POST, { token: tk.otieno, body: { body: 'hello' }, params: { id: convoId } })).status).toBe(404);
    expect((await call(r.thread.POST, { token: tk.amina, body: { body: '   ' }, params: { id: convoId } })).status).toBe(422);
    expect((await call(r.thread.POST, { token: tk.amina, body: { body: 'x'.repeat(2001) }, params: { id: convoId } })).status).toBe(422);
    expect((await call(r.convos.GET)).status).toBe(401);
  });
});
