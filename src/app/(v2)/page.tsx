import { t } from '@/core/copy';
import { BusinessCard } from '@/components/v2/business-card';
import { CategoryRail } from '@/components/v2/category-rail';
import { SearchCapsule } from '@/components/v2/search-capsule';
import { FadeUp, Reveal, RisingWords } from '@/components/v2/motion';
import { ButtonLink, EmptyState, Section } from '@/components/v2/ui';
import { getDb } from '@/server/db-pool';
import { listBusinesses } from '@/server/services/discovery';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { items } = await listBusinesses(getDb(), { limit: 12, cursor: 0 });
  return (
    <div className="space-y-10">
      <section className="relative -mx-4 -mt-24 overflow-hidden px-4 pb-10 pt-36 md:rounded-b-[40px]">
        <h1 className="max-w-4xl font-[family-name:var(--font-syne)] text-[46px] font-bold uppercase leading-[0.92] tracking-[-0.025em] md:text-[96px]">
          <RisingWords text={t('brand.motto')} />
        </h1>
        <FadeUp delay={0.55}>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-foreground/85 md:text-[20px]">{t('welcome.lead')}</p>
        </FadeUp>
        <FadeUp delay={0.7} className="mt-8 max-w-xl">
          <SearchCapsule />
        </FadeUp>
      </section>
      <FadeUp delay={0.85}>
        <CategoryRail />
      </FadeUp>
      <Section title={t('browse.title')}>
        {items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b, i) => (
              <Reveal as="li" key={b.slug} index={i}>
                <BusinessCard b={b as never} />
              </Reveal>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('browse.emptyTitle')} body={t('browse.emptyBody')} action={<ButtonLink href="/explore">{t('actions.browse')}</ButtonLink>} />
        )}
      </Section>
    </div>
  );
}
