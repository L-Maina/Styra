'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { t } from '@/core/copy';
import { ease } from '@/lib/motion';

const KEY = 'styra.v2.launched';
/** Runs before first paint: a repeat visit in this session, or reduced motion, never shows the splash. */
export const launchGuard = `try{if(sessionStorage.getItem('${KEY}')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.v2Launched='1'}catch(e){}`;

export const TOP = 'M71 31C71 31.825 70.952 32.64 70.86 33.44C69.856 26.131 63.585 20.5 56 20.5C47.716 20.5 41 27.216 41 35.5C41 38.562 41.917 41.41 43.492 43.783C41.991 45.354 41.053 47.467 41.002 49.8C40.915 49.817 40.829 49.836 40.743 49.855C33.787 46.433 29 39.276 29 31C29 19.402 38.402 10 50 10C61.598 10 71 19.402 71 31Z';
export const BOTTOM = 'M71 69C71 80.598 61.598 90 50 90C38.402 90 29 80.598 29 69C29 68.175 29.048 67.36 29.14 66.56C30.144 73.869 36.415 79.5 44 79.5C52.284 79.5 59 72.784 59 64.5C59 61.438 58.083 58.59 56.508 56.217C58.047 54.606 58.995 52.424 59 50.021C66.095 53.391 71 60.623 71 69Z';
const SPIRAL = 'M50.00 40.00 L51.10 39.79 L52.25 39.70 L53.43 39.75 L54.63 39.93 L55.83 40.25 L57.00 40.72 L58.15 41.33 L59.24 42.07 L60.26 42.96 L61.20 43.98 L62.03 45.11 L62.75 46.36 L63.33 47.70 L63.77 49.13 L64.06 50.63 L64.18 52.18 L64.12 53.76 L63.89 55.36 L63.47 56.94 L62.88 58.50 L62.10 60.01 L61.14 61.44 L60.01 62.79 L58.72 64.02 L57.28 65.12 L55.71 66.07 L54.01 66.86 L52.21 67.46 L50.32 67.87 L48.37 68.07 L46.39 68.06 L44.39 67.82 L42.39 67.36 L40.44 66.68 L38.54 65.78 L36.73 64.65 L35.03 63.32 L33.46 61.79 L32.05 60.08 L30.82 58.20 L29.79 56.17 L28.98 54.01 L28.40 51.75 L28.07 49.41 L27.99 47.02 L28.17 44.60 L28.62 42.20 L29.34 39.82 L30.33 37.52 L31.57 35.30 L33.07 33.22 L34.80 31.28 L36.75 29.53 L38.90 27.98 L41.24 26.66 L43.73 25.59 L46.35 24.79 L49.08 24.27 L51.87 24.05 L54.69 24.14 L57.52 24.53 L60.32 25.24 L63.06 26.25 L65.69 27.57 L68.19 29.18 L70.52 31.07 L72.65 33.23 L74.56 35.62 L76.21 38.24 L77.58 41.04 L78.65 44.00 L79.40 47.09 L79.81 50.27 L79.88 53.50 L79.60 56.76 L78.95 59.99 L77.96 63.16 L76.61 66.23 L74.93 69.16 L72.92 71.92 L70.61 74.46 L68.01 76.76 L65.16 78.78 L62.07 80.50 L58.80 81.88 L55.36 82.91 L51.81 83.57 L48.18 83.84 L44.51 83.71 L40.84 83.19 L37.23 82.26 L33.71 80.94 L30.32 79.24 L27.12 77.16 L24.13 74.73 L21.41 71.97 L18.98 68.91 L16.88 65.58 L15.14 62.02 L13.79 58.27 L12.84 54.36 L12.32 50.34 L12.23 46.26 L12.58 42.16 L13.38 38.10 L14.63 34.12 L16.31 30.28 L18.40 26.61 L20.90 23.16 L23.78 19.98 L27.00 17.12 L30.54 14.60 L34.35 12.46 L38.40 10.73 L42.64 9.45 L47.02 8.62 L51.50 8.27 L56.02 8.40 L60.52 9.03 L64.96 10.14 L69.28 11.74 L73.43 13.81 L77.35 16.32 L81.01 19.27 L84.34 22.61 L87.32 26.32 L89.89 30.35 L92.03 34.66 L93.70 39.20 L94.88 43.92 L95.54 48.77 L95.68 53.70 L95.28 58.64 L94.35 63.54 L92.89 68.33 L90.91 72.97 L88.42 77.39 L85.46 81.54 L82.04 85.37 L78.21 88.83';
const SNIP = { duration: 0.9, ease: ease.standard, times: [0, 0.25, 0.5, 0.75, 1], delay: 0.35 };

/**
 * The launch moment (design-language section 6): the S is two scissor blades. They snip twice around the
 * violet pivot, a spiral draws out from the mark, the motto lands, and the splash lifts. Once per session.
 * It is only an overlay: the page renders and loads underneath, so the app is ready when it lifts.
 */
export function LaunchSplash() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);
  useEffect(() => {
    // On repeat visits the CSS guard already hides the splash; just unmount it on the next tick.
    const seen = Boolean(document.documentElement.dataset.v2Launched) || reduce;
    if (!seen) {
      try {
        sessionStorage.setItem(KEY, '1');
      } catch {}
    }
    const id = setTimeout(() => setShow(false), seen ? 0 : 2600);
    return () => clearTimeout(id);
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="v2-splash fixed inset-0 z-[100] grid place-items-center bg-background"
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.5, ease: ease.exit }}
        >
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_45%,oklch(0.5_0.2_280/0.35),transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-6">
            <svg viewBox="0 0 100 100" className="size-44" aria-hidden>
              <defs>
                <linearGradient id="spiral-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8780FD" />
                  <stop offset="100%" stopColor="#2F7BFF" />
                </linearGradient>
              </defs>
              <motion.path d={SPIRAL} fill="none" stroke="url(#spiral-g)" strokeWidth={1.8} strokeLinecap="round" initial={{ pathLength: 0, opacity: 0.9 }} animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }} transition={{ duration: 1.1, delay: 1.1, ease: ease.standard }} />
              <motion.g initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, ease: ease.spring }} style={{ originX: '50px', originY: '50px' }}>
                <motion.path d={TOP} className="fill-foreground" style={{ originX: '50px', originY: '50px' }} animate={{ rotate: [0, -24, 0, -24, 0] }} transition={SNIP} />
                <motion.path d={BOTTOM} className="fill-foreground" style={{ originX: '50px', originY: '50px' }} animate={{ rotate: [0, 24, 0, 24, 0] }} transition={SNIP} />
                <motion.circle cx={50} cy={50} r={5.5} className="fill-primary" animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 0.5, delay: 1.25 }} />
              </motion.g>
            </svg>
            <motion.p
              className="font-[family-name:var(--font-syne)] text-[22px] font-bold uppercase tracking-[0.02em]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.5, ease: ease.spring }}
            >
              {t('brand.motto')}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
