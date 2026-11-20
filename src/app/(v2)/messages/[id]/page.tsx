import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { t } from '@/core/copy';
import { AppError } from '@/core/errors';
import { BusinessAvatar } from '@/components/v2/business-media';
import { CoverAvatar } from '@/components/v2/cover';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { getConversation, readMessages } from '@/server/services/messages';
import { Thread } from './thread';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/messages/${id}`);
  const db = getDb();
  let convo, messages;
  try {
    [convo, messages] = await Promise.all([getConversation(db, user, id), readMessages(db, user, id)]);
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/messages" aria-label={t('nav.back')} className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-foreground/10">
          <ChevronLeft className="size-6" />
        </Link>
        {convo.viewer === 'CUSTOMER' ? (
          <BusinessAvatar name={convo.business.name} category={convo.business.category} logoUrl={convo.business.logoUrl} className="size-10" />
        ) : (
          <CoverAvatar name={convo.counterpart.name} category="OTHER" className="size-10 rounded-full" />
        )}
        <div className="min-w-0">
          <h1 className="truncate font-sans text-[19px] font-semibold normal-case">{convo.counterpart.name}</h1>
          {convo.viewer === 'CUSTOMER' && (
            <Link href={`/b/${convo.business.slug}`} className="text-[13px] font-semibold underline">
              {t('messages.viewBusiness')}
            </Link>
          )}
        </div>
      </header>
      <Thread id={convo.id} initial={messages} counterpart={convo.counterpart.name} />
    </div>
  );
}
