import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { distance, duration, ease, press, stagger, staggerDelay } from '@/lib/motion';

// The motion tokens exist twice: as numbers in src/lib/motion.ts (framer-motion) and as CSS
// variables in globals.css. They are also the spec for the Flutter app and the Figma file.
// These tests keep the two copies in step.
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

function cssVar(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--${name} is not defined in globals.css`);
  return match[1].trim();
}

const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
const bezier = (b: number[]) => `cubic-bezier(${b.join(', ')})`;

describe('motion tokens', () => {
  test('durations match the CSS variables', () => {
    expect(cssVar('duration-fast')).toBe(ms(duration.fast));
    expect(cssVar('duration-base')).toBe(ms(duration.base));
    expect(cssVar('duration-slow')).toBe(ms(duration.slow));
    expect(cssVar('duration-launch')).toBe(ms(duration.launch));
  });

  test('the launch never exceeds 1.2 s', () => {
    expect(duration.launch).toBeLessThanOrEqual(1.2);
  });

  test('easings match the CSS variables', () => {
    expect(cssVar('ease-standard')).toBe(bezier(ease.standard));
    expect(cssVar('ease-spring')).toBe(bezier(ease.spring));
    expect(cssVar('ease-exit')).toBe(bezier(ease.exit));
  });

  test('distances, press scale and stagger match the CSS variables', () => {
    expect(cssVar('distance-rise')).toBe(`${distance.rise}px`);
    expect(cssVar('distance-slide')).toBe(`${distance.slide}px`);
    expect(cssVar('press-scale')).toBe(String(press.scale));
    expect(cssVar('stagger-step')).toBe(ms(stagger.step));
  });
});

describe('staggerDelay', () => {
  test('is 60 ms apart', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(0.06);
    expect(staggerDelay(5)).toBe(0.3);
  });

  test('stops staggering after the sixth item', () => {
    expect(staggerDelay(6)).toBe(staggerDelay(5));
    expect(staggerDelay(40)).toBe(staggerDelay(5));
  });

  test('never goes negative', () => {
    expect(staggerDelay(-3)).toBe(0);
  });
});

describe('reduced motion in globals.css', () => {
  test('follows the system setting and the toolbar override', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(":root[data-motion='reduce']");
    expect(css).toContain(":root:not([data-motion='full'])");
  });
});

describe('skeleton', () => {
  test('has a base and a sweep colour in both themes', () => {
    expect((css.match(/--skeleton-base:/g) ?? []).length).toBe(2);
    expect((css.match(/--skeleton-sweep:/g) ?? []).length).toBe(2);
  });

  test('the sweep takes 1.4 s', () => {
    expect(cssVar('shimmer-duration')).toBe('1400ms');
  });
});

describe('press feedback', () => {
  test('uses the press scale token and is off under reduced motion', () => {
    expect(css).toContain('transform: scale(var(--press-scale))');
    expect((css.match(/\.press:active \{\s*transform: none !important;/g) ?? []).length).toBe(2);
  });
});
