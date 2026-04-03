'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Check, AlertCircle, Loader2, Globe } from 'lucide-react';
import { GlassCard, GlassButton, FadeIn } from './glass-components';
import { cn } from '@/lib/utils';

interface LocationPermissionPopupProps {
  isOpen: boolean;
  onClose: (granted: boolean) => void;
  onPermissionGranted?: (location: { lat: number; lng: number }) => void;
  onPermissionDenied?: () => void;
}

type PermissionState = 'prompt' | 'granted' | 'denied';

// Country to currency mapping
const countryToCurrency: Record<string, { currency: string; dialCode: string; name: string }> = {
  KE: { currency: 'KES', dialCode: '+254', name: 'Kenya' },
  NG: { currency: 'NGN', dialCode: '+234', name: 'Nigeria' },
  GH: { currency: 'GHS', dialCode: '+233', name: 'Ghana' },
  ZA: { currency: 'ZAR', dialCode: '+27', name: 'South Africa' },
  UG: { currency: 'UGX', dialCode: '+256', name: 'Uganda' },
  TZ: { currency: 'TZS', dialCode: '+255', name: 'Tanzania' },
  RW: { currency: 'RWF', dialCode: '+250', name: 'Rwanda' },
  ET: { currency: 'ETB', dialCode: '+251', name: 'Ethiopia' },
  EG: { currency: 'EGP', dialCode: '+20', name: 'Egypt' },
  MA: { currency: 'MAD', dialCode: '+212', name: 'Morocco' },
  US: { currency: 'USD', dialCode: '+1', name: 'United States' },
  CA: { currency: 'CAD', dialCode: '+1', name: 'Canada' },
  GB: { currency: 'GBP', dialCode: '+44', name: 'United Kingdom' },
  DE: { currency: 'EUR', dialCode: '+49', name: 'Germany' },
  FR: { currency: 'EUR', dialCode: '+33', name: 'France' },
  IT: { currency: 'EUR', dialCode: '+39', name: 'Italy' },
  ES: { currency: 'EUR', dialCode: '+34', name: 'Spain' },
  NL: { currency: 'EUR', dialCode: '+31', name: 'Netherlands' },
  AU: { currency: 'AUD', dialCode: '+61', name: 'Australia' },
  NZ: { currency: 'NZD', dialCode: '+64', name: 'New Zealand' },
  JP: { currency: 'JPY', dialCode: '+81', name: 'Japan' },
  CN: { currency: 'CNY', dialCode: '+86', name: 'China' },
  IN: { currency: 'INR', dialCode: '+91', name: 'India' },
  PK: { currency: 'PKR', dialCode: '+92', name: 'Pakistan' },
  BD: { currency: 'BDT', dialCode: '+880', name: 'Bangladesh' },
  TH: { currency: 'THB', dialCode: '+66', name: 'Thailand' },
  VN: { currency: 'VND', dialCode: '+84', name: 'Vietnam' },
  ID: { currency: 'IDR', dialCode: '+62', name: 'Indonesia' },
  MY: { currency: 'MYR', dialCode: '+60', name: 'Malaysia' },
  SG: { currency: 'SGD', dialCode: '+65', name: 'Singapore' },
  PH: { currency: 'PHP', dialCode: '+63', name: 'Philippines' },
  HK: { currency: 'HKD', dialCode: '+852', name: 'Hong Kong' },
  KR: { currency: 'KRW', dialCode: '+82', name: 'South Korea' },
  AE: { currency: 'AED', dialCode: '+971', name: 'UAE' },
  SA: { currency: 'SAR', dialCode: '+966', name: 'Saudi Arabia' },
  QA: { currency: 'QAR', dialCode: '+974', name: 'Qatar' },
  KW: { currency: 'KWD', dialCode: '+965', name: 'Kuwait' },
  BR: { currency: 'BRL', dialCode: '+55', name: 'Brazil' },
  AR: { currency: 'ARS', dialCode: '+54', name: 'Argentina' },
  MX: { currency: 'MXN', dialCode: '+52', name: 'Mexico' },
  CH: { currency: 'CHF', dialCode: '+41', name: 'Switzerland' },
  SE: { currency: 'SEK', dialCode: '+46', name: 'Sweden' },
  NO: { currency: 'NOK', dialCode: '+47', name: 'Norway' },
  DK: { currency: 'DKK', dialCode: '+45', name: 'Denmark' },
  PL: { currency: 'PLN', dialCode: '+48', name: 'Poland' },
  TR: { currency: 'TRY', dialCode: '+90', name: 'Turkey' },
  RU: { currency: 'RUB', dialCode: '+7', name: 'Russia' },
};

