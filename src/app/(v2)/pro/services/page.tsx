import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { formatDuration } from '@/core/format';
import { Money, Section } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { listOwnServices } from '@/server/services/pro';
import { ProNav } from '../pro-nav';
import { ServiceForm } from './service-form';

export const dynamic = 'force-dynamic';

export default async function ProServices() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/pro/services');
  if (user.role !== 'PROVIDER') redirect('/pro');
  const services = await listOwnServices(getDb(), user);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-sans text-[28px] font-semibold normal-case">{t('pro.servicesTitle')}</h1>
        <ProNav active="services" />
      </div>
      {services.length > 0 && (
        <ul className="divide-y divide-[var(--hairline)] rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 p-4">
              <span>
                <span className="block text-[17px] font-semibold">{s.name}</span>
                <span className="block text-[15px] text-muted-foreground">{formatDuration(s.durationMin)}</span>
              </span>
              <Money minor={s.priceMinor} className="text-[17px] font-semibold" />
            </li>
          ))}
        </ul>
      )}
      <Section title={t('actions.addService')}>
        <ServiceForm />
      </Section>
    </div>
  );
}
