import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, Phone, Star } from 'lucide-react';
import { t } from '@/core/copy';
import { formatDuration, formatPhone, formatRating } from '@/core/format';
import { AppError } from '@/core/errors';
import { Cover } from '@/components/v2/cover';
import { Money, Section } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { fakePaymentsEnabled } from '@/server/payments/provider';
import { getBusinessPage } from '@/server/services/discovery';
import { BookingFlow } from './booking-flow';

export const dynamic = 'force-dynamic';

/** "08:00" -> "8:00 am" (wall time, no time zone shift). */
const wall = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

async function load(slug: string) {
  try {
    return await getBusinessPage(getDb(), slug);
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await load((await params).slug);
  return { title: `${b.name} · Styra`, description: b.description ?? t('brand.metaDescription') };
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await load((await params).slug);
  const user = await currentUser();
  const hoursByDay = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: d, ranges: b.hours.filter((h) => h.weekday === d) }));
  return (
    <div className="pb-28">
      <div className="relative -mx-4 -mt-24 md:mx-0 md:mt-0">
        <Cover name={b.name} category={b.category} size="hero" className="h-[42vh] min-h-[280px] w-full md:h-[360px] md:rounded-[32px]" />
      </div>
      <header className="space-y-2 pt-6">
        <h1 className="font-[family-name:var(--font-syne)] text-[34px] font-bold uppercase leading-none tracking-[-0.015em] md:text-[48px]">{b.name}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
          <span className="flex items-center gap-1 tabular-nums">
            <Star aria-hidden className="size-4 fill-current" />
            {formatRating(b.rating.avg, b.rating.count)}
          </span>
          <span className="text-muted-foreground">{t(`browse.category.${b.category}` as never)}</span>
          {b.address && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin aria-hidden className="size-4" />
              {b.address}
            </span>
          )}
        </p>
        {b.description && <p className="max-w-2xl pt-2 text-[17px] leading-relaxed">{b.description}</p>}
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <BookingFlow
            business={{ slug: b.slug, name: b.name, category: b.category }}
            services={b.services}
            signedIn={Boolean(user)}
            testPayments={fakePaymentsEnabled()}
          />
          <Section title={t('business.reviews')}>
            {b.reviews.length ? (
              <ul className="divide-y divide-[var(--hairline)] overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
                {b.reviews.map((r, i) => (
                  <li key={i} className="space-y-1 p-4">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                      <span className="tabular-nums">{'★'.repeat(r.rating)}</span>
                      <span>{r.author}</span>
                    </p>
                    {r.comment && <p className="text-[15px]">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-muted-foreground">{t('business.noReviews')}</p>
            )}
          </Section>
        </div>
        <aside className="space-y-6">
          <Section title={t('business.hours')}>
            <dl className="divide-y divide-[var(--hairline)] rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4">
              {hoursByDay.map(({ day, ranges }) => (
                <div key={day} className="flex justify-between py-3 text-[15px]">
                  <dt>{t(`business.weekday.${day}` as never)}</dt>
                  <dd className="tabular-nums text-muted-foreground">{ranges.length ? ranges.map((r) => `${wall(r.start)} – ${wall(r.end)}`).join(', ') : t('business.closed')}</dd>
                </div>
              ))}
            </dl>
          </Section>
          {b.phone && (
            <a href={`tel:${b.phone}`} className="press flex min-h-11 items-center gap-2 rounded-full border border-input px-5 text-[15px] font-semibold">
              <Phone aria-hidden className="size-4" />
              {t('actions.callBusiness')} · {formatPhone(b.phone)}
            </a>
          )}
          <Section title={t('business.staff')}>
            <ul className="flex flex-wrap gap-2">
              {b.staff.map((s) => (
                <li key={s.id} className="rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[15px]">
                  {s.name}
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
      {/* Services listed with duration for screen readers and no-JS: */}
      <noscript>
        <ul>
          {b.services.map((s) => (
            <li key={s.id}>
              {s.name} · {formatDuration(s.durationMin)} · <Money minor={s.priceMinor} />
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  );
}
