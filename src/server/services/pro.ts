import type { z } from 'zod';
import { AppError } from '../../core/errors';
import type { availabilityInput, createBusinessInput, serviceInput } from '../../contracts/booking';
import type { SessionUser } from '../auth';
import type { Db } from '../db';
import { n, ownedBusiness } from './common';

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'business';
}

export async function createBusiness(db: Db, user: SessionUser, input: z.infer<typeof createBusinessInput>) {
  return db.transaction(async (tx) => {
    const existing = await tx.query('select 1 from styra.businesses where owner_id = $1', [user.id]);
    if (existing.length) throw new AppError('BUSINESS_EXISTS', 'you already have a business', 409);
    const base = slugify(input.name);
    const taken = await tx.query<{ slug: string }>(`select slug from styra.businesses where slug = $1 or slug like $1 || '-%'`, [base]);
    const used = new Set(taken.map((t) => t.slug));
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    const [b] = await tx.query<Record<string, unknown>>(
      `insert into styra.businesses (owner_id, slug, name, category, city, address, phone, description, lat, lng, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING_REVIEW')
       returning id, slug, name, category, city, address, phone, description, status`,
      [user.id, slug, input.name, input.category, input.city, input.address ?? null, input.phone ?? null, input.description ?? null, input.lat ?? null, input.lng ?? null],
    );
    if (user.role === 'CUSTOMER') await tx.query(`update styra.users set role = 'PROVIDER' where id = $1`, [user.id]);
    return b;
  });
}

export async function getOwnBusiness(db: Db, user: SessionUser) {
  const own = await ownedBusiness(db, user);
  const [b] = await db.query<Record<string, unknown>>(
    'select id, slug, name, category, city, address, phone, description, status from styra.businesses where id = $1',
    [own.id],
  );
  return b;
}

export async function addService(db: Db, user: SessionUser, input: z.infer<typeof serviceInput>) {
  const biz = await ownedBusiness(db, user);
  const [s] = await db.query<Record<string, unknown>>(
    `insert into styra.services (business_id, name, category, description, duration_min, price_minor)
     values ($1, $2, $3, $4, $5, $6) returning id, name, category, description, duration_min, price_minor, currency, active`,
    [biz.id, input.name, input.category, input.description ?? null, input.durationMin, input.priceMinor],
  );
  return { id: s.id, name: s.name, category: s.category, description: s.description, durationMin: n(s.duration_min), priceMinor: n(s.price_minor), currency: String(s.currency).trim(), active: s.active };
}

export async function setAvailability(db: Db, user: SessionUser, input: z.infer<typeof availabilityInput>) {
  const biz = await ownedBusiness(db, user);
  return db.transaction(async (tx) => {
    const [staff] = await tx.query<{ id: string }>(
      `select id from styra.staff where business_id = $1 and ($2::uuid is null or id = $2::uuid) order by created_at limit 1`,
      [biz.id, input.staffId ?? null],
    );
    if (!staff) throw new AppError('NOT_FOUND', 'staff member not found', 404);
    await tx.query('delete from styra.availability_rules where staff_id = $1', [staff.id]);
    for (const r of input.rules) {
      await tx.query('insert into styra.availability_rules (staff_id, weekday, start_time, end_time) values ($1, $2, $3, $4)', [staff.id, r.weekday, r.start, r.end]);
    }
    return { staffId: staff.id, rules: input.rules };
  });
}
