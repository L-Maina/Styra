import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { formatDate } from '@/core/format';
import { Money, Section, StatusPill } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { earnings } from '@/server/services/money';
import { ProNav } from '../pro-nav';
import { PayoutForm } from './payout-form';

export const dynamic = 'force-dynamic';

export default async function ProEarnings() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/pro/earnings');
  if (user.role !== 'PROVIDER') redirect('/pro');
  const e = await earnings(getDb(), user);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-sans text-[28px] font-bold normal-case">{t('pro.earningsTitle')}</h1>
        <ProNav active="earnings" />
      </div>
      <p className="max-w-2xl text-[15px] text-muted-foreground">{t('pro.earningsLead')}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
          <dt className="text-[15px]">{t('money.available')}</dt>
          <dd><Money minor={e.availableMinor} className="text-[34px] font-bold" /></dd>
        </div>
        <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
          <dt className="text-[15px]">{t('money.held')}</dt>
          <dd><Money minor={e.heldMinor} className="text-[34px] font-bold" /></dd>
        </div>
      </dl>
      <Section title={t('actions.requestPayout')}>
        <PayoutForm availableMinor={e.availableMinor} />
      </Section>
      <Section title={t('pro.payoutHistory')}>
        {e.payouts.length ? (
          <ul className="divide-y divide-[var(--hairline)] rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
            {e.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span>
                  <Money minor={p.amountMinor} className="block text-[17px] font-semibold" />
                  <span className="block text-[15px] text-muted-foreground">{p.destination} · {formatDate(new Date(p.createdAt!))}</span>
                </span>
                <StatusPill tone={p.status === 'PAID' ? 'good' : p.status === 'FAILED' ? 'warning' : 'neutral'}>{t(`pro.payoutStatus.${p.status}` as never)}</StatusPill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted-foreground">{t('pro.noPayouts')}</p>
        )}
      </Section>
    </div>
  );
}
