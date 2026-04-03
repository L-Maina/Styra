'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { GlassButton } from './glass-components';
import { cn } from '@/lib/utils';

interface GlassEmptyStateProps {
  /** Lucide icon component or custom JSX icon node */
  icon?: LucideIcon | React.ReactNode;
  /** Heading text */
  title: string;
  /** Optional descriptive text below the title */
  description?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline' | 'ghost';
  };
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export function GlassEmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: GlassEmptyStateProps) {
  const sizeConfig = {
    sm: {
      container: 'py-8 px-4',
      iconWrapper: 'w-12 h-12 rounded-xl',
      iconSize: 'h-6 w-6',
      titleClass: 'text-sm font-semibold',
      descClass: 'text-xs',
    },
    md: {
      container: 'py-12 px-6',
      iconWrapper: 'w-16 h-16 rounded-2xl',
      iconSize: 'h-8 w-8',
      titleClass: 'text-base font-semibold',
      descClass: 'text-sm',
    },
    lg: {
      container: 'py-16 px-8',
      iconWrapper: 'w-20 h-20 rounded-2xl',
      iconSize: 'h-10 w-10',
      titleClass: 'text-lg font-bold',
      descClass: 'text-sm',
    },
  };

  const cfg = sizeConfig[size];

  // Resolve icon to JSX — support LucideIcon components or raw ReactNode
  const isLucideIcon = icon != null && typeof icon === 'function' && typeof (icon as any).$$typeof === 'symbol';
  const IconNode = isLucideIcon
    ? (() => { const Ic = icon as LucideIcon; return <Ic className={cn(cfg.iconSize, 'text-muted-foreground')} />; })()
    : icon
      ? <span className={cn(cfg.iconSize, 'text-muted-foreground flex items-center justify-center')}>{icon as React.ReactNode}</span>
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center text-center w-full',
        cfg.container,
        className,
      )}
    >
      {/* Glow effect behind icon */}
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-2xl scale-150" />
        <div
          className={cn(
            cfg.iconWrapper,
            'relative flex items-center justify-center',
            'bg-muted/40 border border-border/50',
            'backdrop-blur-sm',
            'shadow-sm',
          )}
        >
          {IconNode}
        </div>
      </div>

      <h3 className={cn('mb-1.5 text-foreground', cfg.titleClass)}>
        {title}
      </h3>

      {description && (
        <p className={cn('text-muted-foreground max-w-xs mb-5 leading-relaxed', cfg.descClass)}>
          {description}
        </p>
      )}

      {action && (
        <GlassButton
          variant={action.variant || 'primary'}
          size="sm"
          onClick={action.onClick}
        >
          {action.label}
        </GlassButton>
      )}
    </motion.div>
  );
}

export default GlassEmptyState;
