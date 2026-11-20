'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { Button, Money } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';

const field = 'h-11 w-full min-w-0 rounded-xl border border-input bg-[var(--surface-1)] px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async run(path: string, body: unknown) {
      setBusy(true);
      try {
        await api(path, { body });
        toast(t('toast.saved'));
        router.refresh();
      } catch (e) {
        toast((e as ApiFailure).message);
      } finally {
        setBusy(false);
      }
    },
  };
}

export function RefundRow({ r }: { r: { id: string; bookingCode: string; amountMinor: number; status: string; customerName: string; customerPhone: string | null; paidWith: string | null } }) {
  const { busy, run } = useAction();
  const [ref, setRef] = useState('');
  return (
    <li className="space-y-3 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <span>
          <span className="block text-[17px] font-semibold">{r.customerName} · {r.bookingCode}</span>
          <span className="block text-[15px] text-muted-foreground">
            {r.customerPhone ?? ''} {r.paidWith ? `· ${t('admin.paidWith', { method: r.paidWith })}` : ''}
          </span>
        </span>
        <Money minor={r.amountMinor} className="text-[17px] font-semibold" />
      </div>
      {r.status === 'PENDING' || r.status === 'SUBMITTED' ? (
        <div className="flex gap-2">
          <input aria-label={t('admin.reference')} placeholder={t('admin.reference')} value={ref} onChange={(e) => setRef(e.target.value)} className={field} />
          <Button disabled={busy || !ref} onClick={() => run(`/admin/refunds/${r.id}/paid`, { providerRef: ref })}>{t('admin.markRefunded')}</Button>
        </div>
      ) : (
        <p className="text-[15px]">{t(`admin.refundStatus.${r.status}` as never)}</p>
      )}
    </li>
  );
}

export function PayoutRow({ p }: { p: { id: string; amountMinor: number; status: string; destination: string; businessName?: string; businessPhone?: string } }) {
  const { busy, run } = useAction();
  const [ref, setRef] = useState('');
  const open = p.status === 'REQUESTED' || p.status === 'PROCESSING';
  return (
    <li className="space-y-3 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <span>
          <span className="block text-[17px] font-semibold">{p.businessName}</span>
          <span className="block text-[15px] text-muted-foreground">{p.destination} · {p.businessPhone ?? ''}</span>
        </span>
        <Money minor={p.amountMinor} className="text-[17px] font-semibold" />
      </div>
      {open ? (
        <div className="flex flex-wrap gap-2">
          <input aria-label={t('admin.reference')} placeholder={t('admin.reference')} value={ref} onChange={(e) => setRef(e.target.value)} className={`${field} flex-1`} />
          <Button disabled={busy || !ref} onClick={() => run(`/admin/payouts/${p.id}/paid`, { providerRef: ref })}>{t('admin.markPaidOut')}</Button>
          <Button tone="danger" disabled={busy} onClick={() => run(`/admin/payouts/${p.id}/failed`, { reason: ref || undefined })}>{t('admin.markFailed')}</Button>
        </div>
      ) : (
        <p className="text-[15px]">{t(`pro.payoutStatus.${p.status}` as never)}</p>
      )}
    </li>
  );
}

export function DisputeRow({ d }: { d: { id: string; status: string; reason: string; details: string | null; bookingCode: string; priceMinor: number; businessName: string; customerName: string } }) {
  const { busy, run } = useAction();
  const [outcome, setOutcome] = useState<'RELEASE' | 'REFUND' | 'SPLIT'>('RELEASE');
  const [share, setShare] = useState('50');
  const [note, setNote] = useState('');
  return (
    <li className="space-y-3 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="block text-[17px] font-semibold">{d.customerName} → {d.businessName} · {d.bookingCode}</span>
        <Money minor={d.priceMinor} className="text-[17px] font-semibold" />
      </div>
      <p className="text-[15px]">{d.reason}</p>
      {d.details && <p className="text-[15px] text-muted-foreground">{d.details}</p>}
      {d.status === 'OPEN' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('admin.disputesTitle')}>
            {(['RELEASE', 'REFUND', 'SPLIT'] as const).map((o) => (
              <Button key={o} type="button" tone={outcome === o ? 'secondary' : 'quiet'} role="radio" aria-checked={outcome === o} onClick={() => setOutcome(o)}>
                {t(o === 'RELEASE' ? 'admin.resolveRelease' : o === 'REFUND' ? 'admin.resolveRefund' : 'admin.resolveSplit')}
              </Button>
            ))}
          </div>
          {outcome === 'SPLIT' && (
            <label className="block text-[15px] font-semibold">
              {t('admin.splitShare')}
              <input type="number" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} className={`${field} mt-1 max-w-32`} />
            </label>
          )}
          <input aria-label={t('admin.resolutionNote')} placeholder={t('admin.resolutionNote')} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
          <Button
            disabled={busy || note.trim().length < 2}
            onClick={() => run(`/admin/disputes/${d.id}/resolve`, { outcome, refundBps: outcome === 'SPLIT' ? Math.round(Number(share) * 100) : undefined, note })}
          >
            {t('actions.resolve')}
          </Button>
        </div>
      )}
    </li>
  );
}
