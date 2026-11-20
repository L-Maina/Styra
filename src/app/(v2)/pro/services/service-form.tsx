'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { parseMoney } from '@/core/money';
import { FeedbackButton } from '@/components/v2/feedback-button';
import { api, ApiFailure } from '@/lib/v2/api';

const field = 'mt-1 block h-12 w-full rounded-2xl border border-input bg-[var(--surface-1)] px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ServiceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]"
      onSubmit={async (e) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const f = Object.fromEntries(new FormData(formEl)) as Record<string, string>;
        setBusy(true);
        setError(null);
        try {
          await api('/pro/services', { body: { name: f.name, category: 'OTHER', durationMin: Number(f.duration), priceMinor: Number(parseMoney(f.price)) } });
          formEl.reset();
          toast(t('toast.saved'));
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
        {t('pro.serviceName')}
        <input name="name" required minLength={2} className={field} />
      </label>
      <label className="block text-[15px] font-semibold">
        {t('pro.duration')}
        <input name="duration" type="number" inputMode="numeric" min={5} max={720} step={5} defaultValue={30} required className={field} />
      </label>
      <label className="block text-[15px] font-semibold">
        {t('pro.price')}
        <input name="price" inputMode="decimal" required pattern="[0-9,]+(\.[0-9]{1,2})?" className={field} />
      </label>
      <FeedbackButton type="submit" state={busy ? 'busy' : 'idle'} className="sm:col-span-3">
        {t('actions.addService')}
      </FeedbackButton>
    </form>
  );
}
