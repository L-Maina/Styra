import Link from 'next/link';
import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { formatRelative } from '@/core/format';
import { BusinessAvatar } from '@/components/v2/business-media';
import { CoverAvatar } from '@/components/v2/cover';
import { Reveal, ROW_STEP } from '@/components/v2/motion';
import { ButtonLink, EmptyState } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { listConversations } from '@/server/services/messages';

export const dynamic = 'force-dynamic';

export default async function Messages() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/messages');
  const items = await listConversations(getDb(), user);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-sans text-[28px] font-semibold normal-case">{t('messages.title')}</h1>
      {items.length === 0 ? (
        <EmptyState title={t('messages.emptyTitle')} body={t('messages.emptyBody')} action={<ButtonLink href="/explore">{t('actions.browse')}</ButtonLink>} />
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
          {items.map((c, i) => (
            <Reveal as="li" key={c.id} index={i} step={ROW_STEP} className="border-b border-[var(--hairline)] last:border-0">
              <Link href={`/messages/${c.id}`} className="flex min-h-[76px] items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06] focus-visible:outline-none">
                {c.viewer === 'CUSTOMER' ? (
                  <BusinessAvatar name={c.business.name} category={c.business.category} logoUrl={c.business.logoUrl} className="size-12" />
                ) : (
                  <CoverAvatar name={c.counterpart.name} category="OTHER" className="size-12 rounded-full" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-[17px] ${c.unread ? 'font-semibold' : 'font-medium'}`}>{c.counterpart.name}</span>
                    {c.lastMessage && <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{formatRelative(new Date(c.lastMessage.createdAt!))}</span>}
                  </span>
                  <span className="flex items-center justify-between gap-3">
                    <span className={`truncate text-[15px] ${c.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {c.lastMessage ? (c.lastMessage.mine ? t('messages.you', { text: c.lastMessage.body }) : c.lastMessage.body) : ''}
                    </span>
                    {c.unread > 0 && (
                      <span aria-label={t('messages.unread', { count: c.unread })} className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[13px] font-semibold text-primary-foreground tabular-nums">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
