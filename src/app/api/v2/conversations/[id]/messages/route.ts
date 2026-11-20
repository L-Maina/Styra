import { sendMessageInput } from '@/contracts/booking';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, readJson, route } from '@/server/http';
import { readMessages, sendMessage } from '@/server/services/messages';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const db = getDb();
  const user = await requireUser(db, req);
  const after = new URL(req.url).searchParams.get('after') ?? undefined;
  return ok({ messages: await readMessages(db, user, id, after) });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const db = getDb();
  const user = await requireUser(db, req);
  const { body } = await readJson(req, sendMessageInput);
  return ok({ message: await sendMessage(db, user, id, body) }, 201);
});
