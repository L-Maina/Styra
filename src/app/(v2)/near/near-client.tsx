'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { LocateFixed, Navigation, Star } from 'lucide-react';
import { t } from '@/core/copy';
import { formatMoney } from '@/core/money';
import { formatRating } from '@/core/format';
import { Glass } from '@/components/v2/glass';
import { CoverAvatar } from '@/components/v2/cover';
import { SnipLoader } from '@/components/v2/snip-loader';
import { Button } from '@/components/v2/ui';
import { api } from '@/lib/v2/api';
import { duration, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { NearBusiness } from './near-map';

const NearMap = dynamic(() => import('./near-map').then((m) => m.NearMap), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-none" /> });

const CATS = ['', 'BARBER', 'BRAIDS', 'HAIR', 'NAILS', 'SPA', 'MASSAGE', 'MAKEUP'] as const;
const NAIROBI = { lat: -1.2864, lng: 36.8172 };
type Phase = 'ask' | 'locating' | 'ready';

export function NearClient() {
  const [phase, setPhase] = useState<Phase>('ask');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<NearBusiness[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const center = me ?? NAIROBI;

  // Fetch whenever the place or the filter changes. Resetting to the skeleton happens in the handlers.
  useEffect(() => {
    if (phase !== 'ready') return;
    let cancelled = false;
    const qs = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng), radiusKm: '25', limit: '50', ...(category ? { category } : {}) });
    api<{ items: NearBusiness[] }>(`/businesses?${qs}`)
      .catch(() => ({ items: [] as NearBusiness[] }))
      .then((data) => {
        if (!cancelled) setItems(data.items);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, center.lat, center.lng, category]);

  const pickCategory = (c: string) => {
    setItems(null);
    setCategory(c);
  };

  function locate() {
    setItems(null);
    setPhase('locating');
    if (!('geolocation' in navigator)) {
      setNotice(t('near.denied'));
      setPhase('ready');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNotice(null);
        setPhase('ready');
      },
      () => {
        setNotice(t('near.denied'));
        setPhase('ready');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // Selecting a pin scrolls its card into view.
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector<HTMLElement>(`[data-slug="${selected}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  const located = useMemo(() => (items ?? []).filter((b) => b.location), [items]);

  return (
    <div className="fixed inset-0 z-0">
      {/* Content layer: the map itself. Every control floats above it as glass. */}
      <div className="absolute inset-0 isolate z-0" role="region" aria-label={t('near.mapLabel')}>
        <NearMap center={center} me={me} items={located} selected={selected} onSelect={setSelected} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[5.25rem] z-10 flex justify-center px-3">
        <Glass className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none]">
          {CATS.map((c) => (
            <button
              key={c || 'all'}
              type="button"
              aria-pressed={category === c}
              onClick={() => pickCategory(c)}
              className={cn('min-h-11 whitespace-nowrap rounded-full px-4 text-[15px] font-semibold transition-colors', category === c ? 'bg-foreground text-background' : 'hover:bg-foreground/10')}
            >
              {c ? t(`browse.category.${c}` as never) : t('near.all')}
            </button>
          ))}
        </Glass>
      </div>

      {phase === 'ready' && me && (
        <div className="absolute right-4 top-[9.5rem] z-10">
          <Glass as="span" className="block rounded-full">
            <button type="button" aria-label={t('near.recenter')} onClick={locate} className="grid size-12 place-items-center rounded-full">
              <LocateFixed className="size-5" />
            </button>
          </Glass>
        </div>
      )}

      {/* Bottom sheet: glass chrome, opaque cards (money never sits on glass). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex justify-center px-3 md:bottom-6">
        <AnimatePresence mode="wait">
          {phase !== 'ready' ? (
            <motion.div key="ask" className="pointer-events-auto w-full max-w-md" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: duration.slow, ease: ease.spring }}>
              <Glass className="space-y-3 rounded-[28px] p-5 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-[image:var(--styra-gradient)] text-primary-foreground">
                  <Navigation className="size-5" />
                </span>
                <h2 className="text-[22px] font-semibold">{t('near.promptTitle')}</h2>
                <p className="text-[15px]">{t('near.promptBody')}</p>
                {phase === 'locating' ? (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <SnipLoader size={28} label={t('near.locating')} />
                    <span className="text-[15px] font-semibold">{t('near.locating')}…</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button onClick={locate} className="w-full min-h-[52px] text-[17px]">{t('actions.shareLocation')}</Button>
                    <Button tone="quiet" onClick={() => setPhase('ready')} className="w-full">{t('actions.notNow')}</Button>
                  </div>
                )}
              </Glass>
            </motion.div>
          ) : (
            <motion.div key="list" className="pointer-events-auto w-full max-w-3xl" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: duration.slow, ease: ease.spring }}>
              <Glass className="rounded-[28px] pb-3 pt-2">
                <div className="flex justify-center pb-1">
                  <span aria-hidden className="h-1.5 w-10 rounded-full bg-foreground/35" />
                </div>
                <p className="px-5 pb-2 text-[15px] font-semibold" aria-live="polite">
                  {items === null ? t('system.loading') : t('near.count', { count: located.length })}
                  {notice && <span className="block text-[13px] font-normal">{notice}</span>}
                </p>
                <ul ref={listRef} className="flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                  {items === null
                    ? Array.from({ length: 3 }, (_, i) => <li key={i} className="skeleton h-[92px] w-[260px] shrink-0 rounded-2xl" />)
                    : located.map((b) => (
                        <li key={b.slug} data-slug={b.slug} className="snap-center">
                          <Link
                            href={`/b/${b.slug}`}
                            onMouseEnter={() => setSelected(b.slug)}
                            onFocus={() => setSelected(b.slug)}
                            className={cn(
                              'press flex w-[280px] shrink-0 items-center gap-3 rounded-2xl border bg-[var(--surface-1)] p-3 transition-colors',
                              selected === b.slug ? 'border-primary' : 'border-[var(--hairline)]',
                            )}
                          >
                            <CoverAvatar name={b.name} category={b.category} className="size-16" />
                            <span className="min-w-0">
                              <span className="block truncate text-[17px] font-semibold">{b.name}</span>
                              <span className="flex items-center gap-1 text-[13px] tabular-nums">
                                <Star aria-hidden className="size-3.5 fill-current" />
                                {formatRating(b.rating.avg, b.rating.count)}
                                {b.distanceKm != null && ` · ${t('near.away', { km: b.distanceKm })}`}
                              </span>
                              {b.fromPriceMinor != null && <span className="block text-[13px] font-semibold tabular-nums">{t('browse.from', { price: formatMoney(BigInt(b.fromPriceMinor)) })}</span>}
                            </span>
                          </Link>
                        </li>
                      ))}
                </ul>
              </Glass>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
