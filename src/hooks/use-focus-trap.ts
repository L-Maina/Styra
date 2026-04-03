'use client';

import { useRef, useEffect, useCallback, type RefObject } from 'react';

interface UseFocusTrapOptions {
  /** Element or selector to initially focus */
  initialFocus?: HTMLElement | string | null;
  /** Whether to restore focus to previously focused element on deactivate */
  restoreFocus?: boolean;
  /** Whether clicking outside the container deactivates the trap */
  clickOutsideDeactivates?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return elements.filter((el) => {
    if (el.offsetParent === null && el.style.position !== 'fixed') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

/**
 * Hook to trap keyboard focus within a container element.
 * Traps Tab/Shift+Tab cycling and optionally handles Escape key.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
) {
  const { restoreFocus = true, clickOutsideDeactivates = false } = options;
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isActiveRef = useRef(false);
  const optionsRef = useRef(options);
  const deactivateRef = useRef<() => void>(() => {});
  const handlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // Keep optionsRef in sync via effect
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Create the shared keyboard handler
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!isActiveRef.current || !containerRef.current) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        deactivateRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !containerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !containerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [containerRef]
  );

  const deactivate = useCallback(() => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;

    if (handlerRef.current) {
      document.removeEventListener('keydown', handlerRef.current, true);
      handlerRef.current = null;
    }

    if (restoreFocus && previouslyFocusedRef.current) {
      requestAnimationFrame(() => {
        previouslyFocusedRef.current?.focus();
      });
    }
  }, [restoreFocus]);

  // Keep deactivateRef in sync via effect
  useEffect(() => {
    deactivateRef.current = deactivate;
  }, [deactivate]);

  const activate = useCallback(() => {
    if (isActiveRef.current) return;

    // Store the previously focused element
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    isActiveRef.current = true;

    handlerRef.current = handler;
    document.addEventListener('keydown', handler, true);

    // Focus the initial element or first focusable
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const currentInitialFocus = optionsRef.current.initialFocus;

      if (currentInitialFocus) {
        if (typeof currentInitialFocus === 'string') {
          const el = containerRef.current.querySelector<HTMLElement>(currentInitialFocus);
          el?.focus();
        } else {
          currentInitialFocus.focus();
        }
      } else {
        const focusable = getFocusableElements(containerRef.current);
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    });
  }, [containerRef, handler]);

  // Handle click outside
  useEffect(() => {
    if (!clickOutsideDeactivates || !containerRef.current) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        isActiveRef.current &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        deactivateRef.current();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clickOutsideDeactivates, containerRef]);

  return { activate, deactivate };
}
