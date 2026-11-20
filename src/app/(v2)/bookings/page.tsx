import Link from 'next/link';
import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { formatDateTime } from '@/core/format';
import type { BookingStatus as Status } from '@/core/statuses';
import { BookingStatus } from '@/components/v2/booking-bits';
import { ButtonLink, EmptyState, Money, Section } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { listMyBookings } from '@/server/services/bookings';
import type { BookingDto } from '@/contracts/booking';

export const dynamic = 'force-dynamic';
const ACTIVE = new Set(['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DISPUTED']);

function BookingList({ list }: { list: BookingDto[] }) {
  return (
    <ul className="space-y-3">
      {list.map((b) => (
        <li key={b.code}>
          <Link href={`/bookings/${b.code}`} className="press block rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold">{b.business.name}</p>
                <p className="text-[15px] text-muted-foreground">{b.service.name}</p>
                <p className="text-[15px] tabular-nums">{formatDateTime(new Date(b.startAt))}</p>
              </div>
              <Money minor={b.priceMinor} className="text-[17px] font-semibold" />
            </div>
            <div className="mt-3">
              <BookingStatus status={b.status as Status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function Bookings() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/bookings');
  const items = await listMyBookings(getDb(), user);
  const upcoming = items.filter((b) => ACTIVE.has(b.status)).reverse();
  const past = items.filter((b) => !ACTIVE.has(b.status));
  return (
    <div className="space-y-10">
      <h1 className="text-[28px] font-bold font-sans normal-case tracking-[-0.01em]">{t('nav.bookings')}</h1>
      {items.length === 0 ? (
        <EmptyState title={t('empty.bookingsTitle')} body={t('empty.bookingsBody')} action={<ButtonLink href="/explore">{t('actions.browse')}</ButtonLink>} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title={t('pro.upcoming')}>
              <BookingList list={upcoming} />
            </Section>
          )}
          {past.length > 0 && (
            <Section title={t('pro.past')}>
              <BookingList list={past} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
