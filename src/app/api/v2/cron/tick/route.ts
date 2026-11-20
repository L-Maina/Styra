import { AppError } from '@/core/errors';
import { createEngine } from '@/server/booking-engine';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';

const tick = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) throw new AppError('UNAUTHENTICATED', 'cron secret required', 401);
  return ok(await createEngine(getDb()).tick(new Date()));
});
// Supabase pg_net posts; Vercel cron sends GET.
export const POST = tick;
export const GET = tick;
