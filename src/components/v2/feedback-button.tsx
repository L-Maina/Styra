'use client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { duration, ease } from '@/lib/motion';
import { Button } from './ui';
import { SnipLoader } from './snip-loader';

export type FeedbackState = 'idle' | 'busy' | 'done';

const swap = {
  initial: { opacity: 0, scale: 0.6, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.6, filter: 'blur(4px)' },
  transition: { duration: duration.fast, ease: ease.standard },
};

/**
 * A button that shows its own progress: the label stays (keeping the width) while the snip loader
 * crossfades in, then a check draws on success. Pass `onAction` (return false on failure) or control
 * `state` yourself for form submits.
 */
export function FeedbackButton({
  onAction,
  state: controlled,
  children,
  className,
  disabled,
  ...rest
}: Omit<ComponentProps<typeof Button>, 'onClick'> & { onAction?: () => Promise<boolean | void>; state?: FeedbackState }) {
  const [own, setOwn] = useState<FeedbackState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = controlled ?? own;
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function run() {
    if (!onAction || state !== 'idle') return;
    setOwn('busy');
    const ok = (await onAction().catch(() => false)) !== false;
    if (!ok) return setOwn('idle');
    setOwn('done');
    timer.current = setTimeout(() => setOwn('idle'), 1100);
  }

  return (
    <Button {...rest} onClick={onAction ? run : undefined} disabled={disabled || state !== 'idle'} aria-busy={state === 'busy'} className={cn('relative disabled:opacity-100', className)}>
      <span className={cn('transition-opacity duration-[var(--duration-fast)]', state === 'idle' ? 'opacity-100' : 'opacity-0')}>{children}</span>
      <AnimatePresence>
        {state === 'busy' && (
          <motion.span key="busy" className="absolute inset-0 grid place-items-center" {...swap}>
            <SnipLoader size={22} />
          </motion.span>
        )}
        {state === 'done' && (
          <motion.span key="done" className="absolute inset-0 grid place-items-center" {...swap}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path d="M5 12.5l4.2 4.2L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.standard }} />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
