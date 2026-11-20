import { slotsQuery } from '@/contracts/booking';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { getSlots } from '@/server/services/discovery';

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { slug } = await params;
  const q = slotsQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await getSlots(getDb(), slug, q, new Date()));
});
