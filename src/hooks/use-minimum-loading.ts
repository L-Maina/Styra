'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Ensures a loading state is shown for at least a minimum duration.
 * This prevents skeleton loading from flashing too quickly when API responses are fast.
 *
 * @param isLoading - The actual loading state from data fetching
 * @param minimumMs - Minimum time in ms to show the loading state (default: 1200ms)
 * @returns adjustedLoading - Whether to show the loading/skeleton UI
 */
export function useMinimumLoading(isLoading: boolean, minimumMs = 1200): boolean {
  const [adjustedLoading, setAdjustedLoading] = useState(isLoading);
  const loadingStartTime = useRef<number | null>(null);
  const minimumTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMinTimeout = useCallback(() => {
    if (minimumTimeoutRef.current) {
      clearTimeout(minimumTimeoutRef.current);
      minimumTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // When loading starts, record the time
    if (isLoading) {
      if (!loadingStartTime.current) {
        loadingStartTime.current = Date.now();
      }
      // Show loading state immediately via state update (from prop change, not effect)
      if (!adjustedLoading) {
        setAdjustedLoading(true);
      }
    }

    // When loading ends
    if (!isLoading && loadingStartTime.current) {
      const elapsed = Date.now() - loadingStartTime.current;
      const remaining = minimumMs - elapsed;

      if (remaining > 0) {
        // Keep showing loading for the remaining time
        clearMinTimeout();
        minimumTimeoutRef.current = setTimeout(() => {
          setAdjustedLoading(false);
          loadingStartTime.current = null;
        }, remaining);
      } else {
        // Already showed for minimum time, hide immediately
        setAdjustedLoading(false);
        loadingStartTime.current = null;
      }
    }

    // If loading hasn't started yet, just reflect the state
    if (!isLoading && !loadingStartTime.current && adjustedLoading) {
      setAdjustedLoading(false);
    }

    return clearMinTimeout;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, minimumMs]);

  return adjustedLoading;
}
