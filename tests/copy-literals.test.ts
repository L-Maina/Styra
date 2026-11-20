import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every user-facing string in v2 components comes from copy/en.json (design-language.md section 11). */
const ROOTS = ['src/app/(v2)', 'src/components/v2'];
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });

// JSX text with letters, and literal accessible names or placeholders.
const JSX_TEXT = /(?<![=\-])>\s*([A-Za-z][^<>{}();=]*?)\s*</g;
const ATTR = /\b(aria-label|placeholder|title|alt)="([^"]*[A-Za-z][^"]*)"/g;

describe('no literal UI strings in v2 components', () => {
  for (const file of ROOTS.flatMap(files)) {
    test(file, () => {
      const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|^\s*\/\/.*$/gm, '');
      const hits = [...src.matchAll(JSX_TEXT)].map((m) => m[1]).filter((s) => !/^(div|span|li|ul|p|a|button)$/.test(s) && !/=>|&&|\)\s*$/.test(s));
      const attrs = [...src.matchAll(ATTR)].map((m) => `${m[1]}="${m[2]}"`);
      expect([...hits, ...attrs]).toEqual([]);
    });
  }
});
