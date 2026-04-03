/**
 * Accessibility utility functions for the Styra platform.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

/**
 * Map keyboard events to action callbacks.
 */
export function handleKeyboardEvent(
  event: KeyboardEvent,
  actions: Record<string, () => void>
) {
  const key = event.key;
  if (key in actions) {
    event.preventDefault();
    actions[key]();
  }
}

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return elements.filter((el) => {
    // Exclude hidden elements
    if (el.offsetParent === null && el.style.position !== 'fixed') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

/**
 * Programmatically trap focus within a container element.
 * Returns a cleanup function to remove the trap.
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) return () => {};

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handler(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handler);

  // Focus the first focusable element
  first.focus();

  return () => {
    container.removeEventListener('keydown', handler);
  };
}

/**
 * Announce a message to screen readers via a dynamically created live region.
 */
export function announceToScreenReader(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;

  const id = `sr-announce-${Date.now()}`;
  const region = document.createElement('div');
  region.id = id;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', politeness);
  region.setAttribute('aria-atomic', 'true');

  // Position off-screen but keep accessible
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

  // Delay slightly for screen reader detection
  requestAnimationFrame(() => {
    region.textContent = message;

    setTimeout(() => {
      document.body.removeChild(region);
    }, 5000);
  });
}

/**
 * Check if the user has reduced motion enabled at the OS level.
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get the CSS class to apply for reduced motion.
 */
export function getReducedMotionClass(): string {
  if (typeof window === 'undefined') return '';
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isReduced ? 'reduce-motion' : '';
}
