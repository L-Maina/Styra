'use client';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { t } from '@/core/copy';
import { api } from '@/lib/v2/api';
import { FeedbackButton } from './feedback-button';

/** Opens (or starts) the conversation with a business. Signed-out people go to sign in first. */
export function MessageBusinessButton({ slug, signedIn, bookingCode, className }: { slug: string; signedIn: boolean; bookingCode?: string; className?: string }) {
  const router = useRouter();
  return (
    <FeedbackButton
      tone="secondary"
      className={className}
      onAction={async () => {
        if (!signedIn) {
          router.push(`/signin?next=/b/${slug}`);
          return false;
        }
        try {
          const { conversation } = await api<{ conversation: { id: string } }>('/conversations', { body: { businessSlug: slug, bookingCode } });
          router.push(`/messages/${conversation.id}`);
          return true;
        } catch {
          return false;
        }
      }}
    >
      <MessageCircle aria-hidden className="size-5" />
      {t('actions.messageBusiness')}
    </FeedbackButton>
  );
}
