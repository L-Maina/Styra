import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { LAUNCH_MS, LAUNCH_SEEN_KEY, launchGuardScript } from '@/lib/launch';
import { duration } from '@/lib/motion';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

// Runs the guard script the way the browser would, with a fake storage and document.
function runGuard(stored: string | null, storageThrows = false): Record<string, string> {
  const attributes: Record<string, string> = {};
  const fakeDocument = {
    documentElement: { setAttribute: (name: string, value: string) => { attributes[name] = value; } },
  };
  const fakeStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('storage is blocked');
      return key === LAUNCH_SEEN_KEY ? stored : null;
    },
  };
  new Function('sessionStorage', 'document', launchGuardScript)(fakeStorage, fakeDocument);
  return attributes;
}

describe('launch guard script', () => {
  test('hides the splash when this session has already seen it', () => {
    expect(runGuard('1')).toEqual({ 'data-launched': '' });
  });

  test('leaves the splash alone on the first load', () => {
    expect(runGuard(null)).toEqual({});
  });

  test('does not throw when storage is blocked', () => {
    expect(runGuard(null, true)).toEqual({});
  });
});

describe('launch splash', () => {
  test('lasts exactly the launch duration token', () => {
    expect(LAUNCH_MS).toBe(Math.round(duration.launch * 1000));
  });

  test('has its styles and the already-seen escape hatch in globals.css', () => {
    expect(css).toContain('.launch-splash {');
    expect(css).toContain('html[data-launched] .launch-splash');
    expect(css).toContain('animation: launch-out var(--duration-launch)');
  });
});
