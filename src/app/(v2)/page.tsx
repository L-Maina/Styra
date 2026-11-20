import { t } from '@/core/copy';
import { BusinessCard } from '@/components/v2/business-card';
import { CategoryRail } from '@/components/v2/category-rail';
import { SearchCapsule } from '@/components/v2/search-capsule';
import { ButtonLink, EmptyState, Section } from '@/components/v2/ui';
import { getDb } from '@/server/db-pool';
import { listBusinesses } from '@/server/services/discovery';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { items } = await listBusinesses(getDb(), { limit: 12, cursor: 0 });
  return (
    <div className="space-y-10">
      <section className="relative -mx-4 -mt-24 overflow-hidden px-4 pb-10 pt-36 md:rounded-b-[40px]">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_20%_10%,oklch(0.45_0.16_280/0.55),transparent_60%),radial-gradient(80%_60%_at_100%_80%,oklch(0.5_0.17_255/0.45),transparent_65%)]" />
        <h1 className="max-w-3xl font-[family-name:var(--font-syne)] text-[44px] font-bold uppercase leading-[0.95] tracking-[-0.02em] md:text-[76px]">{t('brand.motto')}</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-foreground/85 md:text-[19px]">{t('welcome.lead')}</p>
        <div className="mt-8 max-w-xl">
          <SearchCapsule />
        </div>
      </section>
      <CategoryRail />
      <Section title={t('browse.title')}>
        {items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => (
              <li key={b.slug}>
                <BusinessCard b={b as never} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('browse.emptyTitle')} body={t('browse.emptyBody')} action={<ButtonLink href="/explore">{t('actions.browse')}</ButtonLink>} />
        )}
      </Section>
    </div>
  );
}
