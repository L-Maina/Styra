'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { FeedbackButton } from '@/components/v2/feedback-button';
import { api, ApiFailure } from '@/lib/v2/api';

export function BookingRowActions({ id, actions }: { id: string; actions: string[] }) {
  const router = useRouter();
  async function act(action: string, done: string): Promise<boolean> {
    try {
      await api(`/pro/bookings/${id}/${action}`, { body: {} });
      toast(done);
      setTimeout(() => router.refresh(), 700);
      return true;
    } catch (e) {
      toast((e as ApiFailure).message);
      return false;
    }
  }
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.includes('complete') && (
        <FeedbackButton onAction={() => act('complete', t('toast.markedDone'))}>
          {t('actions.markDone')}
        </FeedbackButton>
      )}
      {actions.includes('no-show') && (
        <FeedbackButton tone="secondary" onAction={() => act('no-show', t('status.provider.NO_SHOW'))}>
          {t('actions.markNoShow')}
        </FeedbackButton>
      )}
      {actions.includes('decline') && (
        <FeedbackButton tone="danger" onAction={() => act('decline', t('toast.bookingCancelled'))}>
          {t('actions.decline')}
        </FeedbackButton>
      )}
    </div>
  );
}
