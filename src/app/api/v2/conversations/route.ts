import { startConversationInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { listConversations, startConversation } from '@/server/services/messages';

export const GET = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req);
  return ok({ items: await listConversations(db, user) });
});

export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req);
  return ok({ conversation: await startConversation(db, user, await readJson(req, startConversationInput)) }, 201);
});
