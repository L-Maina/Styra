/**
 * Prints idempotent SQL that seeds the demo businesses into any styra database (used for the shared
 * Supabase project so previews have something to browse). Owners get random passwords that are never
 * printed, so nobody can sign in as them; no admin is created.
 *   bun scripts/v2/seed-sql.ts > /tmp/seed.sql
 */
import bcrypt from 'bcryptjs';
import { BUSINESSES, kes } from './seed-data';

const q = (v: string | number | null | undefined) => (v == null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const out: string[] = ['begin;'];
for (const b of BUSINESSES) {
  const hash = bcrypt.hashSync(crypto.randomUUID() + crypto.randomUUID(), 11);
  const [name, email] = b.owner;
  const biz = b.business;
  out.push(`insert into styra.users (email, name, role, password_hash) values (${q(email)}, ${q(name)}, 'PROVIDER', ${q(hash)}) on conflict do nothing;`);
  out.push(`insert into styra.businesses (owner_id, slug, name, category, city, address, phone, description, lat, lng, status)
  select u.id, ${q(slug(biz.name))}, ${q(biz.name)}, ${q(biz.category)}, ${q(biz.city)}, ${q(biz.address)}, ${q(biz.phone)}, ${q(biz.description)}, ${biz.lat}, ${biz.lng}, 'ACTIVE'
    from styra.users u where lower(u.email) = lower(${q(email)})
  on conflict (slug) do nothing;`);
  for (const [i, [sname, duration, price]] of b.services.entries()) {
    out.push(`insert into styra.services (business_id, name, category, duration_min, price_minor, position)
  select b.id, ${q(sname)}, ${q(biz.category)}, ${duration}, ${kes(price)}, ${i} from styra.businesses b
   where b.slug = ${q(slug(biz.name))} and not exists (select 1 from styra.services s where s.business_id = b.id and s.name = ${q(sname)});`);
  }
  for (const h of b.hours) {
    out.push(`insert into styra.availability_rules (staff_id, weekday, start_time, end_time)
  select st.id, ${h.weekday}, ${q(h.start)}, ${q(h.end)} from styra.staff st join styra.businesses b on b.id = st.business_id
   where b.slug = ${q(slug(biz.name))} and not exists (select 1 from styra.availability_rules r where r.staff_id = st.id and r.weekday = ${h.weekday});`);
  }
}
out.push('commit;');
console.log(out.join('\n'));
