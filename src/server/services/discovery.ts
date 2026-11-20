import type { z } from 'zod';
import { AppError } from '../../core/errors';
import { computeSlots, zonedWallTimeToUtc } from '../../core/slots';
import type { businessListQuery } from '../../contracts/booking';
import type { Db } from '../db';
import { iso, n } from './common';

const rating = (r: { rating_avg: unknown; rating_count: unknown }) => ({ avg: n(r.rating_avg), count: n(r.rating_count) });

export async function listBusinesses(db: Db, q: z.infer<typeof businessListQuery>) {
  const rows = await db.query<Record<string, unknown>>(
    `select b.id, b.slug, b.name, b.category, b.city, b.address, b.rating_avg, b.rating_count,
            (select min(s.price_minor) from styra.services s where s.business_id = b.id and s.active) as from_price
       from styra.businesses b
      where b.status = 'ACTIVE'
        and ($1::text is null or b.name ilike '%' || $1 || '%' or b.description ilike '%' || $1 || '%' or b.category ilike $1 || '%' or b.city ilike $1 || '%')
        and ($2::text is null or b.category = upper($2))
        and ($3::text is null or b.city ilike $3)
      order by b.rating_avg desc, b.rating_count desc, b.name
      limit $4 offset $5`,
    [q.q || null, q.category || null, q.city || null, q.limit + 1, q.cursor],
  );
  const items = rows.slice(0, q.limit).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    category: String(r.category),
    city: r.city == null ? null : String(r.city),
    address: r.address == null ? null : String(r.address),
    rating: rating(r as never),
    fromPriceMinor: r.from_price == null ? null : n(r.from_price),
  }));
  return { items, nextCursor: rows.length > q.limit ? q.cursor + q.limit : null };
}

export async function getBusinessPage(db: Db, slug: string) {
  const [b] = await db.query<Record<string, unknown>>(
    `select id, slug, name, category, city, address, phone, description, timezone, lat, lng, rating_avg, rating_count
       from styra.businesses where slug = $1 and status = 'ACTIVE'`,
    [slug],
  );
  if (!b) throw new AppError('NOT_FOUND', 'business not found', 404);
  const [services, staff, rules, reviews] = await Promise.all([
    db.query<Record<string, unknown>>(
      `select id, name, category, description, duration_min, price_minor, currency from styra.services where business_id = $1 and active order by position, name`,
      [b.id],
    ),
    db.query<Record<string, unknown>>(`select id, name from styra.staff where business_id = $1 and active order by created_at`, [b.id]),
    db.query<Record<string, unknown>>(
      `select distinct r.weekday, to_char(r.start_time, 'HH24:MI') as start, to_char(r.end_time, 'HH24:MI') as end
         from styra.availability_rules r join styra.staff s on s.id = r.staff_id
        where s.business_id = $1 and s.active order by 1, 2`,
      [b.id],
    ),
    db.query<Record<string, unknown>>(
      `select r.rating, r.comment, r.created_at, split_part(u.name, ' ', 1) as first_name
         from styra.reviews r join styra.users u on u.id = r.customer_id
        where r.business_id = $1 order by r.created_at desc limit 10`,
      [b.id],
    ),
  ]);
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(b.id),
    slug: String(b.slug),
    name: String(b.name),
    category: String(b.category),
    city: str(b.city),
    address: str(b.address),
    phone: str(b.phone),
    description: str(b.description),
    timeZone: String(b.timezone),
    location: b.lat == null ? null : { lat: n(b.lat), lng: n(b.lng) },
    rating: rating(b as never),
    services: services.map((s) => ({
      id: String(s.id),
      name: String(s.name),
      category: String(s.category),
      description: str(s.description),
      durationMin: n(s.duration_min),
      priceMinor: n(s.price_minor),
      currency: String(s.currency).trim(),
    })),
    staff: staff.map((s) => ({ id: String(s.id), name: String(s.name) })),
    hours: rules.map((r) => ({ weekday: n(r.weekday), start: String(r.start), end: String(r.end) })),
    reviews: reviews.map((r) => ({ rating: n(r.rating), comment: str(r.comment), author: String(r.first_name), createdAt: iso(r.created_at) })),
  };
}

export async function getSlots(db: Db, slug: string, q: { serviceId: string; date: string; staffId?: string }, now: Date) {
  const [svc] = await db.query<{ duration_min: number; business_id: string; timezone: string }>(
    `select s.duration_min, s.business_id, b.timezone from styra.services s join styra.businesses b on b.id = s.business_id
      where s.id = $1 and b.slug = $2 and s.active and b.status = 'ACTIVE'`,
    [q.serviceId, slug],
  );
  if (!svc) throw new AppError('NOT_FOUND', 'service not found', 404);
  const tz = svc.timezone;
  const dayStart = zonedWallTimeToUtc(q.date, '00:00', tz);
  const dayEnd = new Date(dayStart.getTime() + 36 * 3600_000); // covers the local day plus DST slack
  const staff = await db.query<{ id: string }>(
    `select id from styra.staff where business_id = $1 and active and ($2::uuid is null or id = $2::uuid) order by created_at`,
    [svc.business_id, q.staffId ?? null],
  );
  const byStart = new Map<number, string>();
  for (const s of staff) {
    const [rules, busy, off] = await Promise.all([
      db.query<{ weekday: number; start: string; end: string }>(
        `select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end from styra.availability_rules where staff_id = $1`,
        [s.id],
      ),
      db.query<{ start_at: Date; end_at: Date }>(
        `select start_at, end_at from styra.bookings
          where staff_id = $1 and start_at < $3 and end_at > $2
            and (status = 'CONFIRMED' or (status = 'PENDING' and expires_at > $4))`,
        [s.id, dayStart, dayEnd, now],
      ),
      db.query<{ lo: Date; hi: Date }>(`select lower(during) as lo, upper(during) as hi from styra.time_off where staff_id = $1 and during && tstzrange($2, $3)`, [
        s.id,
        dayStart,
        dayEnd,
      ]),
    ]);
    const slots = computeSlots({
      date: q.date,
      timeZone: tz,
      rules: rules.map((r) => ({ weekday: n(r.weekday), start: r.start, end: r.end })),
      busy: [...busy.map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })), ...off.map((o) => ({ start: new Date(o.lo), end: new Date(o.hi) }))],
      durationMin: n(svc.duration_min),
      now,
    });
    for (const t of slots) if (!byStart.has(t.getTime())) byStart.set(t.getTime(), s.id);
  }
  const slots = [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([t, staffId]) => ({ startAt: new Date(t).toISOString(), staffId }));
  return { date: q.date, timeZone: tz, durationMin: n(svc.duration_min), slots };
}
