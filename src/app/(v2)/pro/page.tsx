import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { DISPLAY_TIME_ZONE, formatDateTime, formatTime } from '@/core/format';
import type { BookingStatus as Status } from '@/core/statuses';
import { BookingStatus } from '@/components/v2/booking-bits';
import { EmptyState, Money, Section } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { listProviderBookings } from '@/server/services/bookings';
import { getOwnBusiness } from '@/server/services/pro';
import { AppError } from '@/core/errors';
import { BookingRowActions } from './booking-row-actions';
import { CopyLink } from './copy-link';
import { ProNav } from './pro-nav';
import { SetupForm } from './setup-form';
import type { BookingDto } from '@/contracts/booking';

export const dynamic = 'force-dynamic';

function Row({ b, timeOnly }: { b: BookingDto; timeOnly?: boolean }) {
  return (
    <li className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold tabular-nums">{timeOnly ? formatTime(new Date(b.startAt)) : formatDateTime(new Date(b.startAt))}</p>
          <p className="text-[15px]">
            {b.service.name} · {b.customer.name}
          </p>
        </div>
        <Money minor={b.priceMinor} className="text-[17px] font-semibold" />
      </div>
      <div className="mt-2">
        <BookingStatus status={b.status as Status} viewer="PROVIDER" />
      </div>
      <BookingRowActions id={b.id} actions={b.actions} />
    </li>
  );
}

export default async function ProHome() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/pro');
  const db = getDb();
  let business: Record<string, unknown> | null = null;
  try {
    business = await getOwnBusiness(db, user);
  } catch (e) {
    if (!(e instanceof AppError && e.code === 'NO_BUSINESS')) throw e;
  }
  if (!business) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-4">
        <h1 className="font-[family-name:var(--font-syne)] text-[34px] font-bold uppercase leading-none">{t('pro.setupTitle')}</h1>
        <p className="text-[17px]">{t('pro.setupLead')}</p>
        <SetupForm />
      </div>
    );
  }
  const items = await listProviderBookings(db, user);
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: DISPLAY_TIME_ZONE });
  const isToday = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: DISPLAY_TIME_ZONE }) === todayKey;
  const open = items.filter((b) => ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DISPUTED'].includes(b.status));
  const today = open.filter((b) => isToday(b.startAt));
  const upcoming = open.filter((b) => !isToday(b.startAt) && new Date(b.startAt) > new Date());
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-syne)] text-[30px] font-bold uppercase leading-none">{String(business.name)}</h1>
        <ProNav active="today" />
      </div>
      {business.status !== 'ACTIVE' && <p className="rounded-3xl bg-[var(--surface-1)] p-4 text-[17px]">{t('pro.pendingReview')}</p>}
      <Section title={t('pro.today')}>
        {today.length ? (
          <ul className="space-y-3">{today.map((b) => <Row key={b.id} b={b} timeOnly />)}</ul>
        ) : (
          <EmptyState title={t('empty.providerDayTitle')} body={t('empty.providerDayBody')} action={<CopyLink path={`/b/${String(business.slug)}`} />} />
        )}
      </Section>
      {upcoming.length > 0 && (
        <Section title={t('pro.upcoming')}>
          <ul className="space-y-3">{upcoming.map((b) => <Row key={b.id} b={b} />)}</ul>
        </Section>
      )}
    </div>
  );
}
