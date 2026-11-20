import { AppError } from '../../core/errors';
import type { BookingAction, BookingDto } from '../../contracts/booking';
import type { SessionUser } from '../auth';
import { createEngine } from '../booking-engine';
import type { Db } from '../db';
import { iso, n, ownedBusiness } from './common';

type Viewer = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

const SELECT = `
  select b.id, b.code, b.status, b.escrow_state, b.start_at, b.end_at, b.price_minor, b.currency, b.expires_at, b.completed_at, b.notes,
         b.customer_id, biz.owner_id,
         biz.id as biz_id, biz.name as biz_name, biz.slug as biz_slug, biz.phone as biz_phone, biz.address as biz_address,
         s.id as svc_id, s.name as svc_name, s.duration_min,
         st.id as staff_id, st.name as staff_name,
         u.name as customer_name,
         (select r.amount_minor from styra.refunds r where r.booking_id = b.id order by r.created_at desc limit 1) as refund_amount,
         (select r.status from styra.refunds r where r.booking_id = b.id order by r.created_at desc limit 1) as refund_status,
         exists (select 1 from styra.reviews rv where rv.booking_id = b.id) as has_review,
         (select (value)::int from styra.settings where key = 'verification_window_hours') as window_hours
    from styra.bookings b
    join styra.businesses biz on biz.id = b.business_id
    join styra.services s on s.id = b.service_id
    join styra.staff st on st.id = b.staff_id
    join styra.users u on u.id = b.customer_id`;

function actionsFor(viewer: Viewer, status: string, hasReview: boolean, started: boolean): BookingAction[] {
  if (viewer === 'CUSTOMER') {
    if (status === 'PENDING') return ['pay', 'cancel'];
    if (status === 'CONFIRMED') return ['cancel'];
    if (status === 'COMPLETED' || status === 'NO_SHOW') return ['confirm', 'dispute'];
    if (status === 'VERIFIED' && !hasReview) return ['review'];
    return [];
  }
  if (viewer === 'PROVIDER' && status === 'CONFIRMED') return started ? ['complete', 'no-show'] : ['decline'];
  return [];
}

function toDto(r: Record<string, any>, viewer: Viewer): BookingDto {
  const autoConfirm =
    (r.status === 'COMPLETED' || r.status === 'NO_SHOW') && r.completed_at
      ? new Date(new Date(r.completed_at).getTime() + n(r.window_hours ?? 24) * 3600_000).toISOString()
      : null;
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    escrowState: r.escrow_state,
    startAt: iso(r.start_at)!,
    endAt: iso(r.end_at)!,
    priceMinor: n(r.price_minor),
    currency: String(r.currency).trim(),
    expiresAt: r.status === 'PENDING' ? iso(r.expires_at) : null,
    autoConfirmAt: autoConfirm,
    notes: r.notes,
    business: { id: r.biz_id, name: r.biz_name, slug: r.biz_slug, phone: r.biz_phone, address: r.biz_address },
    service: { id: r.svc_id, name: r.svc_name, durationMin: n(r.duration_min) },
    staff: { id: r.staff_id, name: r.staff_name },
    customer: { id: r.customer_id, name: r.customer_name },
    refund: r.refund_amount == null ? null : { amountMinor: n(r.refund_amount), status: r.refund_status },
    hasReview: Boolean(r.has_review),
    actions: actionsFor(viewer, r.status, Boolean(r.has_review), new Date(r.start_at).getTime() <= Date.now()),
  };
}

/** Loads a booking the user may see. Others get NOT_FOUND (no existence leak). */
async function loadVisible(db: Db, user: SessionUser, where: { code?: string; id?: string }): Promise<{ row: Record<string, any>; viewer: Viewer }> {
  const [row] = await db.query<Record<string, any>>(`${SELECT} where ${where.code ? 'b.code = $1' : 'b.id = $1'}`, [where.code ?? where.id]);
  if (!row) throw new AppError('NOT_FOUND', 'booking not found', 404);
  if (row.customer_id === user.id) return { row, viewer: 'CUSTOMER' };
  if (row.owner_id === user.id) return { row, viewer: 'PROVIDER' };
  if (user.role === 'ADMIN') return { row, viewer: 'ADMIN' };
  throw new AppError('NOT_FOUND', 'booking not found', 404);
}

