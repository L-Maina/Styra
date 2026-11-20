'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { Button } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
type Day = { open: boolean; start: string; end: string };
const select = 'h-11 rounded-xl border border-input bg-[var(--surface-1)] px-3 text-[15px] tabular-nums';
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const label = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export function HoursEditor({ initial }: { initial: { weekday: number; start: string; end: string }[] }) {
  const router = useRouter();
  const [days, setDays] = useState<Record<number, Day>>(() =>
    Object.fromEntries(DAYS.map((d) => {
      const r = initial.find((x) => x.weekday === d);
      return [d, r ? { open: true, start: r.start, end: r.end } : { open: false, start: '09:00', end: '18:00' }];
    })),
  );
  const [busy, setBusy] = useState(false);
  const set = (d: number, patch: Partial<Day>) => setDays((s) => ({ ...s, [d]: { ...s[d], ...patch } }));
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[var(--hairline)] rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
        {DAYS.map((d) => (
          <li key={d} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <label className="flex min-h-11 items-center gap-3 text-[17px] font-semibold">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={days[d].open} onChange={(e) => set(d, { open: e.target.checked })} />
              {t(`business.weekday.${d}` as never)}
            </label>
            {days[d].open ? (
              <span className="flex items-center gap-2">
                <select aria-label={t('pro.opens', { day: t(`business.weekday.${d}` as never) })} className={select} value={days[d].start} onChange={(e) => set(d, { start: e.target.value })}>
                  {TIMES.map((x) => <option key={x} value={x}>{label(x)}</option>)}
                </select>
                <span aria-hidden>–</span>
                <select aria-label={t('pro.closes', { day: t(`business.weekday.${d}` as never) })} className={select} value={days[d].end} onChange={(e) => set(d, { end: e.target.value })}>
                  {TIMES.map((x) => <option key={x} value={x}>{label(x)}</option>)}
                </select>
              </span>
            ) : (
              <span className="text-[15px] text-muted-foreground">{t('business.closed')}</span>
            )}
          </li>
        ))}
      </ul>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/pro/availability', { method: 'PUT', body: { rules: DAYS.filter((d) => days[d].open).map((d) => ({ weekday: d, start: days[d].start, end: days[d].end })) } });
            toast(t('toast.saved'));
            router.refresh();
          } catch (e) {
            toast((e as ApiFailure).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('actions.saveHours')}
      </Button>
    </div>
  );
}
