'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { countryToCurrency, currencyMeta, timezoneToCountry } from '@/store';

interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  name: string;
}

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastUpdated: number;
}

const DEFAULT_CURRENCY: CurrencyConfig = {
  code: 'USD',
  symbol: '$',
  locale: 'en-US',
  name: 'US Dollar',
};

const STORAGE_KEY = 'styra-currency';
const EXCHANGE_RATES_KEY = 'styra-exchange-rates';
const EXCHANGE_RATES_TTL = 1000 * 60 * 60; // 1 hour

function detectCurrencyFromTimezone(): CurrencyConfig {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryCode = timezoneToCountry[tz];
    if (countryCode) {
      const currencyCode = countryToCurrency[countryCode];
      if (currencyCode && currencyMeta[currencyCode]) {
        const meta = currencyMeta[currencyCode];
        return { code: currencyCode, symbol: meta.symbol, locale: meta.locale, name: meta.name };
      }
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_CURRENCY;
}

function detectCurrencyFromCountry(countryCode: string | null): CurrencyConfig {
  if (!countryCode) return DEFAULT_CURRENCY;
  const currencyCode = countryToCurrency[countryCode];
  if (currencyCode && currencyMeta[currencyCode]) {
    const meta = currencyMeta[currencyCode];
    return { code: currencyCode, symbol: meta.symbol, locale: meta.locale, name: meta.name };
  }
  return DEFAULT_CURRENCY;
}

function loadSavedCurrency(): { config: CurrencyConfig; isManual: boolean } | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.code && currencyMeta[parsed.code]) {
        return { config: parsed, isManual: parsed.isManual || false };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveCurrency(config: CurrencyConfig, isManual: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, isManual }));
  } catch {
    // Ignore storage errors
  }
}

