'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { t } from '@/core/copy';
import { DISPLAY_TIME_ZONE, formatDuration, formatTime } from '@/core/format';
import { formatMoney } from '@/core/money';
import { Glass } from '@/components/v2/glass';
import { Button, ButtonLink, Money, Section } from '@/components/v2/ui';
import { api, ApiFailure } from '@/lib/v2/api';
import { duration, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { BookingDto } from '@/contracts/booking';

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceMinor: number;
}

type Step = 'time' | 'pay' | 'done';

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: DISPLAY_TIME_ZONE });
function nextDays(n: number) {
  const out: { key: string; weekday: string; day: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() + i * 86400_000);
    out.push({
      key: dayKey(d),
      weekday: d.toLocaleDateString('en-GB', { timeZone: DISPLAY_TIME_ZONE, weekday: 'short' }),
      day: d.toLocaleDateString('en-GB', { timeZone: DISPLAY_TIME_ZONE, day: 'numeric' }),
    });
  }
  return out;
}

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return null;
  const left = Math.max(0, new Date(until).getTime() - now);
  return `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
}

const haptic = (ms: number) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(ms);
};

export function BookingFlow({
  business,
  services,
  signedIn,
  methods,
}: {
  business: { slug: string; name: string; category: string };
  services: Service[];
  signedIn: boolean;
  methods: ('MPESA' | 'PAYSTACK' | 'FAKE')[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('time');
  const days = useMemo(() => nextDays(14), []);
  const [date, setDate] = useState(days[0].key);
  const [slots, setSlots] = useState<{ startAt: string; staffId: string }[] | null>(null);
  const [slot, setSlot] = useState<{ startAt: string; staffId: string } | null>(null);
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const service = services.find((s) => s.id === serviceId) ?? null;
  const held = useCountdown(step === 'pay' ? booking?.expiresAt ?? null : null);

  const loadSlots = useCallback(async () => {
    if (!serviceId) return;
    setSlots(null);
    setSlot(null);
    try {
      const data = await api<{ slots: { startAt: string; staffId: string }[] }>(`/businesses/${business.slug}/slots?serviceId=${serviceId}&date=${date}`);
      setSlots(data.slots);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : t('errors.SERVER_ERROR', { ref: '—' }));
      setSlots([]);
    }
  }, [business.slug, serviceId, date]);

  useEffect(() => {
    if (open && step === 'time') void loadSlots();
  }, [open, step, loadSlots]);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    if (step === 'done') {
      setStep('time');
      setBooking(null);
    }
    requestAnimationFrame(() => openerRef.current?.focus());
  }, [step]);

  // Escape closes; Tab stays inside the sheet while it is open.
  useEffect(() => {
    if (!open) return;
    const el = sheetRef.current;
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key !== 'Tab' || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, step, close]);

  async function bookAndPay() {
    if (!service || !slot) return;
    setBusy(true);
    setError(null);
    haptic(10);
    try {
      const { booking: b } = await api<{ booking: BookingDto }>('/bookings', { body: { serviceId: service.id, startAt: slot.startAt, staffId: slot.staffId } });
      setBooking(b);
      setStep('pay');
    } catch (e) {
      const f = e as ApiFailure;
      setError(f.message);
      if (f.code === 'SLOT_TAKEN' || f.code === 'SLOT_IN_PAST') void loadSlots();
    } finally {
      setBusy(false);
    }
  }

  const [phone, setPhone] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [slow, setSlow] = useState(false);

  // While M-Pesa asks the customer for their PIN, poll the booking until it is confirmed or the hold runs out.
  useEffect(() => {
    if (!waiting || !booking) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const { booking: b } = await api<{ booking: BookingDto }>(`/bookings/${booking.code}`);
        if (b.status === 'CONFIRMED') {
          setBooking(b);
          setWaiting(false);
          setStep('done');
          haptic(30);
          return;
        }
        if (b.status !== 'PENDING') {
          setWaiting(false);
          setError(t('errors.HOLD_EXPIRED'));
          setStep('time');
          setBooking(null);
          return;
        }
      } catch {
        /* keep polling through brief network drops */
      }
      if (Date.now() - started > 90_000) {
        setWaiting(false);
        setSlow(true);
        return;
      }
      setTimeout(tick, 3000);
    };
    const id = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(id);
    };
  }, [waiting, booking]);

  async function pay(method: 'MPESA' | 'PAYSTACK' | 'FAKE') {
    if (!booking) return;
    setBusy(true);
    setError(null);
    setSlow(false);
    haptic(10);
    try {
      const res = await api<{ booking: BookingDto; next: { kind: 'DONE' } | { kind: 'WAIT_FOR_PHONE' } | { kind: 'REDIRECT'; url: string } }>(`/bookings/${booking.code}/pay`, {
        body: { method, phone: method === 'MPESA' ? phone : undefined },
        idempotencyKey: `${booking.id}:${method}:${Date.now()}`,
      });
      setBooking(res.booking);
      if (res.next.kind === 'DONE') {
        setStep('done');
        haptic(30);
      } else if (res.next.kind === 'WAIT_FOR_PHONE') {
        setWaiting(true);
      } else {
        window.location.assign(res.next.url);
      }
    } catch (e) {
      const f = e as ApiFailure;
      setError(f.message);
      if (f.code === 'HOLD_EXPIRED') {
        setStep('time');
        setBooking(null);
      }
    } finally {
      setBusy(false);
    }
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) close();
  }

  const spring = { type: 'tween' as const, duration: duration.slow, ease: ease.spring };

  return (
    <>
      <Section title={t('business.services')}>
        {services.length ? (
          <ul className="divide-y divide-[var(--hairline)] overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
            {services.map((s) => {
              const selected = s.id === serviceId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setServiceId(s.id)}
                    className={cn('flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors', selected ? 'bg-primary/10' : 'hover:bg-foreground/[0.04]')}
                  >
                    <span>
                      <span className="block text-[17px] font-semibold">{s.name}</span>
                      <span className="block text-[15px] text-muted-foreground">{formatDuration(s.durationMin)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Money minor={s.priceMinor} className="text-[17px] font-semibold" />
                      <span aria-hidden className={cn('grid size-6 place-items-center rounded-full border', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                        {selected && <Check className="size-4" strokeWidth={3} />}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[15px] text-muted-foreground">{t('business.noServices')}</p>
        )}
      </Section>

      {/* Sticky Book bar: regular glass. It grows into the booking sheet (the one signature moment). */}
      <AnimatePresence>
        {service && !open && (
          <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
            <motion.div layoutId="booking-surface" transition={spring} className="w-full max-w-lg rounded-[28px]">
              <Glass className="flex items-center justify-between gap-3 rounded-[28px] py-2 pl-5 pr-2">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{service.name}</span>
                  <span className="block text-[13px]">
                    {formatDuration(service.durationMin)} · <Money minor={service.priceMinor} />
                  </span>
                </span>
                <Button ref={openerRef} onClick={() => (setOpen(true), haptic(10))} className="shrink-0">
                  {t('actions.chooseTime')}
                </Button>
              </Glass>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && service && (
          <>
            <motion.div
              key="dim"
              aria-hidden
              className="fixed inset-0 z-50 bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.base }}
              onClick={close}
            />
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center md:bottom-6 md:px-4">
              <motion.div
                layoutId="booking-surface"
                transition={spring}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={onDragEnd}
                className="pointer-events-auto w-full max-w-lg"
              >
                <Glass
                  ref={sheetRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sheet-title"
                  className="max-h-[88vh] overflow-y-auto rounded-t-[28px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 md:rounded-[28px]"
                >
                  <div className="flex justify-center py-2">
                    <span aria-hidden className="h-1.5 w-10 rounded-full bg-foreground/35" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="sheet-title" tabIndex={-1} data-autofocus className="text-[22px] font-bold leading-tight outline-none">
                      {step === 'done' ? t('booking.confirmed.title') : t('booking.sheet.title', { service: service.name })}
                    </h2>
                    <button type="button" onClick={close} aria-label={t('actions.close')} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-foreground/10">
                      <X className="size-5" />
                    </button>
                  </div>

                  {/* Money sits on an opaque card, never on the glass itself. */}
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--surface-1)] px-4 py-3">
                    <span className="text-[15px]">
                      {t('booking.sheet.summary', { service: service.name, duration: formatDuration(service.durationMin) })}
                      {slot && step !== 'time' && booking && (
                        <span className="block font-semibold">{`${new Date(booking.startAt).toLocaleDateString('en-GB', { timeZone: DISPLAY_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(new Date(booking.startAt))}`}</span>
                      )}
                    </span>
                    <Money minor={service.priceMinor} className="text-[19px] font-bold" />
                  </div>

                  {error && (
                    <p role="alert" className="mt-4 rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px] font-semibold">
                      {error}
                    </p>
                  )}

                  {step === 'time' && (
                    <div className="mt-5 space-y-5">
                      <fieldset>
                        <legend className="mb-2 text-[15px] font-semibold">{t('booking.sheet.pickDay')}</legend>
                        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                          {days.map((d) => (
                            <button
                              key={d.key}
                              type="button"
                              aria-pressed={date === d.key}
                              onClick={() => (setDate(d.key), haptic(5))}
                              className={cn(
                                'flex min-h-[60px] min-w-[56px] flex-col items-center justify-center rounded-2xl text-[13px] font-semibold',
                                date === d.key ? 'bg-foreground text-background' : 'bg-[var(--surface-1)]',
                              )}
                            >
                              <span>{d.weekday}</span>
                              <span className="text-[19px] tabular-nums">{d.day}</span>
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend className="mb-2 text-[15px] font-semibold">{t('booking.sheet.pickTime')}</legend>
                        {slots === null ? (
                          <div className="grid grid-cols-4 gap-2" aria-busy="true" aria-label={t('system.loading')}>
                            {Array.from({ length: 8 }, (_, i) => (
                              <div key={i} className="shimmer h-11 rounded-xl bg-[var(--surface-1)]" />
                            ))}
                          </div>
                        ) : slots.length ? (
                          <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto">
                            {slots.map((s) => (
                              <button
                                key={s.startAt}
                                type="button"
                                aria-pressed={slot?.startAt === s.startAt}
                                onClick={() => (setSlot(s), haptic(5))}
                                className={cn(
                                  'min-h-11 rounded-xl text-[15px] font-semibold tabular-nums',
                                  slot?.startAt === s.startAt ? 'bg-foreground text-background' : 'bg-[var(--surface-1)]',
                                )}
                              >
                                {formatTime(new Date(s.startAt))}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px]">{t('booking.sheet.noTimes')}</p>
                        )}
                      </fieldset>
                      {signedIn ? (
                        <Button onClick={bookAndPay} disabled={!slot || busy} className="w-full min-h-[52px] text-[17px]">
                          {t('actions.bookAndPay')}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <ButtonLink href={`/signin?next=/b/${business.slug}`} className="w-full min-h-[52px] text-[17px]">
                            {t('actions.signIn')}
                          </ButtonLink>
                          <p className="text-center text-[13px]">{t('auth.signInToBook')}</p>
                        </div>
                      )}
                      <p className="text-center text-[15px]">{t('booking.sheet.heldLine')}</p>
                    </div>
                  )}

                  {step === 'pay' && booking && (
                    <div className="mt-5 space-y-4">
                      <p className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px]">
                        {t('checkout.payNow', { amount: formatMoney(BigInt(booking.priceMinor)) })}
                      </p>
                      {held && <p className="text-[15px] tabular-nums">{t('booking.holdTimer', { time: held })}</p>}
                      {waiting ? (
                        <p role="status" className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[17px]">
                          {t('checkout.sentPrompt', { phone })} {t('checkout.waiting')}
                        </p>
                      ) : (
                        <>
                          {slow && held && <p className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px]">{t('checkout.mpesaTimeout', { time: held })}</p>}
                          {methods.includes('MPESA') && (
                            <form
                              className="space-y-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void pay('MPESA');
                              }}
                            >
                              <label className="block text-[15px] font-semibold">
                                {t('checkout.phoneLabel')}
                                <input
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  required
                                  aria-describedby="phone-hint"
                                  className="mt-1 block h-12 w-full rounded-2xl border border-input bg-[var(--surface-1)] px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                <span id="phone-hint" className="mt-1 block text-[13px] font-normal">
                                  {t('checkout.phoneHint')}
                                </span>
                              </label>
                              <Button type="submit" disabled={busy || !phone} className="w-full min-h-[52px] text-[17px]">
                                {t('actions.payMpesa')}
                              </Button>
                            </form>
                          )}
                          {methods.includes('PAYSTACK') && (
                            <Button tone={methods.includes('MPESA') ? 'secondary' : 'primary'} onClick={() => pay('PAYSTACK')} disabled={busy} className="w-full min-h-[52px] text-[17px]">
                              {t('actions.payCard')}
                            </Button>
                          )}
                          {methods.includes('FAKE') && (
                            <>
                              <Button tone={methods.length > 1 ? 'secondary' : 'primary'} onClick={() => pay('FAKE')} disabled={busy} className="w-full min-h-[52px] text-[17px]">
                                {t('actions.payTest')}
                              </Button>
                              <p className="text-center text-[13px]">{t('checkout.testNotice')}</p>
                            </>
                          )}
                          {methods.length === 0 && <p className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px]">{t('errors.PROVIDER_UNAVAILABLE')}</p>}
                        </>
                      )}
                    </div>
                  )}

                  {step === 'done' && booking && (
                    <div className="mt-6 space-y-5 text-center">
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: duration.slow, ease: ease.spring }}
                        className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--surface-1)]"
                      >
                        <Check aria-hidden className="size-8 text-[var(--success)]" strokeWidth={3} />
                      </motion.div>
                      <p className="text-[17px]">{t('booking.confirmed.body')}</p>
                      <ButtonLink href={`/bookings/${booking.code}`} className="w-full min-h-[52px] text-[17px]">
                        {t('actions.viewBooking')}
                      </ButtonLink>
                    </div>
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
