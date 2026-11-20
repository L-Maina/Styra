'use client';

import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { useReducedMotion } from '@/components/ui/reduced-motion-provider';

/**
 * Applies the reduced-motion choice everywhere: the system setting, or the override in
 * the accessibility toolbar. framer-motion drops movement and keeps fades, and
 * <html data-motion> lets globals.css do the same for CSS animation and transitions.
 *
 * Must sit inside ReducedMotionProvider.
 */
export function MotionSettings({ children }: { children: ReactNode }) {
  const { prefersReducedMotion } = useReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.motion = prefersReducedMotion ? 'reduce' : 'full';
  }, [prefersReducedMotion]);

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? 'always' : 'never'}>
      {children}
    </MotionConfig>
  );
}
