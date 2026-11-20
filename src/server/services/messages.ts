import { AppError } from '../../core/errors';
import type { SessionUser } from '../auth';
import type { Db } from '../db';
import { iso, n } from './common';

type Viewer = 'CUSTOMER' | 'BUSINESS';

/** The conversation if the user is one of its two parties, with which side they are on. Others get NOT_FOUND. */
async function participant(db: Db, user: SessionUser, id: string): Promise<{ id: string; viewer: Viewer }> {
  const [c] = await db.query<{ id: string; customer_id: string; owner_id: string }>(
    `select c.id, c.customer_id, b.owner_id from styra.conversations c join styra.businesses b on b.id = c.business_id where c.id = $1`,
    [id],
  );
  if (!c) throw new AppError('NOT_FOUND', 'conversation not found', 404);
  if (c.customer_id === user.id) return { id: c.id, viewer: 'CUSTOMER' };
  if (c.owner_id === user.id) return { id: c.id, viewer: 'BUSINESS' };
  throw new AppError('NOT_FOUND', 'conversation not found', 404);
}

const SUMMARY = `
  select c.id, c.last_message_at, c.customer_read_at, c.business_read_at, c.customer_id,
         b.id as business_id, b.name as business_name, b.slug, b.category, b.owner_id,
         (select p.url from styra.business_photos p where p.business_id = b.id and p.kind = 'LOGO') as logo_url,
         u.name as customer_name,
         lm.body as last_body, lm.sender_id as last_sender, lm.created_at as last_at
    from styra.conversations c
    join styra.businesses b on b.id = c.business_id
    join styra.users u on u.id = c.customer_id
    left join lateral (select body, sender_id, created_at from styra.messages m where m.conversation_id = c.id order by created_at desc limit 1) lm on true`;

function summary(r: Record<string, any>, userId: string, unread: number) {
  const viewer: Viewer = r.customer_id === userId ? 'CUSTOMER' : 'BUSINESS';
  return {
    id: String(r.id),
    viewer,
    business: { id: String(r.business_id), name: String(r.business_name), slug: String(r.slug), category: String(r.category), logoUrl: r.logo_url == null ? null : String(r.logo_url) },
    counterpart: viewer === 'CUSTOMER' ? { name: String(r.business_name) } : { name: String(r.customer_name) },
    lastMessage: r.last_body == null ? null : { body: String(r.last_body), mine: r.last_sender === userId, createdAt: iso(r.last_at) },
    unread,
  };
}

async function unreadFor(db: Db, convoId: string, viewer: Viewer, userId: string): Promise<number> {
  const [row] = await db.query<{ n: unknown }>(
    `select count(*) as n from styra.messages m join styra.conversations c on c.id = m.conversation_id
      where c.id = $1 and m.sender_id <> $2 and m.created_at > coalesce(${viewer === 'CUSTOMER' ? 'c.customer_read_at' : 'c.business_read_at'}, '-infinity')`,
    [convoId, userId],
  );
  return n(row.n);
}

export async function startConversation(db: Db, user: SessionUser, input: { businessSlug: string; bookingCode?: string }) {
  const [biz] = await db.query<{ id: string; owner_id: string }>(`select id, owner_id from styra.businesses where slug = $1 and status = 'ACTIVE'`, [input.businessSlug]);
  if (!biz) throw new AppError('NOT_FOUND', 'business not found', 404);
  if (biz.owner_id === user.id) throw new AppError('INVALID_STATE', 'you cannot message your own business', 409);
  const bookingId = input.bookingCode
    ? (await db.query<{ id: string }>('select id from styra.bookings where code = $1 and customer_id = $2 and business_id = $3', [input.bookingCode, user.id, biz.id]))[0]?.id ?? null
    : null;
  const [row] = await db.query<{ id: string }>(
    `insert into styra.conversations (customer_id, business_id, booking_id) values ($1, $2, $3)
     on conflict (customer_id, business_id) do update set booking_id = coalesce(excluded.booking_id, styra.conversations.booking_id)
     returning id`,
    [user.id, biz.id, bookingId],
  );
  const [r] = await db.query<Record<string, any>>(`${SUMMARY} where c.id = $1`, [row.id]);
  return summary(r, user.id, await unreadFor(db, row.id, 'CUSTOMER', user.id));
}

export async function listConversations(db: Db, user: SessionUser) {
  const rows = await db.query<Record<string, any>>(`${SUMMARY} where c.customer_id = $1 or b.owner_id = $1 order by coalesce(c.last_message_at, c.created_at) desc limit 100`, [user.id]);
  return Promise.all(rows.map(async (r) => summary(r, user.id, await unreadFor(db, String(r.id), r.customer_id === user.id ? 'CUSTOMER' : 'BUSINESS', user.id))));
}

export async function getConversation(db: Db, user: SessionUser, id: string) {
  await participant(db, user, id);
  const [r] = await db.query<Record<string, any>>(`${SUMMARY} where c.id = $1`, [id]);
  return summary(r, user.id, 0);
}

/** Messages in a thread (optionally only those after a timestamp, for polling). Reading marks the thread read. */
export async function readMessages(db: Db, user: SessionUser, id: string, after?: string) {
  const { viewer } = await participant(db, user, id);
  const rows = await db.query<Record<string, unknown>>(
    `select id, sender_id, body, created_at from styra.messages where conversation_id = $1 and ($2::timestamptz is null or date_trunc('milliseconds', created_at) > $2::timestamptz) order by created_at limit 500`,
    [id, after ?? null],
  );
  await db.query(`update styra.conversations set ${viewer === 'CUSTOMER' ? 'customer_read_at' : 'business_read_at'} = now() where id = $1`, [id]);
  return rows.map((m) => ({ id: String(m.id), body: String(m.body), mine: m.sender_id === user.id, createdAt: iso(m.created_at)! }));
}

export async function sendMessage(db: Db, user: SessionUser, id: string, body: string) {
  const { viewer } = await participant(db, user, id);
  return db.transaction(async (tx) => {
    const [m] = await tx.query<Record<string, unknown>>(`insert into styra.messages (conversation_id, sender_id, body) values ($1, $2, $3) returning id, body, created_at`, [id, user.id, body.trim()]);
    await tx.query(
      `update styra.conversations set last_message_at = $2, ${viewer === 'CUSTOMER' ? 'customer_read_at' : 'business_read_at'} = $2 where id = $1`,
      [id, m.created_at],
    );
    await tx.query(`insert into styra.outbox (topic, payload) values ('message.sent', $1)`, [JSON.stringify({ conversationId: id, messageId: m.id, from: viewer })]);
    return { id: String(m.id), body: String(m.body), mine: true, createdAt: iso(m.created_at)! };
  });
}

/** Total unread messages for the top bar badge. */
export async function unreadTotal(db: Db, user: SessionUser): Promise<number> {
  const [row] = await db.query<{ n: unknown }>(
    `select count(*) as n from styra.messages m
       join styra.conversations c on c.id = m.conversation_id
       join styra.businesses b on b.id = c.business_id
      where m.sender_id <> $1
        and ((c.customer_id = $1 and m.created_at > coalesce(c.customer_read_at, '-infinity'))
          or (b.owner_id = $1 and m.created_at > coalesce(c.business_read_at, '-infinity')))`,
    [user.id],
  );
  return n(row.n);
}
