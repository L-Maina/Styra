'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/core/copy';
import { Button } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';

const field = 'mt-1 block h-12 w-full rounded-2xl border border-input bg-[var(--surface-1)] px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring';
const CATEGORIES = ['BARBER', 'HAIR', 'BRAIDS', 'NAILS', 'MASSAGE', 'SPA', 'MAKEUP', 'OTHER'] as const;

export function SetupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        setBusy(true);
        setError(null);
        try {
          await api('/pro/business', { body: { name: f.name, category: f.category, city: f.city, address: f.address || undefined, phone: f.phone || undefined, description: f.description || undefined } });
          router.refresh();
        } catch (err) {
          setError((err as ApiFailure).message);
          setBusy(false);
        }
      }}
    >
      {error && <p role="alert" className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px] font-semibold">{error}</p>}
      <label className="block text-[15px] font-semibold">
        {t('pro.businessName')}
        <input name="name" required minLength={2} className={field} />
      </label>
      <label className="block text-[15px] font-semibold">
        {t('pro.category')}
        <select name="category" required className={field} defaultValue="BARBER">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`browse.category.${c}` as never)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[15px] font-semibold">
          {t('pro.city')}
          <input name="city" required defaultValue="Nairobi" className={field} />
        </label>
        <label className="block text-[15px] font-semibold">
          {t('pro.address')}
          <input name="address" className={field} />
        </label>
      </div>
      <label className="block text-[15px] font-semibold">
        {t('auth.phone')}
        <input name="phone" type="tel" inputMode="tel" className={field} />
      </label>
      <label className="block text-[15px] font-semibold">
        {t('pro.description')}
        <textarea name="description" rows={3} maxLength={1000} className="mt-1 block w-full rounded-2xl border border-input bg-[var(--surface-1)] p-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <Button type="submit" disabled={busy} className="w-full min-h-[52px] text-[17px]">
        {t('actions.createBusiness')}
      </Button>
    </form>
  );
}
