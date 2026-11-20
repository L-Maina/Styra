import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { getOwnAvailability } from '@/server/services/pro';
import { ProNav } from '../pro-nav';
import { HoursEditor } from './hours-editor';

export const dynamic = 'force-dynamic';

export default async function ProHours() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/pro/hours');
  if (user.role !== 'PROVIDER') redirect('/pro');
  const { rules } = await getOwnAvailability(getDb(), user);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-sans text-[28px] font-bold normal-case">{t('pro.hoursTitle')}</h1>
        <ProNav active="hours" />
      </div>
      <HoursEditor initial={rules} />
    </div>
  );
}
