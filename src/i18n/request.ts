import { getRequestConfig } from 'next-intl/server';
import type { Locale } from './config';
import { DEFAULT_LOCALE } from './config';

// Message loader for next-intl
// This app is single-page (not file-based routing), so next-intl is used mainly for message loading
async function getMessages(locale: Locale) {
  try {
    const messages = await import(`./messages/${locale}.json`);
    return messages.default;
  } catch {
    // Fallback to English if locale file is missing
    const fallback = await import('./messages/en.json');
    return fallback.default;
  }
}

export default getRequestConfig(async () => {
  const locale: Locale = DEFAULT_LOCALE;

  return {
    locale,
    messages: await getMessages(locale),
    timeZone: 'Africa/Nairobi',
  };
});
