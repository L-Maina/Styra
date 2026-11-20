import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { formatMoney } from '@/core/money';
import { Section, StatusPill } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { ledgerOverview, listBusinessesForReview } from '@/server/services/admin';
import { ApproveButton } from './approve-button';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/admin');
  if (user.role !== 'ADMIN') redirect('/');
  const db = getDb();
  const [pending, ledger] = await Promise.all([listBusinessesForReview(db), ledgerOverview(db)]);
  return (
    <div className="space-y-10">
      <h1 className="font-sans text-[28px] font-bold normal-case">{t('admin.title')}</h1>
      <Section title={t('admin.pendingBusinesses')}>
        {pending.length ? (
          <ul className="space-y-3">
            {pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                <span>
                  <span className="block text-[17px] font-semibold">{b.name}</span>
                  <span className="block text-[15px] text-muted-foreground">
                    {t(`browse.category.${b.category}` as never)} · {b.address ?? b.city} · {b.ownerName}
                  </span>
                </span>
                <ApproveButton id={b.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted-foreground">{t('admin.noPending')}</p>
        )}
      </Section>
      <Section title={t('admin.ledgerTitle')} action={<StatusPill tone={ledger.balanced ? 'good' : 'warning'}>{ledger.balanced ? t('admin.balanced') : t('admin.unbalanced')}</StatusPill>}>
        <table className="w-full overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] text-[15px]">
          <tbody className="divide-y divide-[var(--hairline)]">
            {ledger.accounts
              .filter((a) => a.kind !== 'ESCROW' || a.balanceMinor !== 0)
              .map((a) => (
                <tr key={`${a.kind}-${a.businessId ?? ''}`}>
                  <th scope="row" className="p-4 text-left font-semibold">
                    {t(`admin.accounts.${String(a.kind)}` as never)}
                    {a.businessName ? <span className="block font-normal text-muted-foreground">{String(a.businessName)}</span> : null}
                  </th>
                  <td className="p-4 text-right tabular-nums">{formatMoney(BigInt(a.balanceMinor), { style: 'code' })}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
