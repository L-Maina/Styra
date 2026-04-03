import { create } from 'zustand';
import type { Locale } from '@/i18n/config';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import en from '@/i18n/messages/en.json';
import sw from '@/i18n/messages/sw.json';
import fr from '@/i18n/messages/fr.json';

type Messages = Record<string, string>;

const messageMap: Record<Locale, Messages> = { en, sw, fr };

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem('styra-i18n');
  if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
    return stored as Locale;
  }
  return DEFAULT_LOCALE;
}

function getInitialMessages(): Messages {
  const locale = getInitialLocale();
  return messageMap[locale] || messageMap[DEFAULT_LOCALE];
}

interface I18nState {
  locale: Locale;
  messages: Messages;
  isLoading: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: getInitialLocale(),
  messages: getInitialMessages(),
  isLoading: false,
  setLocale: async (locale: Locale) => {
    set({ isLoading: true });
    try {
      const messages = messageMap[locale] || messageMap[DEFAULT_LOCALE];
      set({ locale, messages, isLoading: false });
      if (typeof window !== 'undefined') {
        localStorage.setItem('styra-i18n', locale);
      }
    } catch {
      set({ isLoading: false });
    }
  },
  t: (key: string, params?: Record<string, string | number>): string => {
    const { messages } = get();
    let text = messages[key] || messageMap.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  },
}));
