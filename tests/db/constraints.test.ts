import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { SQL } from 'bun';
import { dbReachable, fixtures, freshDb, type TestDb } from './harness';
import * as S from '../../src/core/statuses';

const reachable = await dbReachable();

describe.skipIf(!reachable)('database money rules (real Postgres)', () => {
  let db: TestDb;
  let sql: SQL;
  let f: ReturnType<typeof fixtures>;
  let ctx: { customer: string; biz: { id: string; staffId: string }; service: string };

  beforeAll(async () => {
    db = await freshDb();
    sql = db.sql;
    f = fixtures(sql);
    const owner = await f.user('PROVIDER');
    const biz = await f.business(owner);
    ctx = { customer: await f.user(), biz, service: await f.service(biz.id) };
  });
  afterAll(async () => db && (await db.drop()));

  let hour = 0;
  const nextStart = () => new Date(Date.UTC(2027, 0, 1, 6 + hour++)).toISOString();
  const newBooking = (extra: Partial<{ start: string; price: bigint; status: string; staffId: string; minutes: number }> = {}) =>
    f.booking({ customerId: ctx.customer, businessId: ctx.biz.id, staffId: extra.staffId ?? ctx.biz.staffId, serviceId: ctx.service, start: extra.start ?? nextStart(), ...extra });

  /** Captures P into escrow for a booking and marks it CONFIRMED/HELD, in one transaction. */
  async function capture(bookingId: string, amount = 150000n, key = `capture:${bookingId}`) {
    const clearing = await f.account('PSP_CLEARING');
    const escrow = await f.account('ESCROW');
    await sql.begin(async (tx) => {
      const [j] = await tx`insert into styra.journals (kind, idempotency_key, booking_id) values ('CAPTURE', ${key}, ${bookingId}) returning id`;
      await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, ${amount})`;
      await tx`insert into styra.ledger_entries (journal_id, account_id, booking_id, amount_minor) values (${j.id}, ${escrow}, ${bookingId}, ${-amount})`;
      await tx`update styra.bookings set status = 'CONFIRMED', escrow_state = 'HELD', confirmed_at = now() where id = ${bookingId}`;
    });
  }

  test('a valid capture commits and the book stays balanced', async () => {
    const b = await newBooking();
    await capture(b);
    const [{ total }] = await sql`select coalesce(sum(amount_minor), 0)::text as total from styra.ledger_entries`;
    expect(total).toBe('0');
  });

  test('R2: an unbalanced journal is rejected at commit', async () => {
    const clearing = await f.account('PSP_CLEARING');
    const rev = await f.account('PLATFORM_REVENUE');
    await expect(
      sql.begin(async (tx) => {
        const [j] = await tx`insert into styra.journals (kind, idempotency_key) values ('ADJUSTMENT', 'r2-unbalanced') returning id`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, 100)`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${rev}, -99)`;
      }),
    ).rejects.toThrow(/balance|sum/i);
  });

  test('R2: a journal with no lines, or one line, is rejected', async () => {
    const clearing = await f.account('PSP_CLEARING');
    await expect(sql.begin(async (tx) => { await tx`insert into styra.journals (kind, idempotency_key) values ('ADJUSTMENT', 'r2-empty')`; })).rejects.toThrow(/line/i);
    await expect(
      sql.begin(async (tx) => {
        const [j] = await tx`insert into styra.journals (kind, idempotency_key) values ('ADJUSTMENT', 'r2-one') returning id`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, 0)`;
      }),
    ).rejects.toThrow();
  });

  test('R3: ledger rows cannot be updated, deleted or truncated', async () => {
    await expect(sql`update styra.ledger_entries set amount_minor = amount_minor * 2`).rejects.toThrow(/append-only/);
    await expect(sql`delete from styra.ledger_entries`).rejects.toThrow(/append-only/);
    await expect(sql`update styra.journals set memo = 'x'`).rejects.toThrow(/append-only/);
    await expect(sql`delete from styra.journals`).rejects.toThrow(/append-only/);
    await expect(sql`truncate styra.ledger_entries`).rejects.toThrow(/append-only/);
  });

  test('R4: the same idempotency key cannot post twice', async () => {
    const b = await newBooking();
    await capture(b, 150000n, 'dup-key');
    const b2 = await newBooking();
    await expect(capture(b2, 150000n, 'dup-key')).rejects.toThrow(/duplicate|unique/i);
  });

  test('R5: escrow, provider balance, payout and refund balances cannot go negative', async () => {
    const clearing = await f.account('PSP_CLEARING');
    for (const kind of ['PROVIDER_BALANCE', 'PAYOUT_PENDING', 'REFUND_PENDING', 'PLATFORM_REVENUE']) {
      const acct = await f.account(kind, kind === 'PROVIDER_BALANCE' ? ctx.biz.id : null);
      await expect(
        sql.begin(async (tx) => {
          const [j] = await tx`insert into styra.journals (kind, idempotency_key) values ('ADJUSTMENT', ${`r5-${kind}`}) returning id`;
          await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${acct}, 500)`;
          await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, -500)`;
        }),
      ).rejects.toThrow(/negative/i);
    }
    const b = await newBooking();
    const escrow = await f.account('ESCROW');
    await expect(
      sql.begin(async (tx) => {
        const [j] = await tx`insert into styra.journals (kind, idempotency_key) values ('ADJUSTMENT', 'r5-escrow') returning id`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, booking_id, amount_minor) values (${j.id}, ${escrow}, ${b}, 500)`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, -500)`;
      }),
    ).rejects.toThrow(/negative|escrow/i);
  });

  test('ESCROW lines must name a booking', async () => {
    const clearing = await f.account('PSP_CLEARING');
    const escrow = await f.account('ESCROW');
    await expect(
      sql.begin(async (tx) => {
        const [j] = await tx`insert into styra.journals (kind, idempotency_key) values ('ADJUSTMENT', 'escrow-no-booking') returning id`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, 10)`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${escrow}, -10)`;
      }),
    ).rejects.toThrow(/booking/i);
  });

  test('R6: a booking marked HELD without a capture is rejected', async () => {
    const b = await newBooking();
    await expect(sql`update styra.bookings set status = 'CONFIRMED', escrow_state = 'HELD' where id = ${b}`).rejects.toThrow(/escrow/i);
  });

  test('R6: a capture without updating the booking is rejected', async () => {
    const b = await newBooking();
    const clearing = await f.account('PSP_CLEARING');
    const escrow = await f.account('ESCROW');
    await expect(
      sql.begin(async (tx) => {
        const [j] = await tx`insert into styra.journals (kind, idempotency_key, booking_id) values ('CAPTURE', ${`orphan-${b}`}, ${b}) returning id`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, amount_minor) values (${j.id}, ${clearing}, 150000)`;
        await tx`insert into styra.ledger_entries (journal_id, account_id, booking_id, amount_minor) values (${j.id}, ${escrow}, ${b}, -150000)`;
      }),
    ).rejects.toThrow(/escrow/i);
  });

  test('R6: a capture for less than the price is rejected', async () => {
    const b = await newBooking();
    await expect(capture(b, 100000n)).rejects.toThrow(/escrow/i);
  });

  test('status and escrow state must be an allowed pair', async () => {
    const b = await newBooking();
    await expect(sql`update styra.bookings set status = 'VERIFIED' where id = ${b}`).rejects.toThrow(/check|escrow/i);
  });

  test('R9: price and parties are frozen once money is held', async () => {
    const b = await newBooking();
    await capture(b);
    await expect(sql`update styra.bookings set price_minor = 1 where id = ${b}`).rejects.toThrow(/frozen/i);
    const other = await f.user();
    await expect(sql`update styra.bookings set customer_id = ${other} where id = ${b}`).rejects.toThrow(/frozen/i);
    await expect(sql`update styra.bookings set start_at = start_at + interval '1 hour', end_at = end_at + interval '1 hour' where id = ${b}`).rejects.toThrow(/frozen/i);
    await sql`update styra.bookings set notes = 'Window seat' where id = ${b}`; // other fields stay editable
  });

  test('R8: overlapping PENDING/CONFIRMED bookings for one staff member are rejected', async () => {
    const start = '2027-02-01T08:00:00.000Z';
    await newBooking({ start, minutes: 60 });
    await expect(newBooking({ start: '2027-02-01T08:30:00.000Z', minutes: 30 })).rejects.toThrow(/overlap|exclusion|conflicting/i);
  });

  test('R8: adjacent bookings, and overlaps with a cancelled booking, are accepted', async () => {
    await newBooking({ start: '2027-03-01T08:00:00.000Z', minutes: 60 });
    await newBooking({ start: '2027-03-01T09:00:00.000Z', minutes: 30 });
    const c = await newBooking({ start: '2027-03-02T08:00:00.000Z', minutes: 60 });
    await sql`update styra.bookings set status = 'CANCELLED', cancelled_at = now() where id = ${c}`;
    await newBooking({ start: '2027-03-02T08:15:00.000Z', minutes: 30 });
  });

  test('every business gets a "Main chair" staff row', async () => {
    const owner = await f.user('PROVIDER');
    const b = await f.business(owner);
    const rows = await sql`select name from styra.staff where business_id = ${b.id}`;
    expect(rows.map((r: { name: string }) => r.name)).toEqual(['Main chair']);
  });

  test('reviews keep the business rating up to date', async () => {
    const owner = await f.user('PROVIDER');
    const biz = await f.business(owner);
    const svc = await f.service(biz.id);
    for (const rating of [5, 4]) {
      const b = await f.booking({ customerId: ctx.customer, businessId: biz.id, staffId: biz.staffId, serviceId: svc, start: nextStart() });
      await sql`insert into styra.reviews (booking_id, customer_id, business_id, rating) values (${b}, ${ctx.customer}, ${biz.id}, ${rating})`;
    }
    const [r] = await sql`select rating_avg::text, rating_count from styra.businesses where id = ${biz.id}`;
    expect(r).toEqual({ rating_avg: '4.50', rating_count: 2 });
  });

  test('settings are seeded with the blueprint values', async () => {
    const rows = await sql`select key, value from styra.settings order by key`;
    const m = Object.fromEntries(rows.map((r: { key: string; value: unknown }) => [r.key, r.value]));
    expect(m).toMatchObject({ commission_bps: 1000, verification_window_hours: 24, hold_minutes: 15, payout_min_minor: 10000 });
    expect(m.cancellation_policy).toEqual([{ hoursBefore: 24, refundBps: 10000 }, { hoursBefore: 4, refundBps: 5000 }, { hoursBefore: 0, refundBps: 0 }]);
  });

  test('TypeScript status lists equal the CHECK lists in the database', async () => {
    const checks: [string, readonly string[]][] = [
      ['bookings_status_check', S.BOOKING_STATUSES], ['bookings_escrow_state_check', S.ESCROW_STATES],
      ['users_role_check', S.USER_ROLES], ['users_status_check', S.USER_STATUSES], ['businesses_status_check', S.BUSINESS_STATUSES],
      ['payments_provider_check', S.PAYMENT_PROVIDERS], ['payments_status_check', S.PAYMENT_STATUSES],
      ['ledger_accounts_kind_check', S.ACCOUNT_KINDS], ['journals_kind_check', S.JOURNAL_KINDS],
      ['refunds_status_check', S.REFUND_STATUSES], ['payouts_status_check', S.PAYOUT_STATUSES], ['payouts_method_check', S.PAYOUT_METHODS],
      ['disputes_status_check', S.DISPUTE_STATUSES], ['disputes_outcome_check', S.DISPUTE_OUTCOMES],
    ];
    for (const [name, list] of checks) {
      const [row] = await sql`select pg_get_constraintdef(c.oid) as def from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'styra' and c.conname = ${name}`;
      expect(row, name).toBeDefined();
      const values = [...row.def.matchAll(/'([A-Z_]+)'::/g)].map((m: RegExpMatchArray) => m[1]);
      expect([...values].sort(), name).toEqual([...list].sort());
    }
  });

  test('RLS is enabled on every styra table', async () => {
    const rows = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'styra' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r: { relname: string }) => r.relname)).toEqual([]);
  });
});
