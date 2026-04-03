// Complete worldwide currencies and country codes
// Auto-detect user location and set appropriate currency
// Re-exports from countries.ts for backward compatibility

export {
  COUNTRIES,
  COUNTRY_BY_CODE,
  COUNTRY_BY_DIAL_CODE,
  UNIQUE_CURRENCIES,
  CURRENCY_INFO,
  DIAL_CODES,
  TIMEZONE_TO_COUNTRY,
  detectCountryFromTimezone,
  detectCountryFromGeolocation,
  detectUserCountry,
  formatPrice,
  searchCountries,
  type Country,
} from './countries';

// Legacy interface for backward compatibility
export interface CountryInfo {
  code: string;
  name: string;
  dialCode: string;
  currency: string;
  currencySymbol: string;
  currencyName: string;
  flag: string;
  locale: string;
}

// Legacy countries array - now imported from countries.ts
import { 
  COUNTRIES as ALL_COUNTRIES, 
  CURRENCY_INFO,
  type Country 
} from './countries';

// Convert to legacy format for backward compatibility
export const LEGACY_COUNTRIES: CountryInfo[] = ALL_COUNTRIES.map((c: Country) => ({
  code: c.code,
  name: c.name,
  dialCode: c.dialCode,
  currency: c.currency.code,
  currencySymbol: c.currency.symbol,
  currencyName: c.currency.name,
  flag: c.flag,
  locale: c.locale,
}));

// Re-export currencies for backward compatibility
export const CURRENCIES: Record<string, { symbol: string; name: string; locale: string }> = 
  Object.fromEntries(
    Object.entries(CURRENCY_INFO).map(([code, info]) => [
      code,
      { symbol: info.symbol, name: info.name, locale: 'en-US' }
    ])
  );

// Format price with the correct currency
export function formatPriceWithCurrency(
  price: number,
  currencyCode: string,
  locale?: string
): string {
  const currencyInfo = CURRENCY_INFO[currencyCode] || CURRENCY_INFO['USD'];
  const useLocale = locale || 'en-US';
  
  try {
    return new Intl.NumberFormat(useLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KES' ? 0 : 2,
    }).format(price);
  } catch {
    return `${currencyInfo.symbol}${price.toLocaleString()}`;
  }
}

// Format phone number with country code
export function formatPhoneNumber(phone: string, countryCode: string): string {
  const country = ALL_COUNTRIES.find(c => c.code === countryCode);
  if (!country) return phone;
  
  // Remove any existing country code prefix
  const cleanPhone = phone.replace(/^\+?\d{1,4}[\s-]?/, '').replace(/[\s-]/g, '');
  
  return `${country.dialCode} ${cleanPhone}`;
}
