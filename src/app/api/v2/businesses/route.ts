import { businessListQuery } from '@/contracts/booking';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { listBusinesses } from '@/server/services/discovery';

export const GET = route(async (req) => {
  const q = businessListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listBusinesses(getDb(), q));
});
