'use client';

/**
 * Booking status and escrow controls shared by the customer and provider dashboards.
 *
 * Flow: provider marks the booking complete -> the payment stays in escrow -> the customer
 * confirms (payment released) or reports a problem (payment held for an admin), or does nothing
 * and the daily job releases it after 24 hours. All money movement happens on the server
 * (src/lib/verification.ts); these components only call the API and show the state.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ShieldCheck, Star } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCurrencyStore } from '@/store';
import {
  BookingStatus,
  VERIFICATION_WINDOW_HOURS,
  bookingStatusMeta,
  isStatus,
  verificationDeadline,
  type StatusTone,
} from '@/lib/booking-status';
import { GlassBadge, GlassButton, GlassModal } from '@/components/ui/custom/glass-components';

// ── Status badge ───────────────────────────────────────────────────────────

const BADGE_VARIANT: Record<StatusTone, 'default' | 'primary' | 'success' | 'warning' | 'destructive'> = {
  neutral: 'default',
  info: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
};

/** One badge for every booking status, including VERIFIED, DISPUTED and older lowercase rows. */
export function BookingStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = bookingStatusMeta(status);
  return (
    <GlassBadge variant={BADGE_VARIANT[meta.tone]} className={className}>
      {meta.label}
    </GlassBadge>
  );
}

// ── Countdown ──────────────────────────────────────────────────────────────

