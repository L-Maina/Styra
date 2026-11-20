'use client';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { t } from '@/core/copy';
import { Glass } from '@/components/v2/glass';
import { duration, ease } from '@/lib/motion';

interface Photo {
  id: string;
  url: string;
  caption: string | null;
}

/** Gallery grid; a photo morphs into a full-screen lightbox (shared layout), swipes with resistance at the ends. */
export function Gallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : Math.min(photos.length - 1, Math.max(0, i + d)))), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, go]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 140) return close();
    if (info.offset.x < -80) go(1);
    else if (info.offset.x > 80) go(-1);
  }

  const current = open === null ? null : photos[open];
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.id} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
            <button type="button" onClick={() => setOpen(i)} className="press block w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={p.caption ?? t('business.photoOf', { index: i + 1, count: photos.length })}>
              <motion.div layoutId={`photo-${p.id}`} className="relative aspect-square w-full bg-[var(--surface-2)]">
                <Image src={p.url} alt={p.caption ?? `${name} ${i + 1}`} fill sizes={i === 0 ? '(max-width: 640px) 100vw, 66vw' : '(max-width: 640px) 50vw, 33vw'} className="object-cover transition-transform duration-[var(--duration-slow)] hover:scale-[1.04]" />
              </motion.div>
            </button>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {current && open !== null && (
          <motion.div key="lightbox" role="dialog" aria-modal="true" aria-label={t('business.gallery')} className="fixed inset-0 z-[70] bg-black/90" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.base }}>
            <motion.div
              className="absolute inset-0 grid place-items-center p-4"
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={{ left: open === photos.length - 1 ? 0.15 : 0.6, right: open === 0 ? 0.15 : 0.6, top: 0.1, bottom: 0.6 }}
              onDragEnd={onDragEnd}
            >
              <motion.div layoutId={`photo-${current.id}`} className="relative h-full max-h-[80dvh] w-full max-w-4xl" transition={{ duration: duration.slow, ease: ease.standard }}>
                <Image src={current.url} alt={current.caption ?? `${name} ${open + 1}`} fill sizes="100vw" className="object-contain" priority />
              </motion.div>
            </motion.div>
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
              <Glass className="pointer-events-auto flex items-center gap-3 rounded-full py-1 pl-4 pr-1">
                <span className="text-[15px] font-semibold tabular-nums">{t('business.photoOf', { index: open + 1, count: photos.length })}</span>
                <button type="button" onClick={close} aria-label={t('actions.close')} className="grid size-11 place-items-center rounded-full hover:bg-foreground/10">
                  <X className="size-5" />
                </button>
              </Glass>
            </div>
            {current.caption && (
              <p className="absolute inset-x-0 bottom-8 px-6 text-center text-[17px] text-white">{current.caption}</p>
            )}
            <div className="absolute inset-y-0 left-2 hidden items-center md:flex">
              <button type="button" onClick={() => go(-1)} disabled={open === 0} aria-label={t('nav.back')} className="grid size-12 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-30">
                <ChevronLeft className="size-7" />
              </button>
            </div>
            <div className="absolute inset-y-0 right-2 hidden items-center md:flex">
              <button type="button" onClick={() => go(1)} disabled={open === photos.length - 1} aria-label={t('business.photoOf', { index: Math.min(open + 2, photos.length), count: photos.length })} className="grid size-12 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-30">
                <ChevronRight className="size-7" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
