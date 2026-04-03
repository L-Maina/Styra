'use client';

import { useRef, useEffect } from 'react';

interface AriaLiveRegionProps {
  /** Message to announce to screen readers */
  message: string | null;
  /** Politeness level for the live region */
  politeness?: 'polite' | 'assertive' | 'off';
  /** ARIA role for the region */
  role?: 'status' | 'alert' | 'log';
  /** Delay in ms before clearing the message (0 to disable auto-clear) */
  clearDelay?: number;
  /** Additional CSS classes */
  className?: string;
}

export function AriaLiveRegion({
  message,
  politeness = 'polite',
  role = 'status',
  clearDelay = 5000,
  className,
}: AriaLiveRegionProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;

    // Use requestAnimationFrame for reliable screen reader detection
    const rafId = requestAnimationFrame(() => {
      if (regionRef.current) {
        regionRef.current.textContent = '';
        // Force a reflow so screen readers detect the change
        void regionRef.current.offsetHeight;
        regionRef.current.textContent = message;
      }
    });

    if (clearDelay > 0) {
      timerRef.current = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = '';
        }
      }, clearDelay);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, clearDelay]);

  return (
    <div
      ref={regionRef}
      role={role}
      aria-live={politeness}
      aria-atomic="true"
      className={className ?? 'sr-only'}
    />
  );
}