function loadExchangeRates(): ExchangeRates | null {
  try {
    const saved = localStorage.getItem(EXCHANGE_RATES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lastUpdated && Date.now() - parsed.lastUpdated < EXCHANGE_RATES_TTL) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Hook for location-based currency detection and formatting
 * Detects user timezone → maps to country → maps to currency
 * Also attempts IP geolocation for more accurate detection
 * Stores preference in localStorage
 */
export function useCurrency() {
  // Use lazy initializer to compute initial currency synchronously
  // This avoids calling setState in useEffect
  const [currency, setCurrencyState] = useState<CurrencyConfig>(() => {
    const saved = loadSavedCurrency();
    if (saved) return saved.config;
    return detectCurrencyFromTimezone();
  });

  const [isManual, setIsManual] = useState<boolean>(() => {
    const saved = loadSavedCurrency();
    if (saved) return saved.isManual;
    return false;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(() => loadExchangeRates());
  const ipFetchRef = useRef(false);

  // Save auto-detected preference on first mount if no saved pref
  useEffect(() => {
    const saved = loadSavedCurrency();
    if (!saved) {
      saveCurrency(currency, false);
    }
  }, []);

  // IP-based geolocation (non-blocking, updates currency if more accurate)
  useEffect(() => {
    if (ipFetchRef.current || isManual) return;
    ipFetchRef.current = true;

    const fetchIpLocation = async () => {
      try {
        // Try multiple free IP geolocation APIs in order
        const apis = [
          { url: 'https://ipapi.co/json/', extractCountry: (data: Record<string, unknown>) => data.country_code as string },
          { url: 'https://ip-api.com/json/?fields=countryCode', extractCountry: (data: Record<string, unknown>) => data.countryCode as string },
        ];

        for (const api of apis) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch(api.url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json();
              const countryCode = api.extractCountry(data);
              if (countryCode) {
                const detected = detectCurrencyFromCountry(countryCode);
                // Only update if different from current and timezone detection
                if (detected.code !== currency.code) {
                  setCurrencyState(detected);
                  setIsManual(false);
                  saveCurrency(detected, false);
                }
                break;
              }
            }
          } catch {
            // Try next API
          }
        }
      } catch {
        // Silently fail - timezone detection is already in place as fallback
      }
    };

    fetchIpLocation();
  }, []);

  // Fetch exchange rates periodically
  useEffect(() => {
    if (exchangeRates) return;

    const fetchRates = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
          'https://api.exchangerate-api.com/v4/latest/USD',
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const rates: ExchangeRates = {
            base: data.base,
            rates: data.rates,
            lastUpdated: Date.now(),
          };
          setExchangeRates(rates);
          try {
            localStorage.setItem(EXCHANGE_RATES_KEY, JSON.stringify(rates));
          } catch {
            // Ignore
          }
        }
      } catch {
        // Silently fail - formatting will work without rates
      }
    };

    fetchRates();
  }, [exchangeRates]);

  // Convert amount from one currency to another
  const convertCurrency = useCallback(
    (amount: number, fromCode: string, toCode: string): number => {
      if (fromCode === toCode) return amount;
      if (!exchangeRates) return amount;

      const fromRate = exchangeRates.rates[fromCode] || 1;
      const toRate = exchangeRates.rates[toCode] || 1;

      return (amount / fromRate) * toRate;
    },
    [exchangeRates]
  );

  // Get exchange rate for a currency pair
  const getExchangeRate = useCallback(
    (fromCode: string, toCode: string): number | null => {
      if (!exchangeRates) return null;
      if (fromCode === toCode) return 1;
      const fromRate = exchangeRates.rates[fromCode];
      const toRate = exchangeRates.rates[toCode];
      if (!fromRate || !toRate) return null;
      return toRate / fromRate;
    },
    [exchangeRates]
  );

  // Format a number as currency
  const formatCurrency = useCallback(
    (amount: number, options?: { code?: string; compact?: boolean }): string => {
      const targetCode = options?.code || currency.code;
      const meta = currencyMeta[targetCode] || currencyMeta[currency.code];

      if (options?.compact) {
        if (amount >= 1_000_000) {
          return `${meta.symbol}${(amount / 1_000_000).toFixed(1)}M`;
        }
        if (amount >= 1_000) {
          return `${meta.symbol}${(amount / 1_000).toFixed(1)}K`;
        }
        return `${meta.symbol}${amount.toFixed(0)}`;
      }

      try {
        return new Intl.NumberFormat(meta.locale, {
          style: 'currency',
          currency: targetCode,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${meta.symbol}${amount.toFixed(2)}`;
      }
    },
    [currency.code]
  );

  // Format with converted currency
  const formatConverted = useCallback(
    (amountKes: number, options?: { compact?: boolean }): string => {
      if (currency.code === 'KES') {
        return formatCurrency(amountKes, { code: 'KES', compact: options?.compact });
      }

      const converted = convertCurrency(amountKes, 'KES', currency.code);
      return formatCurrency(converted, { code: currency.code, compact: options?.compact });
    },
    [currency.code, formatCurrency, convertCurrency]
  );

  // Set currency manually
  const setManualCurrency = useCallback((code: string) => {
    const meta = currencyMeta[code];
    if (!meta) return;

    const newCurrency: CurrencyConfig = { code, symbol: meta.symbol, locale: meta.locale, name: meta.name };
    setCurrencyState(newCurrency);
    setIsManual(true);
    saveCurrency(newCurrency, true);
  }, []);

  // Reset to auto-detected currency
  const resetCurrency = useCallback(() => {
    const detected = detectCurrencyFromTimezone();
    setCurrencyState(detected);
    setIsManual(false);
    saveCurrency(detected, false);
  }, []);

  // Detect from country code (e.g., from geolocation API)
  const detectFromCountry = useCallback((countryCode: string | null) => {
    const detected = detectCurrencyFromCountry(countryCode);
    setCurrencyState(detected);
    setIsManual(false);
    saveCurrency(detected, false);
  }, []);

  // Force refresh exchange rates
  const refreshRates = useCallback(async () => {
    try {
      localStorage.removeItem(EXCHANGE_RATES_KEY);
      setExchangeRates(null);
    } catch {
      // Ignore
    }
  }, []);

  return {
    currency,
    isLoading,
    isManual,
    exchangeRates,
    formatCurrency,
    formatConverted,
    convertCurrency,
    getExchangeRate,
    setManualCurrency,
    resetCurrency,
    detectFromCountry,
    refreshRates,
  };
}

// Export individual functions for non-hook usage
export { detectCurrencyFromTimezone, detectCurrencyFromCountry, DEFAULT_CURRENCY };
export type { CurrencyConfig };
