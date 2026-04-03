'use client';

import { useSyncExternalStore } from 'react';
import { useI18nStore } from '@/store/i18n-store';
import type { Locale } from '@/i18n/config';

export function useTranslation() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useI18nStore((s) => s.t);
  const isLoading = useI18nStore((s) => s.isLoading);
  const isRTL = false; // All current locales are LTR

  // Detect hydration state to avoid SSR/client mismatch
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return {
    locale,
    setLocale,
    t,
    isRTL,
    direction: isRTL ? ('rtl' as const) : ('ltr' as const),
    isLoading,
    mounted,
  };
}
