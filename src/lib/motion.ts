// Motion tokens, shared with the Figma file, the Flutter app and globals.css.
// The values are the spec in claude/figma-design-status.md (Project "Styra App").
// If you change one here, change it in src/app/globals.css too (tests/motion.test.ts
// checks that they agree) and in apps/mobile/lib/core/motion.dart.
import type { Transition, Variants } from 'framer-motion';

type Bezier = [number, number, number, number];

/** Seconds. The CSS variables in globals.css use milliseconds. */
export const duration = {
  /** Press, toggles, fades. */
  fast: 0.15,
  /** Elements, toasts, list rows. */
  base: 0.25,
  /** Screens, sheets, success. */
  slow: 0.4,
  /** Launch. The maximum, and always skippable. */
  launch: 1.2,
} as const;

export const ease: { standard: Bezier; spring: Bezier; exit: Bezier } = {
  /** Most movement. */
  standard: [0.2, 0, 0, 1],
  /** Arrivals with a small overshoot. */
  spring: [0.34, 1.56, 0.64, 1],
  /** Things leaving the screen. */
  exit: [0.4, 0, 1, 1],
};

/** Pixels. */
export const distance = {
  /** Text and rows entering. */
  rise: 12,
  /** Screens and toasts. */
  slide: 16,
} as const;

/** Pressed controls. */
export const press = { scale: 0.97 } as const;

/** Lists: 60 ms apart, and only the first six items are staggered. */
export const stagger = { step: 0.06, max: 6 } as const;

export const transition = {
  fast: { duration: duration.fast, ease: ease.standard },
  base: { duration: duration.base, ease: ease.standard },
  slow: { duration: duration.slow, ease: ease.standard },
  spring: { duration: duration.slow, ease: ease.spring },
  exit: { duration: duration.fast, ease: ease.exit },
} satisfies Record<string, Transition>;

/** Fade only. This is what every other pattern turns into under reduced motion. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.fast },
  exit: { opacity: 0, transition: transition.exit },
};

/** Text and rows entering: rise 12 px while fading in. */
export const rise: Variants = {
  hidden: { opacity: 0, y: distance.rise },
  show: { opacity: 1, y: 0, transition: transition.base },
  exit: { opacity: 0, transition: transition.exit },
};

/** Screens and toasts: slide 16 px while fading in, leave upward. */
export const slide: Variants = {
  hidden: { opacity: 0, y: distance.slide },
  show: { opacity: 1, y: 0, transition: transition.slow },
  exit: { opacity: 0, y: -distance.slide, transition: transition.exit },
};

/** Delay in seconds for item `index` of a list. Items after the sixth arrive together. */
export function staggerDelay(index: number): number {
  const i = Math.max(0, Math.min(index, stagger.max - 1));
  return Math.round(i * stagger.step * 1000) / 1000;
}
