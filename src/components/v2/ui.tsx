import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/core/money';
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from 'react';

type Tone = 'primary' | 'secondary' | 'quiet' | 'danger';
const tones: Record<Tone, string> = {
  // The gradient is the brand's one loud colour: primary actions only.
  primary: 'sheen bg-[image:var(--styra-gradient)] text-primary-foreground shadow-[0_8px_20px_-12px_rgb(0_0_0/0.6)]',
  secondary: 'bg-foreground/[0.07] text-foreground border border-input hover:bg-foreground/[0.1]',
  quiet: 'bg-transparent text-foreground hover:bg-foreground/[0.06]',
  danger: 'bg-transparent text-destructive border border-destructive/50 hover:bg-destructive/10',
};
const base =
  'press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold tracking-[-0.005em] transition-[background,opacity,transform] duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none';

export function Button({ tone = 'primary', className, ...rest }: ComponentProps<'button'> & { tone?: Tone }) {
  return <button className={cn(base, tones[tone], className)} {...rest} />;
}

export function ButtonLink({ tone = 'primary', className, ...rest }: ComponentPropsWithoutRef<typeof Link> & { tone?: Tone }) {
  return <Link className={cn(base, tones[tone], className)} {...rest} />;
}

/** Money is always opaque, tabular and formatted from minor units. */
export function Money({ minor, className }: { minor: number; className?: string }) {
  return <span className={cn('tabular-nums whitespace-nowrap', className)}>{formatMoney(BigInt(minor))}</span>;
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-sans text-[22px] font-semibold tracking-[-0.01em] normal-case">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] px-6 py-12 text-center">
      <p className="text-[19px] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[15px] text-muted-foreground">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

type StatusTone = 'neutral' | 'good' | 'attention' | 'warning';
const statusTones: Record<StatusTone, string> = {
  neutral: 'bg-foreground/[0.07] text-foreground',
  good: 'bg-[color-mix(in_oklab,var(--success,#3fc6a0)_16%,transparent)] text-foreground',
  attention: 'bg-primary/15 text-foreground',
  warning: 'bg-[color-mix(in_oklab,#e59b37_18%,transparent)] text-foreground',
};
export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const dot = { neutral: 'bg-foreground/50', good: 'bg-emerald-500', attention: 'bg-primary', warning: 'bg-amber-500' }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold', statusTones[tone])}>
      <span aria-hidden className={cn('size-1.5 rounded-full', dot)} />
      {children}
    </span>
  );
}
