'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { Button } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';

export function ApproveButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/admin/businesses/${id}/approve`, { body: {} });
          toast(t('toast.saved'));
          router.refresh();
        } catch (e) {
          toast((e as ApiFailure).message);
          setBusy(false);
        }
      }}
    >
      {t('actions.approve')}
    </Button>
  );
}
