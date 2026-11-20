/**
 * Seeds demo data for local development and previews. Refuses to run against production.
 *   DATABASE_URL=postgres://localhost:5432/styra_dev bun scripts/v2/seed.ts
 * Uses the same services as the API, so every money rule still applies.
 */
import { Pool } from 'pg';
import { pgDb } from '../../src/server/db';
import { createSession, registerUser } from '../../src/server/auth';
import { addService, createBusiness, setAvailability } from '../../src/server/services/pro';

if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') throw new Error('seed refuses to run in production');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = pgDb(new Pool({ connectionString: url }));

import { BUSINESSES, kes } from './seed-data';


const existing = await db.query('select count(*)::int as n from styra.businesses');
if ((existing[0] as { n: number }).n > 0) {
  console.log('styra.businesses already has rows; seed skipped.');
  process.exit(0);
}

for (const b of BUSINESSES) {
  const u = await registerUser(db, { email: b.owner[1], password: 'styra-demo-pass', name: b.owner[0] });
  const user = { ...u, role: 'CUSTOMER' as const, sessionId: '', via: 'bearer' as const };
  const biz = await createBusiness(db, user, b.business as never);
  const provider = { ...user, role: 'PROVIDER' as const };
  for (const [name, durationMin, price] of b.services) await addService(db, provider, { name, category: b.business.category, durationMin, priceMinor: kes(price) });
  await setAvailability(db, provider, { rules: [...b.hours] });
  await db.query(`update styra.businesses set status = 'ACTIVE' where id = $1`, [biz.id]);
}

const customer = await registerUser(db, { email: 'amina@example.test', password: 'styra-demo-pass', name: 'Amina Wanjiru' });
await createSession(db, customer.id, 'seed');
const admin = await registerUser(db, { email: 'admin@styra.test', password: 'styra-demo-pass', name: 'Styra Admin' });
await db.query(`update styra.users set role = 'ADMIN' where id = $1`, [admin.id]);

console.log(`Seeded ${BUSINESSES.length} businesses, a customer (amina@example.test) and an admin (admin@styra.test). Password: styra-demo-pass`);
process.exit(0);
