import Link from 'next/link';
import { Star } from 'lucide-react';
import { t } from '@/core/copy';
import { formatMoney } from '@/core/money';
import { formatRating } from '@/core/format';
import { BusinessAvatar, BusinessCover } from './business-media';

export interface BusinessCardData {
  slug: string;
  name: string;
  category: string;
  city: string | null;
  address: string | null;
  rating: { avg: number; count: number };
  fromPriceMinor: number | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
}

/** Content layer: opaque, no glass. The whole card is one link with a clear accessible name. */
export function BusinessCard({ b }: { b: BusinessCardData }) {
  return (
    <Link
      href={`/b/${b.slug}`}
      className="lift press group block overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative overflow-hidden">
        <BusinessCover name={b.name} category={b.category} coverUrl={b.coverUrl} className="lift-art aspect-[16/10] w-full" />
        {b.logoUrl && <BusinessAvatar name={b.name} category={b.category} logoUrl={b.logoUrl} className="absolute bottom-3 left-3 size-11 ring-2 ring-[var(--surface-1)]" />}
      </div>
      <div className="space-y-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-semibold leading-snug">{b.name}</h3>
          <span className="flex shrink-0 items-center gap-1 text-[15px] tabular-nums">
            <Star aria-hidden className="size-4 fill-current" />
            {formatRating(b.rating.avg, b.rating.count)}
          </span>
        </div>
        <p className="text-[15px] text-muted-foreground">
          {t(`browse.category.${b.category}` as never)}
          {b.address ? ` · ${b.address}` : ''}
        </p>
        {b.fromPriceMinor != null && <p className="pt-1 text-[15px] font-semibold tabular-nums">{t('browse.from', { price: formatMoney(BigInt(b.fromPriceMinor)) })}</p>}
      </div>
    </Link>
  );
}
