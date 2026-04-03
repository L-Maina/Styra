export type Locale = 'en' | 'sw' | 'fr';

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '\u{1F1F0}\u{1F1EA}' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}' },
];

export const DEFAULT_LOCALE: Locale = 'en';

export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  // All current locales are LTR
  return 'ltr';
}

export function isRTL(locale: Locale): boolean {
  return getLocaleDirection(locale) === 'rtl';
}

export function getLocaleConfig(code: Locale): LocaleConfig | undefined {
  return SUPPORTED_LOCALES.find((l) => l.code === code);
}
