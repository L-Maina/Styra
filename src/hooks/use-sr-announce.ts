'use client';

import { useCallback, useRef, useEffect } from 'react';

interface AnnouncementQueueItem {
  message: string;
  politeness: 'polite' | 'assertive';
}

/**
 * Hook for announcing messages to screen readers.
 * Creates a dynamic ARIA live region and queues rapid successive announcements.
 */
export function useSrAnnounce() {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<AnnouncementQueueItem[]>([]);
  const isProcessingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processQueueRef = useRef<() => void>(() => {});

  const getOrCreateRegion = useCallback(
    (politeness: 'polite' | 'assertive'): HTMLDivElement => {
      const id = `sr-announce-${politeness}`;
      let region = document.getElementById(id) as HTMLDivElement | null;

      if (!region) {
        region = document.createElement('div');
        region.id = id;
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', politeness);
        region.setAttribute('aria-atomic', 'true');

        Object.assign(region.style, {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        });

        document.body.appendChild(region);
      }

      regionRef.current = region;
      return region;
    },
    []
  );

  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return;
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    const item = queueRef.current.shift()!;

    const region = getOrCreateRegion(item.politeness);

    // Clear and re-add message for screen reader detection
    requestAnimationFrame(() => {
      region.textContent = '';
      void region.offsetHeight; // Force reflow
      region.textContent = item.message;

      timerRef.current = setTimeout(() => {
        isProcessingRef.current = false;
        region.textContent = '';
        processQueueRef.current();
      }, 300);
    });
  }, [getOrCreateRegion]);

  // Keep ref in sync
  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const announce = useCallback(
    (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
      queueRef.current.push({ message, politeness });
      processQueueRef.current();
    },
    []
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Remove any dynamic regions
    ['sr-announce-polite', 'sr-announce-assertive'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) document.body.removeChild(el);
    });
  }, []);

  return { announce, cleanup };
}
