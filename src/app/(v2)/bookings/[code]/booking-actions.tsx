'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/core/copy';
import { formatMoney } from '@/core/money';
import { customerRefundBps, DEFAULT_SETTINGS } from '@/core/policy';
import { Glass } from '@/components/v2/glass';
import { Button } from '@/components/v2/ui';
import { FeedbackButton } from '@/components/v2/feedback-button';
import { api, ApiFailure } from '@/lib/v2/api';
import { duration, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { BookingDto } from '@/contracts/booking';

type Panel = 'cancel' | 'dispute' | 'review' | null;

export function BookingActions({ booking }: { booking: BookingDto }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const sheetRef = useRef<HTMLDivElement>(null);
  const a = new Set(booking.actions);

  useEffect(() => {
    if (!panel) return;
    sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

  async function run(path: string, body: unknown, done: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await api(`/bookings/${booking.code}/${path}`, { body, idempotencyKey: path === 'pay' ? booking.id : undefined });
      toast(done);
      setTimeout(() => {
        setPanel(null);
        router.refresh();
      }, 700);
      return true;
    } catch (e) {
      setError((e as ApiFailure).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!a.size) return null;
  const refundBps = customerRefundBps(DEFAULT_SETTINGS.cancellationPolicy, new Date(booking.startAt), new Date());
  const paid = booking.escrowState === 'HELD';
  const refund = paid ? (BigInt(booking.priceMinor) * BigInt(refundBps)) / 10000n : 0n;

  return (
    <>
      {/* Action bar: functional layer, regular glass. One gradient action at most. */}
      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
        <Glass className="flex w-full max-w-2xl flex-wrap items-center justify-end gap-2 rounded-[28px] p-2">
          {a.has('cancel') && (
            <Button tone="quiet" onClick={() => setPanel('cancel')}>
              {t('actions.cancelBooking')}
            </Button>
          )}
          {a.has('dispute') && (
            <Button tone="secondary" onClick={() => setPanel('dispute')}>
              {t('actions.reportProblem')}
            </Button>
          )}
          {a.has('review') && <Button onClick={() => setPanel('review')}>{t('actions.leaveReview')}</Button>}
          {a.has('confirm') && (
            <FeedbackButton onAction={() => run('confirm', {}, t('toast.serviceConfirmed'))}>{t('actions.confirmService')}</FeedbackButton>
          )}
          {a.has('pay') && (
            <FeedbackButton onAction={() => run('pay', { method: 'FAKE' }, t('booking.confirmed.title'))}>{t('actions.payTest')}</FeedbackButton>
          )}
        </Glass>
      </div>
      {error && !panel && (
        <p role="alert" className="rounded-3xl bg-[var(--surface-1)] p-4 text-[15px] font-semibold">
          {error}
        </p>
      )}

      <AnimatePresence>
        {panel && (
          <>
            <motion.div key="dim" aria-hidden className="fixed inset-0 z-50 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel(null)} />
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center md:bottom-6 md:px-4">
              <motion.div
                className="pointer-events-auto w-full max-w-lg"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: duration.base, ease: ease.spring }}
              >
                <Glass ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="action-title" className="rounded-t-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-[28px]">
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="action-title" tabIndex={-1} data-autofocus className="text-[22px] font-semibold outline-none">
                      {panel === 'cancel' ? t('detail.cancelPrompt') : panel === 'dispute' ? t('detail.reportLabel') : t('detail.reviewLabel')}
                    </h2>
                    <button type="button" onClick={() => setPanel(null)} aria-label={t('actions.close')} className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-foreground/10">
                      <X className="size-5" />
                    </button>
                  </div>
                  {error && (
                    <p role="alert" className="mt-3 rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px] font-semibold">
                      {error}
                    </p>
                  )}

                  {panel === 'cancel' && (
                    <div className="mt-4 space-y-4">
                      {paid && (
                        <p className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[17px]">
                          {refund > 0n ? t('detail.cancelRefund', { amount: formatMoney(refund) }) : t('detail.cancelNoRefund')}
                        </p>
                      )}
                      <div className="flex flex-col gap-2">
                        <FeedbackButton tone="danger" onAction={() => run('cancel', {}, t('toast.bookingCancelled'))} className="w-full">
                          {t('actions.cancelBooking')}
                        </FeedbackButton>
                        <Button tone="secondary" onClick={() => setPanel(null)} className="w-full">
                          {t('actions.keepBooking')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {panel === 'dispute' && (
                    <form
                      className="mt-4 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
                        void run('dispute', { reason }, t('toast.reportSent'));
                      }}
                    >
                      <label className="block text-[15px] font-semibold">
                        <span className="sr-only">{t('detail.reportLabel')}</span>
                        <textarea
                          name="reason"
                          required
                          minLength={10}
                          maxLength={2000}
                          rows={4}
                          aria-describedby="report-hint"
                          className="block w-full rounded-2xl border border-input bg-[var(--surface-1)] p-4 text-[17px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span id="report-hint" className="mt-1 block text-[13px] font-normal">
                          {t('detail.reportHint')}
                        </span>
                      </label>
                      <FeedbackButton type="submit" state={busy ? 'busy' : 'idle'} className="w-full">
                        {t('actions.sendReport')}
                      </FeedbackButton>
                    </form>
                  )}

                  {panel === 'review' && (
                    <form
                      className="mt-4 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const comment = String(new FormData(e.currentTarget).get('comment') ?? '').trim();
                        void run('review', { rating, comment: comment || undefined }, t('toast.reviewPosted'));
                      }}
                    >
                      <fieldset className="flex gap-1">
                        <legend className="sr-only">{t('detail.reviewLabel')}</legend>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" aria-label={t('detail.ratingStars', { count: n })} aria-pressed={rating >= n} onClick={() => setRating(n)} className="grid size-11 place-items-center rounded-full">
                            <Star className={cn('size-7', rating >= n ? 'fill-current' : '')} />
                          </button>
                        ))}
                      </fieldset>
                      <label className="block">
                        <span className="text-[15px] font-semibold">{t('detail.reviewComment')}</span>
                        <textarea name="comment" rows={3} maxLength={1000} className="mt-1 block w-full rounded-2xl border border-input bg-[var(--surface-1)] p-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                      </label>
                      <FeedbackButton type="submit" state={busy ? 'busy' : 'idle'} className="w-full">
                        {t('actions.postReview')}
                      </FeedbackButton>
                    </form>
                  )}
                </Glass>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
