'use client';

import { useEffect, useCallback, useState } from 'react';
import { useCurrencyStore } from '@/store';
import { detectUserCountry, COUNTRY_BY_CODE, type Country } from '@/lib/countries';

interface UseLocationDetectionOptions {
  autoDetect?: boolean;
  defaultCountryCode?: string; // Default to Kenya (KE)
  onDetected?: (country: Country) => void;
}

interface UseLocationDetectionReturn {
  isDetecting: boolean;
  country: Country | null;
  detected: boolean;
  detect: () => Promise<void>;
  setCountry: (countryCode: string) => void;
}

export function useLocationDetection(
  options: UseLocationDetectionOptions = {}
): UseLocationDetectionReturn {
  const { 
    autoDetect = true, 
    defaultCountryCode = 'KE',
    onDetected 
  } = options;
  
  const [isDetecting, setIsDetecting] = useState(false);
  const [country, setCountry] = useState<Country | null>(null);
  const [detected, setDetected] = useState(false);
  
  const { 
    setCountry: setStoreCountry, 
    detectedLocation,
    countryCode: storeCountryCode 
  } = useCurrencyStore();
  
  // Initialize from store if already detected
  useEffect(() => {
    if (detectedLocation && storeCountryCode) {
      const storedCountry = COUNTRY_BY_CODE[storeCountryCode];
      if (storedCountry) {
        setCountry(storedCountry);
        setDetected(true);
      }
    }
  }, [detectedLocation, storeCountryCode]);
  
  // Detect location
  const detect = useCallback(async () => {
    if (isDetecting) return;
    
    setIsDetecting(true);
    
    try {
      const detectedCountry = await detectUserCountry();
      
      setCountry(detectedCountry);
      setDetected(true);
      setStoreCountry(detectedCountry.code);
      onDetected?.(detectedCountry);
    } catch {
      // Use default country (Kenya)
      const defaultCountry = COUNTRY_BY_CODE[defaultCountryCode] || COUNTRY_BY_CODE['KE'];
      setCountry(defaultCountry);
      setDetected(true);
      setStoreCountry(defaultCountry.code);
      onDetected?.(defaultCountry);
    } finally {
      setIsDetecting(false);
    }
  }, [isDetecting, setStoreCountry, onDetected, defaultCountryCode]);
  
  // Auto-detect on mount if enabled
  useEffect(() => {
    if (autoDetect && !detected && !isDetecting) {
      detect();
    }
  }, [autoDetect, detected, isDetecting, detect]);
  
  // Manual set country
  const setCountryManual = useCallback((countryCode: string) => {
    const newCountry = COUNTRY_BY_CODE[countryCode];
    if (newCountry) {
      setCountry(newCountry);
      setDetected(true);
      setStoreCountry(countryCode);
      onDetected?.(newCountry);
    }
  }, [setStoreCountry, onDetected]);
  
  return {
    isDetecting,
    country,
    detected,
    detect,
    setCountry: setCountryManual,
  };
}

export default useLocationDetection;
