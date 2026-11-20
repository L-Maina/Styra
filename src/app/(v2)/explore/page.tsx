import { t } from '@/core/copy';
import { businessListQuery } from '@/contracts/booking';
import { BusinessCard } from '@/components/v2/business-card';
import { CategoryRail } from '@/components/v2/category-rail';
import { SearchCapsule } from '@/components/v2/search-capsule';
import { ButtonLink, EmptyState } from '@/components/v2/ui';
import { getDb } from '@/server/db-pool';
import { listBusinesses } from '@/server/services/discovery';

export const dynamic = 'force-dynamic';

export default async function Explore({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = businessListQuery.parse({ q: sp.q || undefined, category: sp.category || undefined, limit: 30 });
  const { items } = await listBusinesses(getDb(), q);
  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t('nav.explore')}</h1>
      <SearchCapsule defaultValue={q.q} />
      <CategoryRail active={q.category} />
      <p className="text-[15px] text-muted-foreground" aria-live="polite">
        {t('browse.resultsCount', { count: items.length })}
      </p>
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => (
            <li key={b.slug}>
              <BusinessCard b={b as never} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t('browse.emptyTitle')} body={t('browse.emptyBody')} action={<ButtonLink href="/explore" tone="secondary">{t('actions.clearFilters')}</ButtonLink>} />
      )}
    </div>
  );
}
