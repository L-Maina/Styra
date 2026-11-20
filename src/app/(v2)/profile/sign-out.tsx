'use client';
import { t } from '@/core/copy';
import { Button } from '@/components/v2/ui';
import { api } from '@/lib/v2/api';

export function SignOutButton() {
  return (
    <Button
      tone="quiet"
      onClick={async () => {
        await api('/auth/logout', { body: {} }).catch(() => {});
        window.location.assign('/');
      }}
    >
      {t('actions.signOut')}
    </Button>
  );
}
