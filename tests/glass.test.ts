import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim();
  return out;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
function rgba(v: string): [RGB, number] {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(v);
  if (!m) throw new Error(`not rgba: ${v}`);
  return [[+m[1], +m[2], +m[3]], +m[4]];
}
const over = ([c, a]: [RGB, number], bg: RGB): RGB => c.map((x, i) => x * a + bg[i] * (1 - a)) as RGB;
function lum([r, g, b]: RGB) {
  const ch = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Worst-case backdrops (design-language.md section 5): black, white, mid grey, violet, blue. Blur ignored.
const BACKDROPS: RGB[] = [hex('#000000'), hex('#FFFFFF'), hex('#808080'), hex('#6C4EFF'), hex('#2F7BFF')];

describe('glass contrast (design-language.md section 5)', () => {
  for (const [name, selector] of [['graphite', ':root'], ['ivory', '.light']] as const) {
    const tk = tokens(selector);
    test(`${name}: --foreground on regular glass is at least 4.5:1 over every backdrop`, () => {
      const fill = rgba(tk['glass-regular-fill']);
      for (const bg of BACKDROPS) expect(contrast(hex(tk.foreground), over(fill, bg))).toBeGreaterThanOrEqual(4.5);
    });
    test(`${name}: --foreground on the opaque fallback is at least 7:1`, () => {
      expect(contrast(hex(tk.foreground), hex(tk['glass-opaque-fill']))).toBeGreaterThanOrEqual(7);
    });
    test(`${name}: the opaque fallback border is stronger than the regular hairline`, () => {
      const page = hex(tk.background);
      const fallback = contrast(over(rgba(tk['glass-opaque-border']), hex(tk['glass-opaque-fill'])), page);
      const regular = contrast(over(rgba(tk['glass-hairline']), over(rgba(tk['glass-regular-fill']), page)), page);
      expect(fallback).toBeGreaterThan(regular);
    });
  }
  test('clear glass: a white icon over the scrim is at least 3:1 even on pure white', () => {
    const tk = tokens(':root');
    const scrim: [RGB, number] = [[0, 0, 0], Number(tk['glass-scrim'])];
    const clear = rgba(tk['glass-clear-fill']);
    const backdrop = over(clear, over(scrim, hex('#FFFFFF')));
    expect(contrast(hex('#FFFFFF'), backdrop)).toBeGreaterThanOrEqual(3);
  });
  test('the fallback media rules exist', () => {
    for (const rule of ['prefers-reduced-transparency: reduce', 'prefers-contrast: more', 'forced-colors: active', '@supports not']) expect(css).toContain(rule);
  });
});
