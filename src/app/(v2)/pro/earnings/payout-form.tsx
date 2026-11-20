'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { parseMoney } from '@/core/money';
import { Button } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';

const field = 'mt-1 block h-12 w-full rounded-2xl border border-input bg-[var(--surface-1)] px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function PayoutForm({ availableMinor }: { availableMinor: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const f = Object.fromEntries(new FormData(formEl)) as Record<string, string>;
        setBusy(true);
        setError(null);
        try {
          await api('/pro/payouts', { body: { amountMinor: Number(parseMoney(f.amount)), method: 'MPESA', destination: f.phone }, idempotencyKey: crypto.randomUUID() });
          formEl.reset();
          toast(t('money.payoutOnItsWay'));
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiFailure ? err.message : t('errors.VALIDATION'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <p role="alert" className="sm:col-span-3 rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px] font-semibold">{error}</p>}
      <label className="block text-[15px] font-semibold">
        {t('pro.payoutAmount')}
        <input name="amount" inputMode="decimal" required pattern="[0-9,]+(\.[0-9]{1,2})?" className={field} />
      </label>
      <label className="block text-[15px] font-semibold">
        {t('pro.payoutNumber')}
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required className={field} />
      </label>
      <Button type="submit" disabled={busy || availableMinor <= 0}>{t('actions.requestPayout')}</Button>
    </form>
  );
}
