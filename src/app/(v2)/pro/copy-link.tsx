'use client';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { Button } from '@/components/v2/ui';

export function CopyLink({ path }: { path: string }) {
  return (
    <Button
      tone="secondary"
      onClick={async () => {
        await navigator.clipboard?.writeText(`${location.origin}${path}`);
        toast(t('toast.linkCopied'));
      }}
    >
      {t('actions.copyLink')}
    </Button>
  );
}
