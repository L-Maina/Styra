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

const week = (start: string, end: string, days = [1, 2, 3, 4, 5, 6]) => days.map((weekday) => ({ weekday, start, end }));
const kes = (shillings: number) => shillings * 100;

const BUSINESSES = [
  {
    owner: ['Brian Kamau', 'brian@kinyozi.test'],
    business: { name: 'Kinyozi Pro', category: 'BARBER', city: 'Nairobi', address: 'Woodvale Grove, Westlands', phone: '0712345678', description: 'Clean fades, beard sculpting and hot towel shaves. Walk out sharp.', lat: -1.2648, lng: 36.8028 },
    services: [['Classic cut', 30, 600], ['Fade and beard trim', 45, 800], ['Hot towel shave', 30, 700], ['Kids cut (under 12)', 30, 500]],
    hours: week('08:00', '20:00'),
  },
  {
    owner: ['Zawadi Achieng', 'zawadi@braids.test'],
    business: { name: 'Zawadi Braids Studio', category: 'BRAIDS', city: 'Nairobi', address: 'Argwings Kodhek Rd, Kilimani', phone: '0722123456', description: 'Knotless, box braids and cornrows by stylists who take their time.', lat: -1.2921, lng: 36.7836 },
    services: [['Knotless braids, medium', 300, 4500], ['Box braids', 240, 3500], ['Cornrows', 90, 1500]],
    hours: week('09:00', '19:00', [2, 3, 4, 5, 6, 0]),
  },
  {
    owner: ['Kevin Otieno', 'kevin@faderoom.test'],
    business: { name: 'The Fade Room', category: 'BARBER', city: 'Nairobi', address: 'Ngong Rd, Kilimani', phone: '0733456789', description: 'Precision fades and line-ups. Appointments run on time.', lat: -1.3006, lng: 36.7799 },
    services: [['Skin fade', 40, 700], ['Line-up', 20, 300], ['Cut and wash', 50, 900]],
    hours: week('07:30', '21:00'),
  },
  {
    owner: ['Wanjiku Mwangi', 'wanjiku@nails.test'],
    business: { name: 'Nails by Wanjiku', category: 'NAILS', city: 'Nairobi', address: 'Lavington Mall, Lavington', phone: '0711987654', description: 'Gel, acrylics and natural nail care in a calm studio.', lat: -1.2789, lng: 36.7702 },
    services: [['Gel manicure', 60, 1800], ['Acrylic full set', 90, 3000], ['Pedicure', 60, 1500]],
    hours: week('10:00', '19:00'),
  },
  {
    owner: ['Faith Njeri', 'faith@serene.test'],
    business: { name: 'Serene Spa Kilimani', category: 'SPA', city: 'Nairobi', address: 'Dennis Pritt Rd, Kilimani', phone: '0700112233', description: 'Deep tissue, Swedish and hot stone massage. Quiet rooms, warm towels.', lat: -1.2912, lng: 36.7905 },
    services: [['Swedish massage', 60, 4000], ['Deep tissue massage', 90, 6000], ['Hot stone massage', 75, 5500]],
    hours: week('09:00', '20:00', [0, 1, 2, 3, 4, 5, 6]),
  },
  {
    owner: ['Mercy Wairimu', 'mercy@zuri.test'],
    business: { name: 'Zuri Hair Lounge', category: 'HAIR', city: 'Nairobi', address: 'Kimathi St, CBD', phone: '0799887766', description: 'Silk press, wash and set, and treatments for natural hair.', lat: -1.2833, lng: 36.8219 },
    services: [['Silk press', 120, 3000], ['Wash and set', 60, 1500], ['Deep conditioning', 45, 1200]],
    hours: week('08:30', '18:30'),
  },
] as const;

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
