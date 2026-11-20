import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dbReachable, freshDb, type TestDb } from '../db/harness';
import { call } from './client';

const reachable = await dbReachable();

describe.skipIf(!reachable)('near me (real Postgres)', () => {
  let db: TestDb;
  let list: any;
  beforeAll(async () => {
    db = await freshDb();
    process.env.DATABASE_URL = db.url;
    list = await import('../../src/app/api/v2/businesses/route');
    const [owner] = await db.sql`insert into styra.users (email, name, role) values ('o@near.test', 'Owner', 'PROVIDER') returning id`;
    const rows: [string, string, number, number][] = [
      ['westlands-cuts', 'BARBER', -1.2648, 36.8028], // ~1.6 km from the point
      ['kilimani-spa', 'SPA', -1.2912, 36.7905], // ~2.8 km
      ['karen-barber', 'BARBER', -1.3197, 36.7073], // ~11 km
      ['no-location', 'BARBER', null as never, null as never],
    ];
    for (const [slug, cat, lat, lng] of rows) {
      const [b] = await db.sql`insert into styra.businesses (owner_id, slug, name, category, city, lat, lng, status) values (${owner.id}, ${slug}, ${slug}, ${cat}, 'Nairobi', ${lat}, ${lng}, 'ACTIVE') returning id`;
      await db.sql`insert into styra.services (business_id, name, category, duration_min, price_minor) values (${b.id}, 'Cut', ${cat}, 30, 60000)`;
    }
  }, 30_000);
  afterAll(async () => {
    const { closeDb } = await import('../../src/server/db-pool');
    await closeDb();
    if (db) await db.drop();
  }, 30_000);

  const here = { lat: '-1.2700', lng: '36.8170' }; // near Parklands

  test('with a location, results are sorted by distance and carry distanceKm and coordinates', async () => {
    const res = await call(list.GET, { query: { ...here } });
    const items = res.data.items;
    expect(items.map((b: any) => b.slug)).toEqual(['westlands-cuts', 'kilimani-spa', 'karen-barber']);
    expect(items[0].distanceKm).toBeGreaterThan(1);
    expect(items[0].distanceKm).toBeLessThan(2.5);
    expect(items[0].location).toEqual({ lat: -1.2648, lng: 36.8028 });
  });

  test('a radius keeps only businesses inside it', async () => {
    const res = await call(list.GET, { query: { ...here, radiusKm: '5' } });
    expect(res.data.items.map((b: any) => b.slug)).toEqual(['westlands-cuts', 'kilimani-spa']);
  });

  test('category filter combines with distance', async () => {
    const res = await call(list.GET, { query: { ...here, category: 'BARBER' } });
    expect(res.data.items.map((b: any) => b.slug)).toEqual(['westlands-cuts', 'karen-barber']);
  });

  test('without a location nothing changes: rating order, no distance', async () => {
    const res = await call(list.GET);
    expect(res.data.items).toHaveLength(4);
    expect(res.data.items[0].distanceKm).toBeNull();
  });

  test('out-of-range coordinates are refused', async () => {
    expect((await call(list.GET, { query: { lat: '123', lng: '36.8' } })).status).toBe(422);
  });
});
