import en from '../../copy/en.json';
import type { BookingStatus } from './statuses';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every key in copy/en.json, typed, so a typo is a compile error. */
export type CopyKey = Leaves<typeof en>;
export type CopyVars = Record<string, string | number>;

const catalogues: Record<string, unknown> = { en };

function lookup(locale: string, key: string): string | undefined {
  let node: unknown = catalogues[locale] ?? catalogues.en;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : undefined;
}

/** Minimal ICU: {name} placeholders and {count, plural, one {...} other {...}} with # for the number. */
function format(template: string, vars: CopyVars = {}): string {
  const plural = /\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g;
  const withPlural = template.replace(plural, (_m, name: string, one: string, other: string) => {
    const n = Number(vars[name]);
    return (n === 1 ? one : other).replace(/#/g, String(vars[name]));
  });
  return withPlural.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** The one way to get user-facing text. Throws on a missing key so tests catch it. */
export function t(key: CopyKey, vars?: CopyVars, locale = 'en'): string {
  const template = lookup(locale, key) ?? lookup('en', key);
  if (template === undefined) throw new Error(`missing copy key: ${key}`);
  return format(template, vars);
}

/** Label for an API error code, falling back to the server error line. */
export function errorText(code: string, vars?: CopyVars): string {
  const known = lookup('en', `errors.${code}`);
  return known ? format(known, vars) : t('errors.SERVER_ERROR', { ref: vars?.ref ?? '—' });
}

export function bookingStatusLabel(status: BookingStatus, viewer: 'CUSTOMER' | 'PROVIDER', vars?: CopyVars): string {
  if (viewer === 'CUSTOMER' && status === 'PENDING' && vars?.time) return t('status.customer.PENDING_HELD', vars);
  return t(`status.${viewer === 'CUSTOMER' ? 'customer' : 'provider'}.${status}` as CopyKey);
}
