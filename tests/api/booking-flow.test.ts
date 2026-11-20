import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dbReachable, freshDb, type TestDb } from '../db/harness';
import { call } from './client';

const reachable = await dbReachable();

describe.skipIf(!reachable)('scripted API run: browse, book, pay, complete, confirm (real Postgres)', () => {
  let db: TestDb;
  const r: Record<string, any> = {};
  const t: Record<string, string> = {};
  let business: any;
  let service: any;
  let booking: any;

  beforeAll(async () => {
    db = await freshDb();
    process.env.DATABASE_URL = db.url;
    process.env.STYRA_FAKE_PAYMENTS = '1';
    process.env.CRON_SECRET = 'test-cron-secret';
    const load = (p: string) => import(`../../src/app/api/v2/${p}/route`);
    Object.assign(r, {
      register: await load('auth/register'),
      proBusiness: await load('pro/business'),
      proServices: await load('pro/services'),
      proAvailability: await load('pro/availability'),
      proBookings: await load('pro/bookings'),
      proBookingAction: await load('pro/bookings/[id]/[action]'),
      adminApprove: await load('admin/businesses/[id]/approve'),
      adminLedger: await load('admin/ledger'),
      businesses: await load('businesses'),
      business: await load('businesses/[slug]'),
      slots: await load('businesses/[slug]/slots'),
      bookings: await load('bookings'),
      bookingByCode: await load('bookings/[code]'),
      pay: await load('bookings/[code]/pay'),
      bookingAction: await load('bookings/[code]/[action]'),
      tick: await load('cron/tick'),
    });
    for (const [who, email] of [['owner', 'owner@kinyozi.test'], ['customer', 'amina@example.test'], ['other', 'otieno@example.test'], ['admin', 'admin@styra.test']]) {
      const res = await call(r.register.POST, { body: { email, password: 'correct horse 42', name: who } });
      t[who] = res.data.token;
    }
    await db.sql`update styra.users set role = 'ADMIN' where email = 'admin@styra.test'`;
  });
  afterAll(async () => {
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  });

  test('a customer can create a business and becomes a provider', async () => {
    const res = await call(r.proBusiness.POST, {
      token: t.owner,
      body: { name: 'Kinyozi Pro', category: 'BARBER', city: 'Nairobi', address: 'Westlands, Woodvale Grove', phone: '0712345678', description: 'Fades, beard trims and hot towels.' },
    });
    expect(res.status).toBe(201);
    business = res.data.business;
    expect(business).toMatchObject({ name: 'Kinyozi Pro', slug: 'kinyozi-pro', status: 'PENDING_REVIEW' });
    const me = await call(r.proBusiness.GET, { token: t.owner });
    expect(me.data.business.id).toBe(business.id);
  });

  test('the provider adds a service and weekly hours', async () => {
    const res = await call(r.proServices.POST, { token: t.owner, body: { name: 'Classic cut', category: 'BARBER', durationMin: 30, priceMinor: 150000 } });
    expect(res.status).toBe(201);
    service = res.data.service;
    expect(service).toMatchObject({ name: 'Classic cut', durationMin: 30, priceMinor: 150000, currency: 'KES' });
    const hours = await call(r.proAvailability.POST, {
      method: 'PUT',
      token: t.owner,
      body: { rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '08:00', end: '20:00' })) },
    });
    expect(hours.status).toBe(200);
    expect(hours.data.rules).toHaveLength(7);
  });

  test('pending businesses are not listed; an admin approves', async () => {
    expect((await call(r.businesses.GET)).data.items).toHaveLength(0);
    expect((await call(r.adminApprove.POST, { token: t.customer, body: {}, params: { id: business.id } })).status).toBe(403);
    const ok = await call(r.adminApprove.POST, { token: t.admin, body: {}, params: { id: business.id } });
    expect(ok.data.business.status).toBe('ACTIVE');
  });

  test('browse: list, search, and the business page', async () => {
    const list = await call(r.businesses.GET, { query: { q: 'kinyozi' } });
    expect(list.data.items).toHaveLength(1);
    expect(list.data.items[0]).toMatchObject({ slug: 'kinyozi-pro', name: 'Kinyozi Pro', fromPriceMinor: 150000, rating: { avg: 0, count: 0 } });
    expect((await call(r.businesses.GET, { query: { q: 'spa' } })).data.items).toHaveLength(0);
    const page = await call(r.business.GET, { params: { slug: 'kinyozi-pro' } });
    expect(page.data.business.services).toEqual([expect.objectContaining({ id: service.id, priceMinor: 150000 })]);
    expect(page.data.business.staff).toEqual([expect.objectContaining({ name: 'Main chair' })]);
    expect((await call(r.business.GET, { params: { slug: 'nope' } })).status).toBe(404);
  });

  test('slots for tomorrow in Nairobi time', async () => {
    const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const res = await call(r.slots.GET, { params: { slug: 'kinyozi-pro' }, query: { serviceId: service.id, date: tomorrow } });
    expect(res.status).toBe(200);
    expect(res.data.timeZone).toBe('Africa/Nairobi');
    expect(res.data.slots.length).toBeGreaterThan(40); // 08:00-20:00 in 15-minute steps
    expect(res.data.slots[0]).toHaveProperty('startAt');
    expect(res.data.slots[0]).toHaveProperty('staffId');
  });

  test('book a slot; it disappears from the slot list', async () => {
    const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const before = await call(r.slots.GET, { params: { slug: 'kinyozi-pro' }, query: { serviceId: service.id, date: tomorrow } });
    const slot = before.data.slots[4];
    const res = await call(r.bookings.POST, { token: t.customer, body: { serviceId: service.id, startAt: slot.startAt, staffId: slot.staffId } });
    expect(res.status).toBe(201);
    booking = res.data.booking;
    expect(booking).toMatchObject({ status: 'PENDING', priceMinor: 150000, business: { name: 'Kinyozi Pro' }, service: { name: 'Classic cut' } });
    expect(booking.actions).toEqual(expect.arrayContaining(['pay', 'cancel']));
    const after = await call(r.slots.GET, { params: { slug: 'kinyozi-pro' }, query: { serviceId: service.id, date: tomorrow } });
    expect(after.data.slots.map((s: any) => s.startAt)).not.toContain(slot.startAt);
    const again = await call(r.bookings.POST, { token: t.other, body: { serviceId: service.id, startAt: slot.startAt, staffId: slot.staffId } });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe('SLOT_TAKEN');
  });

  test('booking without signing in is refused', async () => {
    const res = await call(r.bookings.POST, { body: { serviceId: service.id, startAt: new Date(Date.now() + 3 * 86400_000).toISOString() } });
    expect(res.status).toBe(401);
  });

  test('other customers cannot see or act on the booking', async () => {
    expect((await call(r.bookingByCode.GET, { token: t.other, params: { code: booking.code } })).status).toBe(404);
    expect((await call(r.pay.POST, { token: t.other, body: { method: 'FAKE' }, params: { code: booking.code } })).status).toBe(404);
  });

  test('pay with the fake provider: confirmed, payment held', async () => {
    const res = await call(r.pay.POST, { token: t.customer, body: { method: 'FAKE' }, params: { code: booking.code } });
    expect(res.status).toBe(200);
    expect(res.data.booking).toMatchObject({ status: 'CONFIRMED', escrowState: 'HELD' });
    const replay = await call(r.pay.POST, { token: t.customer, body: { method: 'FAKE' }, params: { code: booking.code } });
    expect(replay.status).toBe(409);
  });

  test('the customer cannot complete; the provider can', async () => {
    expect((await call(r.proBookingAction.POST, { token: t.customer, body: {}, params: { id: booking.id, action: 'complete' } })).status).toBe(403);
    const list = await call(r.proBookings.GET, { token: t.owner });
    expect(list.data.items.map((b: any) => b.code)).toContain(booking.code);
    const res = await call(r.proBookingAction.POST, { token: t.owner, body: {}, params: { id: booking.id, action: 'complete' } });
    expect(res.data.booking.status).toBe('COMPLETED');
  });

  test('the customer confirms the service; the business is paid', async () => {
    const view = await call(r.bookingByCode.GET, { token: t.customer, params: { code: booking.code } });
    expect(view.data.booking.actions).toEqual(expect.arrayContaining(['confirm', 'dispute']));
    expect(view.data.booking.autoConfirmAt).toBeTruthy();
    const res = await call(r.bookingAction.POST, { token: t.customer, body: {}, params: { code: booking.code, action: 'confirm' } });
    expect(res.data.booking).toMatchObject({ status: 'VERIFIED', escrowState: 'SETTLED' });
  });

  test('the customer leaves one review; the rating updates', async () => {
    const res = await call(r.bookingAction.POST, { token: t.customer, body: { rating: 5, comment: 'Sharp fade, on time.' }, params: { code: booking.code, action: 'review' } });
    expect(res.status).toBe(200);
    const dup = await call(r.bookingAction.POST, { token: t.customer, body: { rating: 4 }, params: { code: booking.code, action: 'review' } });
    expect(dup.status).toBe(409);
    const page = await call(r.business.GET, { params: { slug: 'kinyozi-pro' } });
    expect(page.data.business.rating).toEqual({ avg: 5, count: 1 });
  });

  test('my bookings lists it for the customer', async () => {
    const res = await call(r.bookings.GET, { token: t.customer });
    expect(res.data.items.map((b: any) => b.code)).toContain(booking.code);
  });

  test('admin ledger: balanced, provider owed 1,350, Styra fee 150', async () => {
    expect((await call(r.adminLedger.GET, { token: t.owner })).status).toBe(403);
    const res = await call(r.adminLedger.GET, { token: t.admin });
    expect(res.data.balanced).toBe(true);
    expect(res.data.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'PROVIDER_BALANCE', businessId: business.id, balanceMinor: 135000 }),
        expect.objectContaining({ kind: 'PLATFORM_REVENUE', balanceMinor: 15000 }),
      ]),
    );
  });

  test('cron tick needs the secret', async () => {
    expect((await call(r.tick.POST, { body: {} })).status).toBe(401);
    const ok = await call(r.tick.POST, { body: {}, headers: { authorization: 'Bearer test-cron-secret' } });
    expect(ok.status).toBe(200);
    expect(ok.data).toHaveProperty('expired');
  });

  test('customer cancellation 2 days ahead refunds in full; refund is on its way', async () => {
    const date = new Date(Date.now() + 2 * 86400_000 + 3600_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const s = await call(r.slots.GET, { params: { slug: 'kinyozi-pro' }, query: { serviceId: service.id, date } });
    const slot = s.data.slots.at(-1);
    const b = (await call(r.bookings.POST, { token: t.customer, body: { serviceId: service.id, startAt: slot.startAt } })).data.booking;
    await call(r.pay.POST, { token: t.customer, body: { method: 'FAKE' }, params: { code: b.code } });
    const res = await call(r.bookingAction.POST, { token: t.customer, body: { reason: 'Travelling' }, params: { code: b.code, action: 'cancel' } });
    expect(res.data.booking).toMatchObject({ status: 'CANCELLED', refund: { amountMinor: 150000, status: 'PENDING' } });
  });
});
