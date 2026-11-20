import { afterAll, beforeAll, describe, expect, setSystemTime, test } from 'bun:test';
import { dbReachable, freshDb, type TestDb } from '../db/harness';
import { call } from './client';

const reachable = await dbReachable();

describe.skipIf(!reachable)('earnings, payouts, refunds and disputes (real Postgres)', () => {
  let db: TestDb;
  const r: Record<string, any> = {};
  const t: Record<string, string> = {};
  let service: any;
  let slotIndex = 0;

  beforeAll(async () => {
    db = await freshDb();
    process.env.DATABASE_URL = db.url;
    process.env.STYRA_FAKE_PAYMENTS = '1';
    const load = (p: string) => import(`../../src/app/api/v2/${p}/route`);
    Object.assign(r, {
      register: await load('auth/register'),
      proBusiness: await load('pro/business'),
      proServices: await load('pro/services'),
      proAvailability: await load('pro/availability'),
      proAction: await load('pro/bookings/[id]/[action]'),
      earnings: await load('pro/earnings'),
      payouts: await load('pro/payouts'),
      approve: await load('admin/businesses/[id]/approve'),
      adminPayouts: await load('admin/payouts'),
      adminPayout: await load('admin/payouts/[id]/[action]'),
      adminRefunds: await load('admin/refunds'),
      adminRefundPaid: await load('admin/refunds/[id]/paid'),
      adminDisputes: await load('admin/disputes'),
      adminResolve: await load('admin/disputes/[id]/resolve'),
      slots: await load('businesses/[slug]/slots'),
      bookings: await load('bookings'),
      pay: await load('bookings/[code]/pay'),
      action: await load('bookings/[code]/[action]'),
      view: await load('bookings/[code]'),
    });
    for (const who of ['owner', 'customer', 'admin']) t[who] = (await call(r.register.POST, { body: { email: `${who}@m.test`, password: 'correct horse 42', name: who } })).data.token;
    await db.sql`update styra.users set role = 'ADMIN' where email = 'admin@m.test'`;
    const biz = (await call(r.proBusiness.POST, { token: t.owner, body: { name: 'Fade House', category: 'BARBER', city: 'Nairobi' } })).data.business;
    service = (await call(r.proServices.POST, { token: t.owner, body: { name: 'Skin fade', category: 'BARBER', durationMin: 30, priceMinor: 150000 } })).data.service;
    await call(r.proAvailability.POST, { method: 'PUT', token: t.owner, body: { rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '06:00', end: '22:00' })) } });
    await call(r.approve.POST, { token: t.admin, body: {}, params: { id: biz.id } });
  }, 30_000);
  afterAll(async () => {
    setSystemTime();
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  }, 30_000);

  /** Books and pays a slot three days out; returns the booking. */
  async function paidBooking() {
    const date = new Date(Date.now() + 3 * 86400_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const s = await call(r.slots.GET, { params: { slug: 'fade-house' }, query: { serviceId: service.id, date } });
    const slot = s.data.slots[slotIndex++ * 3];
    const b = (await call(r.bookings.POST, { token: t.customer, body: { serviceId: service.id, startAt: slot.startAt } })).data.booking;
    await call(r.pay.POST, { token: t.customer, body: { method: 'FAKE' }, params: { code: b.code } });
    return b;
  }
  async function afterStart<T>(b: any, fn: () => Promise<T>) {
    setSystemTime(new Date(new Date(b.startAt).getTime() + 40 * 60_000));
    try {
      return await fn();
    } finally {
      setSystemTime();
    }
  }

  test('earnings start empty, then show held and available money', async () => {
    expect((await call(r.earnings.GET, { token: t.owner })).data).toMatchObject({ availableMinor: 0, heldMinor: 0, payouts: [] });
    const b = await paidBooking();
    expect((await call(r.earnings.GET, { token: t.owner })).data.heldMinor).toBe(150000);
    await afterStart(b, async () => {
      await call(r.proAction.POST, { token: t.owner, body: {}, params: { id: b.id, action: 'complete' } });
      await call(r.action.POST, { token: t.customer, body: {}, params: { code: b.code, action: 'confirm' } });
    });
    expect((await call(r.earnings.GET, { token: t.owner })).data).toMatchObject({ availableMinor: 135000, heldMinor: 0 });
    expect((await call(r.earnings.GET, { token: t.customer })).status).toBe(403);
  });

  test('a payout reserves the money; admin marks it paid, or failed (money returns)', async () => {
    const p1 = await call(r.payouts.POST, { token: t.owner, body: { amountMinor: 20000, method: 'MPESA', destination: '0712345678' } });
    expect(p1.status).toBe(201);
    expect(p1.data.payout).toMatchObject({ amountMinor: 20000, status: 'REQUESTED', destination: '0712 *** 678' });
    expect((await call(r.earnings.GET, { token: t.owner })).data.availableMinor).toBe(115000);
    expect((await call(r.payouts.POST, { token: t.owner, body: { amountMinor: 999999, method: 'MPESA', destination: '0712345678' } })).json.error.code).toBe('INSUFFICIENT_BALANCE');

    expect((await call(r.adminPayouts.GET, { token: t.owner })).status).toBe(403);
    const queue = await call(r.adminPayouts.GET, { token: t.admin });
    expect(queue.data.items.map((p: any) => p.id)).toContain(p1.data.payout.id);
    const paid = await call(r.adminPayout.POST, { token: t.admin, body: { providerRef: 'MP-0001' }, params: { id: p1.data.payout.id, action: 'paid' } });
    expect(paid.data.payout.status).toBe('PAID');

    const p2 = await call(r.payouts.POST, { token: t.owner, body: { amountMinor: 10000, method: 'MPESA', destination: '0712345678' } });
    await call(r.adminPayout.POST, { token: t.admin, body: { reason: 'Number not registered for M-Pesa' }, params: { id: p2.data.payout.id, action: 'failed' } });
    const e = (await call(r.earnings.GET, { token: t.owner })).data;
    expect(e.availableMinor).toBe(115000);
    expect(e.payouts.map((p: any) => p.status)).toEqual(['FAILED', 'PAID']);
  });

  test('a refund is queued on cancellation; admin marks it paid and the customer sees Refunded', async () => {
    const b = await paidBooking();
    const c = await call(r.action.POST, { token: t.customer, body: {}, params: { code: b.code, action: 'cancel' } });
    expect(c.data.booking.refund).toEqual({ amountMinor: 150000, status: 'PENDING' });
    const queue = await call(r.adminRefunds.GET, { token: t.admin });
    const refund = queue.data.items.find((x: any) => x.bookingCode === b.code);
    expect(refund).toMatchObject({ amountMinor: 150000, status: 'PENDING' });
    await call(r.adminRefundPaid.POST, { token: t.admin, body: { providerRef: 'MP-R-77' }, params: { id: refund.id } });
    expect((await call(r.view.GET, { token: t.customer, params: { code: b.code } })).data.booking.refund.status).toBe('PAID');
  });

  test('a dispute reaches the admin queue and a split resolves it', async () => {
    const b = await paidBooking();
    await afterStart(b, async () => {
      await call(r.proAction.POST, { token: t.owner, body: {}, params: { id: b.id, action: 'complete' } });
      await call(r.action.POST, { token: t.customer, body: { reason: 'The fade was uneven on the left side.' }, params: { code: b.code, action: 'dispute' } });
    });
    const queue = await call(r.adminDisputes.GET, { token: t.admin });
    const d = queue.data.items.find((x: any) => x.bookingCode === b.code);
    expect(d).toMatchObject({ status: 'OPEN', reason: 'The fade was uneven on the left side.', priceMinor: 150000 });
    const res = await call(r.adminResolve.POST, { token: t.admin, body: { outcome: 'SPLIT', refundBps: 5000, note: 'Photos show uneven work; half back.' }, params: { id: d.id } });
    expect(res.data.booking).toMatchObject({ status: 'VERIFIED', refund: { amountMinor: 75000, status: 'PENDING' } });
    expect((await call(r.adminResolve.POST, { token: t.admin, body: { outcome: 'REFUND', note: 'again' }, params: { id: d.id } })).status).toBe(409);
  });
});
