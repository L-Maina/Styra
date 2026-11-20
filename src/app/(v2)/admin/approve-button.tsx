'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { FeedbackButton } from '@/components/v2/feedback-button';
import { api, ApiFailure } from '@/lib/v2/api';

export function ApproveButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <FeedbackButton
      onAction={async () => {
        try {
          await api(`/admin/businesses/${id}/approve`, { body: {} });
          toast(t('toast.saved'));
          setTimeout(() => router.refresh(), 700);
          return true;
        } catch (e) {
          toast((e as ApiFailure).message);
          return false;
        }
      }}
    >
      {t('actions.approve')}
    </FeedbackButton>
  );
}
