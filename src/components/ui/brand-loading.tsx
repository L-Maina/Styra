'use client';

import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/ui/brand-logo';

// ============================================
// BrandLoading — Animated loading state with Styra logo
// ============================================
// Displays the Styra logo-icon with a pulse/scale animation.
// Use in loading.tsx files, async component boundaries, and placeholder states.

export interface BrandLoadingProps {
  /** Size of the logo (default: 48) */
  size?: number;
  /** Loading message below the logo */
  message?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the full-page layout (centered in viewport) */
  fullPage?: boolean;
  /** Animation type */
  animation?: 'pulse' | 'scale' | 'spin';
}

const animations = {
  pulse: {
    animate: { opacity: [1, 0.5, 1] },
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
  },
  scale: {
    animate: { scale: [1, 0.92, 1] },
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const },
  },
  spin: {
    animate: { rotate: 360 },
    transition: { duration: 2, repeat: Infinity, ease: 'linear' as const },
  },
};

export const BrandLoading: React.FC<BrandLoadingProps> = ({
  size = 48,
  message = 'Loading...',
  className = '',
  fullPage = false,
  animation = 'pulse',
}) => {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <motion.div {...animations[animation]}>
        <BrandLogo
          variant="icon"
          size={size}
          alt="Styra Loading"
        />
      </motion.div>
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

/** Skeleton loading state for card-like content areas */
export const BrandSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = '',
}) => (
  <div className={`space-y-4 ${className}`}>
    <div className="flex items-center gap-3 animate-pulse">
      <div
        className="rounded-full bg-muted"
        style={{ width: 48, height: 48 }}
      />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="p-4 rounded-xl bg-muted/30 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-36 bg-muted rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);