export async function getBooking(db: Db, user: SessionUser, code: string) {
  const { row, viewer } = await loadVisible(db, user, { code });
  return toDto(row, viewer);
}

export async function listMyBookings(db: Db, user: SessionUser) {
  const rows = await db.query<Record<string, any>>(`${SELECT} where b.customer_id = $1 order by b.start_at desc limit 100`, [user.id]);
  return rows.map((r) => toDto(r, 'CUSTOMER'));
}

export async function listProviderBookings(db: Db, user: SessionUser) {
  const biz = await ownedBusiness(db, user);
  const rows = await db.query<Record<string, any>>(
    `${SELECT} where b.business_id = $1 and b.status not in ('EXPIRED') order by (b.start_at < now()), abs(extract(epoch from b.start_at - now())) limit 200`,
    [biz.id],
  );
  return rows.map((r) => toDto(r, 'PROVIDER'));
}

export async function createBooking(db: Db, user: SessionUser, input: { serviceId: string; staffId?: string; startAt: string; notes?: string }, now: Date) {
  const b = await createEngine(db).createBooking({ customerId: user.id, serviceId: input.serviceId, staffId: input.staffId, startAt: new Date(input.startAt), notes: input.notes }, now);
  return getBooking(db, user, b.code);
}

export async function customerAction(
  db: Db,
  user: SessionUser,
  code: string,
  action: string,
  body: { reason?: string; details?: string; rating?: number; comment?: string },
  now: Date,
) {
  const { row, viewer } = await loadVisible(db, user, { code });
  if (viewer !== 'CUSTOMER') throw new AppError('FORBIDDEN', 'only the customer can do that', 403);
  const engine = createEngine(db);
  switch (action) {
    case 'cancel':
      await engine.act(row.id, { type: 'CUSTOMER_CANCELLED' }, now, { actorId: user.id, reason: body.reason });
      break;
    case 'confirm':
      await engine.act(row.id, { type: 'CUSTOMER_CONFIRMED' }, now, { actorId: user.id });
      break;
    case 'dispute':
      await engine.openDispute(row.id, { openedBy: user.id, reason: body.reason!, details: body.details }, now);
      break;
    case 'review': {
      if (row.status !== 'VERIFIED') throw new AppError('INVALID_STATE', 'reviews open after the service is confirmed', 409);
      try {
        await db.query('insert into styra.reviews (booking_id, customer_id, business_id, rating, comment) values ($1, $2, $3, $4, $5)', [
          row.id,
          user.id,
          row.biz_id,
          body.rating,
          body.comment ?? null,
        ]);
      } catch (e) {
        if (/reviews_booking_id_key/.test(String((e as Error).message))) throw new AppError('ALREADY_REVIEWED', 'you already reviewed this booking', 409);
        throw e;
      }
      break;
    }
    default:
      throw new AppError('NOT_FOUND', 'unknown action', 404);
  }
  return getBooking(db, user, code);
}

const PROVIDER_EVENTS = { complete: 'PROVIDER_COMPLETED', 'no-show': 'PROVIDER_NO_SHOW', decline: 'PROVIDER_DECLINED', cancel: 'PROVIDER_CANCELLED' } as const;

export async function providerAction(db: Db, user: SessionUser, bookingId: string, action: string, body: { reason?: string }, now: Date) {
  const type = PROVIDER_EVENTS[action as keyof typeof PROVIDER_EVENTS];
  if (!type) throw new AppError('NOT_FOUND', 'unknown action', 404);
  const { row, viewer } = await loadVisible(db, user, { id: bookingId });
  if (viewer !== 'PROVIDER') throw new AppError('FORBIDDEN', 'only the business can do that', 403);
  await createEngine(db).act(row.id, { type }, now, { actorId: user.id, reason: body.reason });
  return getBooking(db, user, row.code);
}
