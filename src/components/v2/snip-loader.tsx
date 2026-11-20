'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { t } from '@/core/copy';
import { ease } from '@/lib/motion';
import { BOTTOM, TOP } from './launch';

/**
 * The launch mark in miniature: the two blades keep snipping around the pivot while something is working
 * (payments, booking steps, page loads). Under reduced motion it holds still and the pivot pulses gently.
 */
export function SnipLoader({ size = 28, label, className = '' }: { size?: number; label?: string; className?: string }) {
  const reduce = useReducedMotion();
  const loop = { duration: 1.1, ease: ease.standard, repeat: Infinity, times: [0, 0.3, 0.6, 1] };
  return (
    <span role="status" aria-label={label ?? t('system.loading')} className={`inline-grid place-items-center ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <motion.path d={TOP} className="fill-foreground" style={{ originX: '50px', originY: '50px' }} animate={reduce ? undefined : { rotate: [0, -26, 0, 0] }} transition={loop} />
        <motion.path d={BOTTOM} className="fill-foreground" style={{ originX: '50px', originY: '50px' }} animate={reduce ? undefined : { rotate: [0, 26, 0, 0] }} transition={loop} />
        <motion.circle cx={50} cy={50} r={6} className="fill-primary" animate={{ scale: [1, 1.3, 1] }} style={{ originX: '50px', originY: '50px' }} transition={{ duration: 1.1, repeat: Infinity, ease: ease.standard }} />
      </svg>
    </span>
  );
}

export type StepState = 'todo' | 'active' | 'done';

/** "Checking your time", "Holding your slot", ... each step snips while active and settles into a check. */
export function ProgressSteps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="space-y-3 rounded-2xl bg-[var(--surface-1)] p-4" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} className={`flex items-center gap-3 text-[17px] transition-opacity ${s.state === 'todo' ? 'opacity-40' : 'opacity-100'}`}>
          <span className="grid size-7 place-items-center">
            {s.state === 'active' ? (
              <SnipLoader size={26} label={s.label} />
            ) : s.state === 'done' ? (
              <svg viewBox="0 0 24 24" className="size-6 text-[var(--success)]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path d="M5 12.5l4.2 4.2L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: ease.standard }} />
              </svg>
            ) : (
              <span aria-hidden className="size-2 rounded-full bg-foreground/40" />
            )}
          </span>
          <span className={s.state === 'active' ? 'font-semibold' : ''}>{s.state === 'active' ? `${s.label}…` : s.label}</span>
        </li>
      ))}
    </ol>
  );
}
