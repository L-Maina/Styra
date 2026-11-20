import { createBookingInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { createBooking, listMyBookings } from '@/server/services/bookings';

export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req);
  return ok({ booking: await createBooking(db, user, await readJson(req, createBookingInput), new Date()) }, 201);
});

export const GET = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req);
  return ok({ items: await listMyBookings(db, user) });
});
