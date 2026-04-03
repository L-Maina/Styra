'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, LocateFixed, X, Loader2, Clock, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LocationResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    state?: string;
    country?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
  };
}

interface RecentLocation {
  displayName: string;
  lat: number;
  lng: number;
  timestamp: number;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, location?: { lat: number; lng: number }) => void;
  onCityChange?: (city: string) => void;
  onCountryChange?: (country: string) => void;
  placeholder?: string;
  className?: string;
}

// Local storage key for recent locations
const RECENT_LOCATIONS_KEY = 'styra-recent-locations';
const MAX_RECENT_LOCATIONS = 5;

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  onCityChange,
  onCountryChange,
  placeholder = 'Search for a location...',
  className,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load recent locations from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(RECENT_LOCATIONS_KEY);
        if (stored) {
          setRecentLocations(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load recent locations:', e);
      }
    }
  }, []);

  // Save recent location
  const saveRecentLocation = useCallback((displayName: string, lat: number, lng: number) => {
    setRecentLocations(prev => {
      const filtered = prev.filter(
        loc => loc.displayName !== displayName
      );
      const newLocation: RecentLocation = {
        displayName,
        lat,
        lng,
        timestamp: Date.now(),
      };
      const updated = [newLocation, ...filtered].slice(0, MAX_RECENT_LOCATIONS);
      
      // Save to localStorage
      try {
        localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent location:', e);
      }
      
      return updated;
    });
  }, []);

  // Sync with external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Update dropdown position when it opens
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Update position when dropdown opens or window resizes/scrolls
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      const handleUpdate = () => updateDropdownPosition();
      window.addEventListener('resize', handleUpdate);
      window.addEventListener('scroll', handleUpdate, true);
      return () => {
        window.removeEventListener('resize', handleUpdate);
        window.removeEventListener('scroll', handleUpdate, true);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Debounced search using Nominatim OpenStreetMap (free, no API key needed)
  const searchLocation = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&addressdetails=1&limit=5`
      );
      const data: LocationResult[] = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Location search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchLocation(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: LocationResult) => {
    const displayName = suggestion.display_name.split(',').slice(0, 2).join(', ');
    setQuery(displayName);
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);

    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    // Save to recent locations
    saveRecentLocation(displayName, lat, lng);

    onChange(displayName, { lat, lng });
    
    if (suggestion.address?.city && onCityChange) {
      onCityChange(suggestion.address.city);
    }
    if (suggestion.address?.country && onCountryChange) {
      onCountryChange(suggestion.address.country);
    }
  };

  // Handle recent location selection
  const handleSelectRecentLocation = (location: RecentLocation) => {
    setQuery(location.displayName);
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    onChange(location.displayName, { lat: location.lat, lng: location.lng });
  };

  // Detect current location
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Location Not Supported', {
        description: 'Your browser does not support geolocation. Please enter your location manually.',
      });
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode to get address
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          
          const displayName = data.display_name.split(',').slice(0, 2).join(', ');
          setQuery(displayName);
          
          // Save to recent locations
          saveRecentLocation(displayName, latitude, longitude);
          
          onChange(displayName, { lat: latitude, lng: longitude });
          
          if (data.address?.city && onCityChange) {
            onCityChange(data.address.city);
          }
          if (data.address?.country && onCountryChange) {
            onCountryChange(data.address.country);
          }
          
          toast.success('Location Detected', {
            description: `Your location has been set to ${displayName}`,
          });
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          // Still set coordinates even if reverse geocoding fails
          const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setQuery(coords);
          onChange(coords, { lat: latitude, lng: longitude });
          
          toast.success('Location Set', {
            description: `Your coordinates have been set to ${coords}`,
          });
        } finally {
          setIsDetecting(false);
          setIsOpen(false);
        }
      },
      (error) => {
        setIsDetecting(false);
        
        // Handle specific geolocation errors with user-friendly messages
        let title = 'Location Error';
        let description = 'Unable to detect your location. Please enter it manually.';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            title = 'Location Permission Denied';
            description = 'Please enable location permissions in your browser settings or enter your location manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            title = 'Location Unavailable';
            description = 'Your location information is unavailable. Please enter your location manually.';
            break;
          case error.TIMEOUT:
            title = 'Location Timeout';
            description = 'Location request timed out. Please try again or enter your location manually.';
            break;
          default:
            description = `An unknown error occurred (${error.code}). Please enter your location manually.`;
        }
        
        toast.error(title, {
          description,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onChange, onCityChange, onCountryChange, saveRecentLocation]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (recentLocations.length > 0 && !query ? recentLocations.length : 0) + 1; // +1 for "Use My Location"
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex === 0) {
        handleDetectLocation();
      } else if (selectedIndex > 0 && suggestions.length > 0) {
        const suggestionIndex = selectedIndex - 1 - (recentLocations.length > 0 && !query ? recentLocations.length : 0);
        if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[suggestionIndex]);
        }
      } else if (selectedIndex > 0 && !query && recentLocations.length > 0) {
        const recentIndex = selectedIndex - 1;
        if (recentIndex < recentLocations.length) {
          handleSelectRecentLocation(recentLocations[recentIndex]);
        }
      }
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine if we should show recent locations
  const showRecentLocations = !query && recentLocations.length > 0;
  const totalItems = 1 + (showRecentLocations ? recentLocations.length : 0) + suggestions.length;

  // Dropdown content for portal
  const dropdownContent = isOpen && mounted && (suggestions.length > 0 || isLoading || showRecentLocations || true) ? (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[60] max-h-80 overflow-y-auto rounded-xl shadow-2xl border border-border bg-white dark:bg-slate-800"
      style={{
        width: Math.max(dropdownPosition.width, 280) || 'auto',
        left: dropdownPosition.left,
        top: dropdownPosition.top,
      }}
    >
      {/* Use My Location - Always at top */}
      <button
        type="button"
        onClick={handleDetectLocation}
        disabled={isDetecting}
        className={cn(
          'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border flex items-center gap-3',
          selectedIndex === 0 && 'bg-primary/15'
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          {isDetecting ? (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4 text-blue-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary">Use My Location</p>
          <p className="text-xs text-muted-foreground">
            {isDetecting ? 'Detecting...' : 'Use your current location'}
          </p>
        </div>
      </button>

      {/* Recent Locations */}
      {showRecentLocations && (
        <div>
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Recent Locations
            </span>
          </div>
          {recentLocations.map((location, index) => (
            <button
              key={`recent-${location.timestamp}`}
              type="button"
              onClick={() => handleSelectRecentLocation(location)}
              className={cn(
                'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 flex items-center gap-3',
                selectedIndex === index + 1 && 'bg-primary/15'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{location.displayName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
        </div>
      )}

      {/* Search Results */}
      {!isLoading && suggestions.length > 0 && (
        <div>
          {showRecentLocations && (
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Search Results
              </span>
            </div>
          )}
          {suggestions.map((suggestion, index) => {
            const itemIndex = 1 + (showRecentLocations ? recentLocations.length : 0) + index;
            return (
              <button
                key={suggestion.place_id}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className={cn(
                  'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 flex items-center gap-3',
                  selectedIndex === itemIndex && 'bg-primary/15'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {suggestion.display_name.split(',')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestion.display_name.split(',').slice(1, 3).join(',')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results */}
      {!isLoading && query && suggestions.length === 0 && (
        <div className="px-4 py-6 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No locations found for &quot;{query}&quot;</p>
        </div>
      )}
    </motion.div>
  ) : null;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className={cn(
            'w-full h-10 pl-10 pr-20 rounded-lg border border-input',
            'bg-background/50 backdrop-blur-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'transition-all duration-200 text-foreground placeholder:text-muted-foreground'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onChange('');
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetecting}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'hover:bg-primary/10 text-primary',
              isDetecting && 'opacity-50 cursor-not-allowed'
            )}
            title="Use my location"
          >
            {isDetecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Suggestions Dropdown - Rendered via Portal at document body */}
      {mounted && dropdownContent && createPortal(
        <AnimatePresence>
          {dropdownContent}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default LocationAutocomplete;
