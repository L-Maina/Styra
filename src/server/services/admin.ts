import { AppError } from '../../core/errors';
import type { SessionUser } from '../auth';
import type { Db } from '../db';
import { n } from './common';

export async function approveBusiness(db: Db, admin: SessionUser, businessId: string) {
  const [b] = await db.query<Record<string, unknown>>(
    `update styra.businesses set status = 'ACTIVE' where id = $1 and status in ('DRAFT', 'PENDING_REVIEW', 'SUSPENDED')
     returning id, slug, name, status`,
    [businessId],
  );
  if (!b) throw new AppError('NOT_FOUND', 'business not found or already active', 404);
  await db.query(`insert into styra.audit_log (actor_id, action, entity, entity_id) values ($1, 'BUSINESS_APPROVED', 'business', $2)`, [admin.id, businessId]);
  return b;
}

export async function ledgerOverview(db: Db) {
  const rows = await db.query<Record<string, unknown>>(
    `select a.kind, a.business_id, b.name as business_name, a.currency, coalesce(sum(e.amount_minor), 0) as total
       from styra.ledger_accounts a
       left join styra.ledger_entries e on e.account_id = a.id
       left join styra.businesses b on b.id = a.business_id
      group by a.id, a.kind, a.business_id, b.name, a.currency
      order by a.kind, b.name nulls first`,
  );
  const [{ grand }] = await db.query<{ grand: unknown }>('select coalesce(sum(amount_minor), 0) as grand from styra.ledger_entries');
  return {
    balanced: n(grand) === 0,
    accounts: rows.map((r) => ({
      kind: r.kind,
      businessId: r.business_id,
      businessName: r.business_name,
      currency: String(r.currency).trim(),
      // Assets (PSP clearing) show the debit balance; liabilities show -sum.
      balanceMinor: r.kind === 'PSP_CLEARING' ? n(r.total) : -n(r.total),
    })),
  };
}