/** "5h 12m", "42m", or "a few minutes" once the window is about to close. */
export function formatTimeLeft(ms: number): string {
  if (ms <= 60_000) return 'a few minutes';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Milliseconds until the deadline, refreshed every 30 seconds. Null when there is no deadline. */
function useMsUntil(deadline: Date | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  const deadlineMs = deadline ? deadline.getTime() : null;

  useEffect(() => {
    if (deadlineMs === null) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [deadlineMs]);

  return deadlineMs === null ? null : Math.max(0, deadlineMs - now);
}

// ── Shared shapes ──────────────────────────────────────────────────────────

export interface EscrowBooking {
  id: string;
  status: string;
  /** Shown to the customer in messages about who the payment goes to. */
  businessName?: string;
  /** What the customer paid (the booking total). */
  amount: number;
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  hasReview?: boolean;
}

// ── Notice: where the money is right now ───────────────────────────────────

/**
 * One line that says where the payment stands. Renders nothing for statuses where the
 * payment is not yet in play (pending, confirmed, in progress, cancelled).
 */
export function VerificationNotice({
  booking,
  audience,
  className,
}: {
  booking: EscrowBooking;
  audience: 'customer' | 'provider';
  className?: string;
}) {
  const { formatPrice } = useCurrencyStore();
  const msLeft = useMsUntil(
    isStatus(booking.status, BookingStatus.COMPLETED) ? verificationDeadline(booking) : null,
  );
  const amount = formatPrice(booking.amount);
  const provider = booking.businessName || 'Your provider';
  const forCustomer = audience === 'customer';

  let icon = Clock;
  let text: string;
  let tone = 'text-muted-foreground';

  if (isStatus(booking.status, BookingStatus.COMPLETED)) {
    // After the window the payment goes out with the next daily payout run, not at the exact minute.
    const windowEnded = msLeft !== null && msLeft <= 0;
    const when = msLeft === null ? `${VERIFICATION_WINDOW_HOURS} hours` : formatTimeLeft(msLeft);
    if (forCustomer) {
      text = windowEnded
        ? `The confirmation window has ended. ${amount} is released to ${provider} in the next daily payout run. You can still report a problem until then.`
        : `${provider} marked this as done. Confirm to release ${amount}, or report a problem. The window closes in ${when}, after which the payment is released automatically.`;
    } else {
      text = windowEnded
        ? `The confirmation window has ended. ${amount} is released to your balance in the next daily payout run, unless the customer reports a problem.`
        : `Waiting for the customer. ${amount} stays in escrow until they confirm or the window closes in ${when}, unless they report a problem.`;
    }
  } else if (isStatus(booking.status, BookingStatus.VERIFIED)) {
    icon = ShieldCheck;
    tone = 'text-green-400';
    text = forCustomer
      ? `Payment of ${amount} was released to ${provider}.`
      : `${amount} was released to your balance.`;
  } else if (isStatus(booking.status, BookingStatus.DISPUTED)) {
    icon = AlertTriangle;
    tone = 'text-yellow-400';
    text = forCustomer
      ? 'Problem reported. Your payment stays in escrow while we review it. We reply within 48 hours.'
      : 'The customer reported a problem. The payment stays held until an admin decides.';
  } else {
    return null;
  }

  const Icon = icon;
  return (
    <p className={cn('flex items-start gap-2 text-sm', tone, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

// ── Customer actions ───────────────────────────────────────────────────────

const REASON_MIN = 10;
const REASON_MAX = 2000;

/**
 * Confirm and release, or report a problem. Shown while the booking is COMPLETED (the payment
 * is held). `onChanged` runs after the server accepted a change, so the caller can refetch.
 */
export function CustomerEscrowActions({
  booking,
  onChanged,
  className,
}: {
  booking: EscrowBooking;
  onChanged?: () => void;
  className?: string;
}) {
  const { formatPrice } = useCurrencyStore();
  const [dialog, setDialog] = useState<'confirm' | 'report' | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');

  if (!isStatus(booking.status, BookingStatus.COMPLETED)) return null;

  const close = () => {
    if (busy) return;
    setDialog(null);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await api.confirmBooking(
        booking.id,
        rating > 0 ? { rating, comment: comment.trim() || undefined } : {},
      );
      toast.success(result.data?.message || 'Thanks for confirming.');
      setDialog(null);
      setRating(0);
      setComment('');
      onChanged?.();
    } catch {
      // The API client already showed the error. The dialog stays open so nothing is lost.
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    try {
      const result = await api.disputeBooking(booking.id, reason.trim());
      toast.success(result.data?.message || 'Problem reported. Your payment stays in escrow while we review it.');
      setDialog(null);
      setReason('');
      onChanged?.();
    } catch {
      // Same as above: error already shown, keep what the customer typed.
    } finally {
      setBusy(false);
    }
  };

  const reasonLength = reason.trim().length;

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        <GlassButton
          variant="primary"
          size="sm"
          leftIcon={<ShieldCheck className="size-4" aria-hidden="true" />}
          onClick={() => setDialog('confirm')}
        >
          Confirm and release payment
        </GlassButton>
        <GlassButton variant="outline" size="sm" onClick={() => setDialog('report')}>
          Report a problem
        </GlassButton>
      </div>

      <GlassModal
        isOpen={dialog === 'confirm'}
        onClose={close}
        title={`Release ${formatPrice(booking.amount)} to ${booking.businessName}?`}
        description="Confirming says the service was done. The payment moves from escrow to the provider."
        size="sm"
      >
        <div className="space-y-4">
          {!booking.hasReview && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Rate your visit (optional)</p>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                    onClick={() => setRating(rating === value ? 0 : value)}
                    className="rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Star
                      className={cn(
                        'size-6',
                        value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <label htmlFor={`review-${booking.id}`} className="sr-only">
                    Review comment
                  </label>
                  <textarea
                    id={`review-${booking.id}`}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={REASON_MAX}
                    rows={3}
                    placeholder="What went well? (optional)"
                    className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <GlassButton variant="ghost" size="sm" onClick={close} disabled={busy}>
              Not yet
            </GlassButton>
            <GlassButton variant="primary" size="sm" onClick={confirm} isLoading={busy}>
              Release payment
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      <GlassModal
        isOpen={dialog === 'report'}
        onClose={close}
        title="Report a problem"
        description="Your payment stays in escrow while we look into it. We reply within 48 hours."
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor={`reason-${booking.id}`} className="mb-2 block text-sm text-muted-foreground">
              What went wrong?
            </label>
            <textarea
              id={`reason-${booking.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REASON_MAX}
              rows={4}
              placeholder="Tell us what happened, in at least a sentence."
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <p className="mt-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {reasonLength < REASON_MIN
                ? `${REASON_MIN - reasonLength} more ${REASON_MIN - reasonLength === 1 ? 'character' : 'characters'} needed`
                : `${reasonLength} / ${REASON_MAX}`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <GlassButton variant="ghost" size="sm" onClick={close} disabled={busy}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={report}
              isLoading={busy}
              disabled={reasonLength < REASON_MIN}
            >
              Send report
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </>
  );
}