export const LocationPermissionPopup: React.FC<LocationPermissionPopupProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<{
    country: string;
    city?: string;
    currency: string;
  } | null>(null);

  // Request location permission
  const requestLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      // Get current position - THIS will trigger browser's permission popup
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 0, // Don't use cached position
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get country
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );

        if (response.ok) {
          const data = await response.json();
          const countryCode = data.address?.country_code?.toUpperCase();
          const city = data.address?.city || data.address?.town || data.address?.state;

          if (countryCode && countryToCurrency[countryCode]) {
            const countryInfo = countryToCurrency[countryCode];
            setDetectedLocation({
              country: countryInfo.name,
              city: city,
              currency: countryInfo.currency,
            });

            // Store permission state
            localStorage.setItem('styra-location-permission', 'granted');
            localStorage.setItem('styra-location', JSON.stringify({
              lat: latitude,
              lng: longitude,
              country: countryCode,
              currency: countryInfo.currency,
              dialCode: countryInfo.dialCode,
            }));

            onPermissionGranted?.({ lat: latitude, lng: longitude });
          } else {
            // Unknown country, use defaults
            setDetectedLocation({
              country: 'Unknown',
              currency: 'USD',
            });
            localStorage.setItem('styra-location-permission', 'granted');
            onPermissionGranted?.({ lat: latitude, lng: longitude });
          }
        }
      } catch {
        // Geocoding failed but we have coordinates
        setDetectedLocation({
          country: 'Unknown',
          currency: 'USD',
        });
        localStorage.setItem('styra-location-permission', 'granted');
        onPermissionGranted?.({ lat: latitude, lng: longitude });
      }
    } catch (err: any) {
      console.error('Location error:', err);

      // Try timezone fallback as last resort
      const timezoneCountry = detectCountryFromTimezone();
      if (timezoneCountry && countryToCurrency[timezoneCountry]) {
        const countryInfo = countryToCurrency[timezoneCountry];
        setDetectedLocation({
          country: countryInfo.name,
          currency: countryInfo.currency,
        });
        localStorage.setItem('styra-location-permission', 'granted');
        localStorage.setItem('styra-location', JSON.stringify({
          lat: 0,
          lng: 0,
          country: timezoneCountry,
          currency: countryInfo.currency,
          dialCode: countryInfo.dialCode,
        }));
        onPermissionGranted?.({ lat: 0, lng: 0 });
      } else if (err.code === 1) {
        // Permission denied by user
        setError('Location permission denied. You can enable it later in your browser settings.');
        localStorage.setItem('styra-location-permission', 'denied');
        onPermissionDenied?.();
      } else if (err.code === 2) {
        // Position unavailable
        setError('Unable to determine your location. Please check your device settings.');
      } else if (err.code === 3) {
        // Timeout
        setError('Location request timed out. Please try again.');
      } else {
        setError(err.message || 'An error occurred while getting your location.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Detect country from timezone (fallback)
  const detectCountryFromTimezone = (): string | null => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const timezoneToCountry: Record<string, string> = {
        'Africa/Nairobi': 'KE',
        'Africa/Lagos': 'NG',
        'Africa/Cairo': 'EG',
        'Africa/Johannesburg': 'ZA',
        'Africa/Casablanca': 'MA',
        'Africa/Accra': 'GH',
        'Africa/Kampala': 'UG',
        'Africa/Dar_es_Salaam': 'TZ',
        'Africa/Kigali': 'RW',
        'Africa/Addis_Ababa': 'ET',
        'America/New_York': 'US',
        'America/Chicago': 'US',
        'America/Denver': 'US',
        'America/Los_Angeles': 'US',
        'America/Toronto': 'CA',
        'America/Vancouver': 'CA',
        'America/Mexico_City': 'MX',
        'America/Sao_Paulo': 'BR',
        'America/Buenos_Aires': 'AR',
        'Europe/London': 'GB',
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Madrid': 'ES',
        'Europe/Rome': 'IT',
        'Europe/Amsterdam': 'NL',
        'Europe/Brussels': 'BE',
        'Europe/Vienna': 'AT',
        'Europe/Warsaw': 'PL',
        'Europe/Moscow': 'RU',
        'Europe/Istanbul': 'TR',
        'Europe/Athens': 'GR',
        'Europe/Stockholm': 'SE',
        'Europe/Oslo': 'NO',
        'Europe/Copenhagen': 'DK',
        'Europe/Helsinki': 'FI',
        'Europe/Dublin': 'IE',
        'Europe/Lisbon': 'PT',
        'Europe/Prague': 'CZ',
        'Europe/Budapest': 'HU',
        'Europe/Bucharest': 'RO',
        'Europe/Zurich': 'CH',
        'Asia/Dubai': 'AE',
        'Asia/Riyadh': 'SA',
        'Asia/Kuwait': 'KW',
        'Asia/Qatar': 'QA',
        'Asia/Bahrain': 'BH',
        'Asia/Tehran': 'IR',
        'Asia/Baghdad': 'IQ',
        'Asia/Jerusalem': 'IL',
        'Asia/Beirut': 'LB',
        'Asia/Amman': 'JO',
        'Asia/Damascus': 'SY',
        'Asia/Karachi': 'PK',
        'Asia/Kolkata': 'IN',
        'Asia/Dhaka': 'BD',
        'Asia/Kathmandu': 'NP',
        'Asia/Colombo': 'LK',
        'Asia/Bangkok': 'TH',
        'Asia/Singapore': 'SG',
        'Asia/Kuala_Lumpur': 'MY',
        'Asia/Jakarta': 'ID',
        'Asia/Manila': 'PH',
        'Asia/Hong_Kong': 'HK',
        'Asia/Shanghai': 'CN',
        'Asia/Tokyo': 'JP',
        'Asia/Seoul': 'KR',
        'Asia/Taipei': 'TW',
        'Australia/Sydney': 'AU',
        'Australia/Melbourne': 'AU',
        'Australia/Brisbane': 'AU',
        'Australia/Perth': 'AU',
        'Pacific/Auckland': 'NZ',
      };
      
      return timezoneToCountry[timezone] || null;
    } catch {
      return null;
    }
  };

  // Handle skip
  const handleSkip = () => {
    localStorage.setItem('styra-location-permission', 'skipped');
    onClose(false);
  };

  // Handle continue with detected location
  const handleContinue = () => {
    onClose(true);
  };

  // Handle retry
  const handleRetry = () => {
    setError(null);
    setDetectedLocation(null);
    requestLocation();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={() => !isLoading && onClose(false)}
        />

        {/* Modal */}
        <FadeIn>
          <GlassCard variant="elevated" className="relative w-full max-w-md p-6 sm:p-8 liquid-glass">
            {/* Close button */}
            {!isLoading && !detectedLocation && (
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {/* Content */}
            <div className="text-center">
              {/* Icon */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
                {isLoading ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : detectedLocation ? (
                  <Check className="h-10 w-10 text-green-500" />
                ) : error ? (
                  <AlertCircle className="h-10 w-10 text-yellow-500" />
                ) : (
                  <MapPin className="h-10 w-10 text-primary" />
                )}
              </div>

              {/* Title */}
              <h2 className="text-xl sm:text-2xl font-bold mb-2">
                {isLoading
                  ? 'Detecting Your Location...'
                  : detectedLocation
                  ? 'Location Detected!'
                  : error
                  ? 'Location Unavailable'
                  : 'Enable Location'}
              </h2>

              {/* Description */}
              <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                {isLoading
                  ? 'Please wait while we detect your location for the best experience.'
                  : detectedLocation
                  ? `We've detected you're in ${detectedLocation.city ? `${detectedLocation.city}, ` : ''}${detectedLocation.country}. Your currency will be set to ${detectedLocation.currency}.`
                  : error
                  ? error
                  : 'Allow location access to get personalized recommendations, local businesses, and the right currency for your region.'}
              </p>

              {/* Benefits */}
              {!isLoading && !detectedLocation && !error && (
                <div className="space-y-3 mb-6 text-left">
                  {[
                    { icon: Globe, text: 'Automatic currency & language settings' },
                    { icon: MapPin, text: 'Find businesses near you' },
                    { icon: Check, text: 'Localized recommendations' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {isLoading ? (
                  <GlassButton variant="ghost" onClick={handleSkip} className="flex-1">
                    Cancel
                  </GlassButton>
                ) : detectedLocation ? (
                  <>
                    <GlassButton variant="ghost" onClick={handleSkip} className="flex-1">
                      Use Default
                    </GlassButton>
                    <GlassButton variant="primary" onClick={handleContinue} className="flex-1">
                      Continue
                    </GlassButton>
                  </>
                ) : error ? (
                  <>
                    <GlassButton variant="ghost" onClick={handleSkip} className="flex-1">
                      Skip for Now
                    </GlassButton>
                    <GlassButton variant="primary" onClick={handleRetry} className="flex-1">
                      Try Again
                    </GlassButton>
                  </>
                ) : (
                  <>
                    <GlassButton variant="ghost" onClick={handleSkip} className="flex-1">
                      Skip for Now
                    </GlassButton>
                    <GlassButton variant="primary" onClick={requestLocation} className="flex-1">
                      <MapPin className="h-4 w-4 mr-2" />
                      Allow Location
                    </GlassButton>
                  </>
                )}
              </div>

              {/* Privacy note */}
              {!detectedLocation && !error && (
                <p className="text-xs text-muted-foreground mt-4">
                  Your location is only used to enhance your experience and is never shared without your permission.
                </p>
              )}
            </div>
          </GlassCard>
        </FadeIn>
      </motion.div>
    </AnimatePresence>
  );
};

// Hook to check if location permission has been asked
export const useLocationPermission = () => {
  const [permissionState, setPermissionState] = useState<PermissionState | 'skipped' | null>(null);
  const [hasAsked, setHasAsked] = useState(false);
  const [storedLocation, setStoredLocation] = useState<{
    lat: number;
    lng: number;
    country: string;
    currency: string;
    dialCode: string;
  } | null>(null);

  useEffect(() => {
    // Check localStorage for previous permission state
    const stored = localStorage.getItem('styra-location-permission');
    const locationData = localStorage.getItem('styra-location');

    // Use requestAnimationFrame to defer setState outside effect
    const frame = requestAnimationFrame(() => {
      if (stored) {
        setHasAsked(true);
        setPermissionState(stored as PermissionState | 'skipped');
      }

      if (locationData) {
        try {
          setStoredLocation(JSON.parse(locationData));
        } catch {
          // Invalid JSON, ignore
        }
      }
    });
    
    return () => cancelAnimationFrame(frame);
  }, []);

  const shouldAskPermission = !hasAsked;

  return {
    permissionState,
    hasAsked,
    shouldAskPermission,
    storedLocation,
    setPermissionAsked: (state: PermissionState | 'skipped') => {
      localStorage.setItem('styra-location-permission', state);
      setHasAsked(true);
      setPermissionState(state);
    },
  };
};

export default LocationPermissionPopup;
