'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

interface ReducedMotionContextValue {
  /** Whether reduced motion is currently active */
  prefersReducedMotion: boolean;
  /** Set reduced motion preference (overrides OS setting) */
  setReducedMotion: (value: boolean) => void;
}

const ReducedMotionContext = createContext<ReducedMotionContextValue>({
  prefersReducedMotion: false,
  setReducedMotion: () => {},
});

const STORAGE_KEY = 'styra-a11y';

function loadStoredPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.reducedMotion === 'boolean') {
        return parsed.reducedMotion;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

function storePreference(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const parsed = existing ? JSON.parse(existing) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, reducedMotion: value }));
  } catch {
    // Ignore localStorage errors
  }
}

function subscribeToMotionPreference(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getMotionPreferenceSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getMotionPreferenceServerSnapshot() {
  return false;
}

interface ReducedMotionProviderProps {
  children: ReactNode;
}

export function ReducedMotionProvider({ children }: ReducedMotionProviderProps) {
  // Use lazy initializer for initial stored preference
  const [manualOverride, setManualOverride] = useState<boolean | null>(() => loadStoredPreference());

  // Subscribe to OS media query using useSyncExternalStore
  const osPreference = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreferenceSnapshot,
    getMotionPreferenceServerSnapshot
  );

  const prefersReducedMotion = useMemo(
    () => manualOverride ?? osPreference,
    [manualOverride, osPreference]
  );

  const setReducedMotion = useCallback((value: boolean) => {
    setManualOverride(value);
    storePreference(value);
  }, []);

  return (
    <ReducedMotionContext.Provider value={{ prefersReducedMotion, setReducedMotion }}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

export function useReducedMotion(): ReducedMotionContextValue {
  const context = useContext(ReducedMotionContext);
  if (!context) {
    throw new Error('useReducedMotion must be used within a ReducedMotionProvider');
  }
  return context;
}
