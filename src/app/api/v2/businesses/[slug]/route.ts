import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { getBusinessPage } from '@/server/services/discovery';

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { slug } = await params;
  return ok({ business: await getBusinessPage(getDb(), slug) });
});
