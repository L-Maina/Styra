'use client';

import { useCallback, useRef, type RefObject } from 'react';

interface UseRovingTabindexOptions {
  /** Orientation of the roving tabindex: horizontal or vertical */
  orientation?: 'horizontal' | 'vertical';
  /** Whether to wrap around at boundaries */
  wrap?: boolean;
}

/**
 * Hook for roving tabindex pattern — keyboard navigation within a list.
 * Arrow keys move between items, Home/End jump to first/last.
 */
export function useRovingTabindex(
  itemsRef: RefObject<(HTMLElement | null)[] | null>,
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  options: UseRovingTabindexOptions = {}
) {
  const { orientation = 'horizontal', wrap = true } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const items = itemsRef.current?.filter(Boolean) as HTMLElement[] | undefined;
      if (!items || items.length === 0) return;

      const isNext =
        orientation === 'horizontal'
          ? event.key === 'ArrowRight'
          : event.key === 'ArrowDown';
      const isPrev =
        orientation === 'horizontal'
          ? event.key === 'ArrowLeft'
          : event.key === 'ArrowUp';

      if (!isNext && !isPrev && event.key !== 'Home' && event.key !== 'End') return;

      event.preventDefault();

      let nextIndex: number;

      if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = items.length - 1;
      } else if (isNext) {
        nextIndex = activeIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = wrap ? 0 : items.length - 1;
        }
      } else {
        nextIndex = activeIndex - 1;
        if (nextIndex < 0) {
          nextIndex = wrap ? items.length - 1 : 0;
        }
      }

      setActiveIndex(nextIndex);

      // Focus the new active item
      requestAnimationFrame(() => {
        items[nextIndex]?.focus();
      });
    },
    [itemsRef, activeIndex, setActiveIndex, orientation, wrap]
  );

  const getContainerProps = useCallback(
    () => ({
      ref: containerRef,
      role: 'group' as const,
      'aria-orientation': orientation,
      onKeyDown: handleKeyDown,
    }),
    [orientation, handleKeyDown]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      role: 'groupitem' as const,
      'aria-selected': index === activeIndex,
      ref: (el: HTMLElement | null) => {
        if (itemsRef.current) {
          itemsRef.current[index] = el;
        }
      },
    }),
    [activeIndex, itemsRef]
  );

  return { containerRef, getContainerProps, getItemProps };
}
