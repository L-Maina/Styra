import { describe, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { LOGO_ASPECT, LOGO_FILES, logoSrc, type LogoTheme, type LogoVariant } from '@/lib/brand';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const css = read('src/app/globals.css');

// The declarations of one rule: ':root' is the graphite theme, '.light' the ivory one.
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) out[match[1]] = match[2].trim();
  return out;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Values from the identity kit: brand/tokens/tokens.css at 1a9353f on brand/identity-kit.
const kit: Record<'dark' | 'light', Record<string, string>> = {
  dark: {
    background: '#121318', foreground: '#F2F3F5', surface: '#171C26', 'muted-foreground': '#9DA2AA',
    primary: '#8780FD', 'primary-foreground': '#0B0F18', ring: '#8780FD', link: '#8780FD',
    destructive: '#FE8477', success: '#3FC6A0', warning: '#E59B37', info: '#66B2FD',
  },
  light: {
    background: '#F5F0E8', foreground: '#171C26', surface: '#FFFFFF', 'muted-foreground': '#505561',
    primary: '#6C4EFF', 'primary-foreground': '#FFFFFF', ring: '#6C4EFF', link: '#5C1DF5',
    destructive: '#B4312B', success: '#08795E', warning: '#8F5A06', info: '#196AAF',
  },
};

describe('theme tokens follow the identity kit', () => {
  for (const [theme, selector] of [['dark', ':root'], ['light', '.light']] as const) {
    test(`${theme} values equal the kit`, () => {
      const actual = tokens(selector);
      for (const [name, value] of Object.entries(kit[theme])) {
        expect(`${name}=${actual[name]?.toUpperCase()}`).toBe(`${name}=${value.toUpperCase()}`);
      }
    });
  }

  test('the gradient runs from the theme violet to electric blue', () => {
    expect(tokens(':root')['secondary'].toUpperCase()).toBe('#2F7BFF');
    expect(tokens(':root')['styra-gradient']).toContain('#8780FD 0%, #2F7BFF 100%');
    expect(tokens('.light')['styra-gradient']).toContain('#6C4EFF 0%, #2F7BFF 100%');
  });
});

describe('theme contrast (WCAG)', () => {
  for (const [theme, selector] of [['dark', ':root'], ['light', '.light']] as const) {
    const own = () => ({ ...tokens(':root'), ...tokens(selector) });

    test(`${theme}: text and status colours reach 4.5:1 on the page`, () => {
      const t = own();
      const names = ['foreground', 'muted-foreground', 'link', 'destructive', 'success', 'warning', 'info'];
      expect(names.filter((name) => contrast(t[name], t.background) < 4.5)).toEqual([]);
    });

    test(`${theme}: text on primary, secondary and destructive fills reaches 4.5:1`, () => {
      const t = own();
      expect(contrast(t['primary-foreground'], t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['secondary-foreground'], t.secondary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['destructive-foreground'], t.destructive)).toBeGreaterThanOrEqual(4.5);
    });

    test(`${theme}: the focus ring reaches 3:1 on the page`, () => {
      const t = own();
      expect(contrast(t.ring, t.background)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('logos', () => {
  const variants = Object.keys(LOGO_FILES) as LogoVariant[];
  const themes: LogoTheme[] = ['light', 'dark'];

  test('every variant has a file for both grounds, and the aspect ratio matches its viewBox', () => {
    for (const variant of variants) {
      for (const theme of themes) {
        const path = `public${logoSrc(variant, theme)}`;
        expect(existsSync(new URL(path, root))).toBe(true);
        const box = read(path).match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) ?? [];
        expect(box.length).toBe(4);
        expect(Math.abs(box[2] / box[3] - LOGO_ASPECT[variant])).toBeLessThan(0.001);
      }
    }
  });
});

describe('metadata', () => {
  test('the manifest uses the graphite ground and every icon exists', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.background_color).toBe('#121318');
    expect(manifest.theme_color).toBe('#121318');
    for (const icon of manifest.icons) expect(existsSync(new URL(`public${icon.src}`, root))).toBe(true);
  });

  test('layout loads Syne and Manrope, not the old fonts', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain('Syne');
    expect(layout).toContain('Manrope');
    expect(layout).not.toMatch(/Poppins|Inter\b/);
  });
});

describe('text on brand fills', () => {
  // Dark --primary is a light violet, so white text on it fails contrast. Use text-primary-foreground.
  const solidFill =
    /gradient-bg|(?<![\w:-])bg-(primary|secondary)(?![\w/-])|(?<![\w:-])(from|to|via)-(primary|secondary)(?![\w-]*\/\d)(?![\w-])/;
  const whiteText = /(?<![\w:/-])text-white(?![\w-])/;

  test('no line puts text-white on the brand gradient or a solid primary/secondary fill', () => {
    const src = fileURLToPath(new URL('src/', root));
    const offenders: string[] = [];
    for (const file of readdirSync(src, { recursive: true }) as string[]) {
      if (!file.endsWith('.tsx')) continue;
      readFileSync(`${src}${file}`, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (whiteText.test(line) && solidFill.test(line)) offenders.push(`${file}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

describe('fonts', () => {
  // `@theme inline` does not emit --font-sans or --font-heading as CSS variables, so a rule that uses
  // them is dropped and the heading falls back to the inherited font. Use the next/font variables.
  test('font-family declarations only use variables that next/font defines', () => {
    const defined = new Set(['font-syne', 'font-manrope']);
    const unknown: string[] = [];
    for (const declaration of css.matchAll(/font-family:\s*([^;]+);/g)) {
      for (const use of declaration[1].matchAll(/var\(--([\w-]+)\)/g)) {
        if (!defined.has(use[1])) unknown.push(use[1]);
      }
    }
    expect(unknown).toEqual([]);
  });
});
