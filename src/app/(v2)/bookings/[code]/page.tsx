import { notFound, redirect } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { t } from '@/core/copy';
import { AppError } from '@/core/errors';
import { formatDateTime, formatDuration } from '@/core/format';
import type { BookingStatus as Status } from '@/core/statuses';
import { BookingStatus } from '@/components/v2/booking-bits';
import { Money } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { getBooking } from '@/server/services/bookings';
import { BookingActions } from './booking-actions';

export const dynamic = 'force-dynamic';

export default async function BookingDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/bookings/${code}`);
  let b;
  try {
    b = await getBooking(getDb(), user, code);
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  const status = b.status as Status;
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-40">
      <div className="space-y-2">
        <p className="text-[15px] text-muted-foreground tabular-nums">{t('detail.title', { code: b.code })}</p>
        <h1 className="font-[family-name:var(--font-syne)] text-[30px] font-bold uppercase leading-none tracking-[-0.015em]">{b.business.name}</h1>
        <BookingStatus status={status} />
      </div>

      {status === 'COMPLETED' && b.autoConfirmAt && (
        <p className="rounded-3xl bg-[var(--surface-1)] p-4 text-[17px]">{t('detail.afterService', { business: b.business.name, time: formatDateTime(new Date(b.autoConfirmAt)) })}</p>
      )}
      {status === 'DISPUTED' && <p className="rounded-3xl bg-[var(--surface-1)] p-4 text-[17px]">{t('detail.problemReported')}</p>}
      {status === 'VERIFIED' && <p className="rounded-3xl bg-[var(--surface-1)] p-4 text-[17px]">{t('detail.serviceConfirmed', { business: b.business.name })}</p>}
      {status === 'CONFIRMED' && <p className="rounded-3xl bg-[var(--surface-1)] p-4 text-[17px]">{t('booking.confirmed.body')}</p>}

      <dl className="divide-y divide-[var(--hairline)] rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('detail.service')}</dt>
          <dd className="text-right font-semibold">
            {b.service.name} · {formatDuration(b.service.durationMin)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('detail.when')}</dt>
          <dd className="text-right font-semibold tabular-nums">{formatDateTime(new Date(b.startAt))}</dd>
        </div>
        {b.business.address && (
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{t('detail.where')}</dt>
            <dd className="flex items-center gap-1 text-right font-semibold">
              <MapPin aria-hidden className="size-4" />
              {b.business.address}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('detail.total')}</dt>
          <dd>
            <Money minor={b.priceMinor} className="text-[19px] font-semibold" />
          </dd>
        </div>
        {b.refund && (
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{b.refund.status === 'PAID' ? t('money.refunded') : t('money.refundOnItsWay')}</dt>
            <dd>
              <Money minor={b.refund.amountMinor} className="font-semibold" />
            </dd>
          </div>
        )}
      </dl>
      <p className="text-[13px] text-muted-foreground">{t('money.paymentProtection')}</p>

      <BookingActions booking={b} />
    </div>
  );
}
