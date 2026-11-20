'use client';

/**
 * Admin escrow overview: how much money the platform is holding, which payments are held,
 * and manual release or refund for a held payment. Disputed payments are settled from the
 * disputes screen, because that also closes the dispute.
 *
 * Refunds are recorded in the ledger only. Nothing is sent back through the payment provider,
 * so the Refunded tab doubles as the list of refunds an admin still has to send by hand.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassModal,
  Skeleton,
} from '@/components/ui/custom/glass-components';

type Filter = 'held' | 'disputed' | 'released' | 'refunded' | 'all';

interface EscrowTransaction {
  id: string;
  bookingId: string | null;
  amount: number;
  platformFee: number;
  providerAmount: number;
  currency: string;
  escrowStatus: string | null;
  paymentMethod?: string | null;
  transactionId?: string | null;
  createdAt: string;
  completedAt?: string | null;
  booking: {
    id: string;
    date: string;
    time: string;
    status: string;
    customer: { id: string; name: string | null; email: string } | null;
  } | null;
  business: { id: string; name: string } | null;
}

interface EscrowSummary {
  totalHeld: number;
  totalReleased: number;
  totalRefunded: number;
  totalDisputed: number;
  heldCount: number;
  releasedCount: number;
  refundedCount: number;
  disputedCount: number;
}

interface EscrowData {
  summary: EscrowSummary;
  transactions: EscrowTransaction[];
}

type LoadState =
  | { status: 'loading'; data?: EscrowData }
  | { status: 'ready'; data: EscrowData }
  | { status: 'error'; data?: EscrowData };

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'held', label: 'Held' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'released', label: 'Released' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'all', label: 'All' },
];

const EMPTY_TEXT: Record<Filter, string> = {
  held: 'No payments are in escrow right now.',
  disputed: 'No disputed payments.',
  released: 'Nothing has been released yet.',
  refunded: 'No refunds have been recorded.',
  all: 'No escrow payments yet.',
};

const BADGE: Record<string, { label: string; variant: 'primary' | 'warning' | 'success' | 'default' }> = {
  HELD: { label: 'Held', variant: 'primary' },
  DISPUTED: { label: 'Disputed', variant: 'warning' },
  RELEASED: { label: 'Released', variant: 'success' },
  REFUNDED: { label: 'Refunded', variant: 'default' },
};

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function when(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const REASON_MIN = 10;

export function EscrowPanel({ onOpenDisputes }: { onOpenDisputes?: () => void }) {
  const [filter, setFilter] = useState<Filter>('held');
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [action, setAction] = useState<{ tx: EscrowTransaction; kind: 'release' | 'refund' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .request<EscrowData>('/admin/escrow', { params: { type: filter } })
      .then((res) => {
        if (!cancelled) setState({ status: 'ready', data: res.data });
      })
      .catch(() => {
        // The API client already showed the reason.
        if (!cancelled) setState((prev) => ({ status: 'error', data: prev.data }));
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setState((prev) => ({ status: 'loading', data: prev.data }));
    setFilter(next);
  };

  const reload = () => {
    setState((prev) => ({ status: 'loading', data: prev.data }));
    setReloadKey((key) => key + 1);
  };

  const summary = state.data?.summary;
  const rows = useMemo(() => state.data?.transactions ?? [], [state.data]);
  const currencies = useMemo(() => new Set(rows.map((row) => row.currency)), [rows]);
  const summaryCurrency = rows[0]?.currency ?? 'KES';
  const showRefundNote = filter === 'refunded' || (summary?.refundedCount ?? 0) > 0;

  const closeAction = () => {
    if (busy) return;
    setAction(null);
    setReason('');
  };

  const submitAction = async () => {
    if (!action || !action.tx.bookingId) return;
    setBusy(true);
    try {
      await api.request('/admin/escrow', {
        method: 'POST',
        body: JSON.stringify({ bookingId: action.tx.bookingId, action: action.kind, reason: reason.trim() }),
        noRetry: true,
      });
      toast.success(
        action.kind === 'release'
          ? `Released ${money(action.tx.providerAmount, action.tx.currency)} to the provider.`
          : `Refund of ${money(action.tx.amount, action.tx.currency)} recorded. Send it from the payment provider.`,
      );
      setAction(null);
      setReason('');
      reload();
    } catch {
      // Already shown by the API client. Keep the dialog open.
    } finally {
      setBusy(false);
    }
  };

  const tiles: { label: string; amount: number | undefined; count: number | undefined }[] = [
    { label: 'In escrow', amount: summary?.totalHeld, count: summary?.heldCount },
    { label: 'Disputed', amount: summary?.totalDisputed, count: summary?.disputedCount },
    { label: 'Released', amount: summary?.totalReleased, count: summary?.releasedCount },
    { label: 'Refunded', amount: summary?.totalRefunded, count: summary?.refundedCount },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <GlassCard key={tile.label} variant="default" className="p-4">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            {summary ? (
              <>
                <p className="mt-1 text-2xl font-medium tabular-nums">{money(tile.amount ?? 0, summaryCurrency)}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {tile.count ?? 0} {tile.count === 1 ? 'payment' : 'payments'}
                </p>
              </>
            ) : (
              <Skeleton className="mt-2 h-8 w-28" />
            )}
          </GlassCard>
        ))}
      </div>
      {currencies.size > 1 && (
        <p className="text-sm text-muted-foreground">
          These payments use more than one currency, so the totals above add amounts in different currencies.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Escrow status">
          {FILTERS.map((item) => (
            <GlassButton
              key={item.id}
              size="sm"
              variant={filter === item.id ? 'primary' : 'ghost'}
              onClick={() => changeFilter(item.id)}
            >
              {item.label}
            </GlassButton>
          ))}
        </div>
        <GlassButton
          size="sm"
          variant="ghost"
          onClick={reload}
          disabled={state.status === 'loading'}
          leftIcon={<RefreshCw className="size-4" strokeWidth={1.5} aria-hidden="true" />}
        >
          Refresh
        </GlassButton>
      </div>

      {showRefundNote && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-400" strokeWidth={1.5} aria-hidden="true" />
          <span>
            Refunds are recorded here only. Money is not sent back automatically. Refund each one from Stripe, PayPal,
            Paystack or M-Pesa, using the payment reference.
          </span>
        </p>
      )}

      {state.status === 'error' && (
        <GlassCard variant="default" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Could not load escrow data.</p>
          <GlassButton size="sm" variant="outline" onClick={reload}>
            Try again
          </GlassButton>
        </GlassCard>
      )}

      {state.status === 'loading' && !state.data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        state.status !== 'error' && <p className="py-8 text-center text-muted-foreground">{EMPTY_TEXT[filter]}</p>
      ) : (
        <ul className={cn('space-y-3', state.status === 'loading' && 'opacity-60')} aria-busy={state.status === 'loading'}>
          {rows.map((tx) => {
            const badge = BADGE[tx.escrowStatus ?? ''] ?? { label: tx.escrowStatus ?? 'Unknown', variant: 'default' as const };
            const customer = tx.booking?.customer;
            return (
              <li key={tx.id}>
                <GlassCard variant="default" className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{tx.business?.name ?? 'Unknown business'}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {customer ? customer.name || customer.email : 'Unknown customer'}
                      {tx.booking ? ` · ${tx.booking.date} ${tx.booking.time}` : ''}
                    </p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {tx.bookingId ? `Booking ${tx.bookingId.slice(0, 8)}` : 'No booking'} · Held {when(tx.createdAt)}
                      {tx.transactionId ? ` · Ref ${tx.transactionId}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
                    <div className="text-right">
                      <p className="font-medium tabular-nums">{money(tx.amount, tx.currency)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        Provider {money(tx.providerAmount, tx.currency)} · Fee {money(tx.platformFee, tx.currency)}
                      </p>
                    </div>
                    <GlassBadge variant={badge.variant}>{badge.label}</GlassBadge>
                    {tx.escrowStatus === 'HELD' && tx.bookingId && (
                      <div className="flex gap-2">
                        <GlassButton size="sm" variant="outline" onClick={() => setAction({ tx, kind: 'release' })}>
                          Release
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" onClick={() => setAction({ tx, kind: 'refund' })}>
                          Refund
                        </GlassButton>
                      </div>
                    )}
                    {tx.escrowStatus === 'DISPUTED' && onOpenDisputes && (
                      <GlassButton size="sm" variant="outline" onClick={onOpenDisputes}>
                        Open disputes
                      </GlassButton>
                    )}
                  </div>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}

      <GlassModal
        isOpen={action !== null}
        onClose={closeAction}
        title={
          action?.kind === 'release'
            ? `Release ${action ? money(action.tx.providerAmount, action.tx.currency) : ''} to the provider?`
            : `Refund ${action ? money(action.tx.amount, action.tx.currency) : ''} to the customer?`
        }
        description={
          action?.kind === 'release'
            ? 'Use this when the customer has not confirmed and the service was done. The booking becomes completed.'
            : 'The booking is cancelled and the refund is recorded. You still need to send the money back from the payment provider.'
        }
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="escrow-reason" className="mb-2 block text-sm text-muted-foreground">
              Reason (kept in the audit log)
            </label>
            <textarea
              id="escrow-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <p className="mt-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {reason.trim().length < REASON_MIN
                ? `${REASON_MIN - reason.trim().length} more characters needed`
                : `${reason.trim().length} / 500`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <GlassButton size="sm" variant="ghost" onClick={closeAction} disabled={busy}>
              Cancel
            </GlassButton>
            <GlassButton
              size="sm"
              variant="primary"
              onClick={submitAction}
              isLoading={busy}
              disabled={reason.trim().length < REASON_MIN}
            >
              {action?.kind === 'release' ? 'Release payment' : 'Record refund'}
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
