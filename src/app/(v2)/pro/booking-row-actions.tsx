'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { Button } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';

export function BookingRowActions({ id, actions }: { id: string; actions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: string, done: string) {
    setBusy(true);
    try {
      await api(`/pro/bookings/${id}/${action}`, { body: {} });
      toast(done);
      router.refresh();
    } catch (e) {
      toast((e as ApiFailure).message);
    } finally {
      setBusy(false);
    }
  }
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.includes('complete') && (
        <Button disabled={busy} onClick={() => act('complete', t('toast.markedDone'))}>
          {t('actions.markDone')}
        </Button>
      )}
      {actions.includes('no-show') && (
        <Button tone="secondary" disabled={busy} onClick={() => act('no-show', t('status.provider.NO_SHOW'))}>
          {t('actions.markNoShow')}
        </Button>
      )}
      {actions.includes('decline') && (
        <Button tone="danger" disabled={busy} onClick={() => act('decline', t('toast.bookingCancelled'))}>
          {t('actions.decline')}
        </Button>
      )}
    </div>
  );
}
