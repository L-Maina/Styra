'use client';

import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Phone, Search, MapPin, Check } from 'lucide-react';
import { 
  COUNTRIES, 
  COUNTRY_BY_CODE, 
  detectUserCountry, 
  type Country 
} from '@/lib/countries';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  defaultCountryCode?: string; // ISO code like 'KE', 'US', etc.
  onCountryChange?: (country: Country) => void;
}

// Detect country from phone number (handles E.164 format with + prefix)
const detectCountryFromPhone = (phone: string): { code: string; localDigits: string } => {
  if (!phone) return { code: '', localDigits: '' };
  
  // Remove any non-digit characters
  const phoneDigits = phone.replace(/[^\d]/g, '');
  if (!phoneDigits) return { code: '', localDigits: '' };
  
  // Check for country codes (order by length, longest first)
  const sortedCountries = [...COUNTRIES].sort((a, b) => 
    b.dialCode.replace(/[^0-9]/g, '').length - a.dialCode.replace(/[^0-9]/g, '').length
  );
  
  for (const country of sortedCountries) {
    const dialDigits = country.dialCode.replace(/[^0-9]/g, '');
    
    if (phoneDigits.startsWith(dialDigits)) {
      return {
        code: country.code,
        localDigits: phoneDigits.slice(dialDigits.length)
      };
    }
  }
  
  return { code: '', localDigits: phoneDigits };
};

// Format phone number with spacing based on country
const formatPhoneNumber = (digits: string, country: Country | null): string => {
  if (!country || !digits) return digits;
  
  // Common formatting patterns
  const patterns: Record<string, string> = {
    'KE': 'XXX XXX XXX',      // Kenya: 9 digits
    'US': 'XXX XXX XXXX',     // US: 10 digits
    'GB': 'XXXX XXX XXXX',    // UK: 11 digits
    'NG': 'XXX XXX XXXX',     // Nigeria: 10 digits
    'GH': 'XX XXX XXXX',      // Ghana: 9 digits
    'ZA': 'XX XXX XXXX',      // South Africa: 9 digits
    'IN': 'XXXXX XXXXX',      // India: 10 digits
    'AU': 'XXX XXX XXX',      // Australia: 9 digits
    'CA': 'XXX XXX XXXX',     // Canada: 10 digits
    'DE': 'XXX XXXXXXXX',     // Germany: 10-11 digits
    'FR': 'X XX XX XX XX',    // France: 9 digits
    'JP': 'XX XXXX XXXX',     // Japan: 10 digits
    'CN': 'XXX XXXX XXXX',    // China: 11 digits
    'BR': 'XX XXXXX XXXX',    // Brazil: 10-11 digits
    'MX': 'XX XXXX XXXX',     // Mexico: 10 digits
  };
  
  const format = patterns[country.code] || 'XXX XXX XXXX';
  let result = '';
  let cleanIndex = 0;
  
  for (let i = 0; i < format.length && cleanIndex < digits.length; i++) {
    if (format[i] === 'X') {
      result += digits[cleanIndex];
      cleanIndex++;
    } else {
      result += format[i];
    }
  }
  
  return result;
};

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter phone number',
  className,
  disabled = false,
  defaultCountryCode,
  onCountryChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [manualCountry, setManualCountry] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<Country | null>(null);
  
  // Auto-detect country on mount
  useEffect(() => {
    const detectCountry = async () => {
      // If defaultCountryCode is provided, use it
      if (defaultCountryCode && COUNTRY_BY_CODE[defaultCountryCode]) {
        const country = COUNTRY_BY_CODE[defaultCountryCode];
        setDetectedCountry(country);
        onCountryChange?.(country);
        return;
      }
      
      setIsDetecting(true);
      try {
        const country = await detectUserCountry();
        setDetectedCountry(country);
        onCountryChange?.(country);
      } catch {
        // Default to Kenya
        const kenya = COUNTRY_BY_CODE['KE'];
        setDetectedCountry(kenya);
        onCountryChange?.(kenya);
      } finally {
        setIsDetecting(false);
      }
    };
    
    detectCountry();
  }, [defaultCountryCode, onCountryChange]);
  
  // Derive country and local digits from value
  const { detectedCode, localDigits } = useMemo(() => {
    const detected = detectCountryFromPhone(value);
    return {
      detectedCode: detected.code,
      localDigits: detected.localDigits
    };
  }, [value]);
  
  // Use manual country if set, otherwise detected from phone, then auto-detected country
  const activeCountryCode = manualCountry || detectedCode || detectedCountry?.code;
  const activeCountry = activeCountryCode ? COUNTRY_BY_CODE[activeCountryCode] : detectedCountry;
  
  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    
    const query = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.dialCode.includes(query) ||
      country.currency.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Focus search input when dropdown opens
  useEffect(() => {
    if (showDropdown && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showDropdown]);
  
  // Handle country selection
  const handleSelectCountry = useCallback((country: Country) => {
    setManualCountry(country.code);
    setShowDropdown(false);
    setSearchQuery('');
    
    // Update the value with new country code (E.164 format with +)
    if (localDigits) {
      const dialDigits = country.dialCode.replace(/[^0-9]/g, '');
      onChange(`+${dialDigits}${localDigits}`);
    }
    
    onCountryChange?.(country);
    
    // Focus the input
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [localDigits, onChange, onCountryChange]);
  
  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Remove all non-digit characters
    let cleaned = input.replace(/[^\d]/g, '');
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');
    
    // Limit to reasonable length
    cleaned = cleaned.slice(0, 15);
    
    // Emit value with + prefix and country code for proper E.164 format
    if (activeCountry) {
      const dialDigits = activeCountry.dialCode.replace(/[^0-9]/g, '');
      onChange(cleaned ? `+${dialDigits}${cleaned}` : '');
    } else {
      onChange(cleaned ? `+${cleaned}` : '');
    }
  }, [activeCountry, onChange]);
  
  // Get display value
  const displayValue = useMemo(() => {
    return formatPhoneNumber(localDigits, activeCountry || null);
  }, [localDigits, activeCountry]);
  
  // Sort countries: show active country first, then by name
  const sortedCountries = useMemo(() => {
    if (!activeCountryCode) return filteredCountries;
    
    return [...filteredCountries].sort((a, b) => {
      if (a.code === activeCountryCode) return -1;
      if (b.code === activeCountryCode) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredCountries, activeCountryCode]);
  
  return (
    <div className={cn('relative', className)}>
      <div className="flex">
        {/* Country Selector */}
        <button
          type="button"
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1 px-2 h-10 rounded-l-lg border border-r-0 border-input',
            'bg-background/50 backdrop-blur-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200 min-w-[85px] justify-center'
          )}
        >
          {isDetecting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
            </>
          ) : activeCountry ? (
            <>
              <span className="text-base">{activeCountry.flag}</span>
              <span className="text-xs text-muted-foreground">{activeCountry.dialCode}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
            </>
          ) : (
            <>
              <Phone className="h-4 w-4 text-muted-foreground" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </>
          )}
        </button>
        
        {/* Phone Input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          value={displayValue}
          onChange={handleChange}
          placeholder={activeCountry ? `Phone number` : placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 h-10 px-3 rounded-r-lg border border-input',
            'bg-background/50 backdrop-blur-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200'
          )}
        />
      </div>
      
      {/* Country Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute top-full left-0 mt-1 w-72 z-50',
            'rounded-lg border border-input bg-card shadow-lg',
            'max-h-80 overflow-hidden flex flex-col'
          )}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country..."
                className={cn(
                  'w-full h-9 pl-8 pr-3 rounded-md',
                  'bg-background border border-input',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'text-sm placeholder:text-muted-foreground'
                )}
              />
            </div>
          </div>
          
          {/* Detected Location */}
          {detectedCountry && !searchQuery && (
            <div className="px-2 py-1.5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Detected: {detectedCountry.name}</span>
              </div>
            </div>
          )}
          
          {/* Countries List */}
          <div className="overflow-y-auto flex-1 max-h-56 custom-scrollbar">
            {sortedCountries.length > 0 ? (
              sortedCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelectCountry(country)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left',
                    'hover:bg-muted/50 transition-colors',
                    activeCountry?.code === country.code && 'bg-primary/10'
                  )}
                >
                  <span className="text-base">{country.flag}</span>
                  <span className="flex-1 text-sm truncate">{country.name}</span>
                  <span className="text-xs text-muted-foreground">{country.dialCode}</span>
                  {activeCountry?.code === country.code && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No countries found
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground text-center">
            {COUNTRIES.length} countries available
          </div>
        </div>
      )}
      
      {/* Helper text */}
      {!activeCountry && !isDetecting && (
        <p className="text-xs text-muted-foreground mt-1">
          Select your country code first
        </p>
      )}
      
      {isDetecting && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <span className="animate-pulse">Detecting your location...</span>
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
