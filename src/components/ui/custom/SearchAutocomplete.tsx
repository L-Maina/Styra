'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Scissors, Store, Tag, Star, MapPin, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Business, Service } from '@/types';

interface SearchSuggestion {
  id: string;
  label: string;
  type: 'category' | 'business' | 'service' | 'popular' | 'nearme' | 'location';
  icon: React.ReactNode;
  subtitle?: string;
  business?: Business;
  priority: number; // Lower number = higher priority
  location?: { lat: number; lng: number };
}

interface SearchAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  businesses?: Business[];
  placeholder?: string;
  className?: string;
  recentSearches?: string[];
  onSelectBusiness?: (business: Business) => void;
  onSearch?: (query: string) => void;
  showPopular?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onNearMe?: () => void;
  onLocationSearch?: (query: string, location: { lat: number; lng: number }) => void;
}

/**
 * Helper function to check if text matches at word boundaries
 * Returns a priority score (lower = better match):
 * - 1: Text starts with query (highest priority)
 * - 2: A word in the text starts with query
 * - 0: No match
 */
function getMatchPriority(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Priority 1: Text starts with query (best match)
  if (lowerText.startsWith(lowerQuery)) {
    return 1;
  }
  
  // Priority 2: A word in the text starts with query
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) {
      return 2;
    }
  }
  
  // No match
  return 0;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  value = '',
  onChange,
  businesses = [],
  placeholder = 'Search services, businesses, or styles...',
  className,
  onSelectBusiness,
  onSearch,
  showPopular = true,
  userLocation,
  onNearMe,
  onLocationSearch,
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
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
        top: rect.bottom + 8,
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

  // Get unique service categories from businesses
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    businesses.forEach((b) => {
      b.services?.forEach((s: Service) => {
        if (s.category) categorySet.add(s.category);
      });
    });
    return Array.from(categorySet);
  }, [businesses]);

  // Get unique service names
  const serviceNames = useMemo(() => {
    const serviceSet = new Set<string>();
    businesses.forEach((b) => {
      b.services?.forEach((s: Service) => {
        if (s.name) serviceSet.add(s.name);
      });
    });
    return Array.from(serviceSet);
  }, [businesses]);

  // Popular searches (featured businesses)
  const popularBusinesses = useMemo(() => {
    return businesses
      .filter(b => b.subscriptionPlan === 'FEATURED' || b.rating >= 4.8)
      .slice(0, 5);
  }, [businesses]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Generate suggestions based on query
  const suggestions = useMemo((): SearchSuggestion[] => {
    // If query is empty or very short, show popular businesses and "Near me" option
    if (!query || query.length < 2) {
      const results: SearchSuggestion[] = [];
      
      // Add "Near me" option if location is available
      if (userLocation) {
        results.push({
          id: 'nearme',
          label: 'Near Me',
          type: 'nearme',
          icon: <LocateFixed className="h-4 w-4 text-blue-500" />,
          subtitle: 'Search businesses near your location',
          priority: -1, // Highest priority
          location: userLocation,
        });
      }
      
      // Add popular businesses
      if (showPopular && popularBusinesses.length > 0) {
        // Sort by distance if user location is available
        const sortedPopular = userLocation 
          ? [...popularBusinesses]
              .filter(b => b.latitude && b.longitude)
              .sort((a, b) => {
                const distA = calculateDistance(userLocation.lat, userLocation.lng, a.latitude!, a.longitude!);
                const distB = calculateDistance(userLocation.lat, userLocation.lng, b.latitude!, b.longitude!);
                return distA - distB;
              })
              .slice(0, 5)
          : popularBusinesses;
        
        sortedPopular.forEach((b) => {
          const distance = userLocation && b.latitude && b.longitude
            ? calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
            : null;
          
          results.push({
            id: `popular-${b.id}`,
            label: b.name,
            type: 'popular' as const,
            icon: <Star className="h-4 w-4 text-amber-500" />,
            subtitle: distance 
              ? `${distance.toFixed(1)}km away • ⭐ ${b.rating.toFixed(1)}`
              : `${b.city || 'Business'} • ⭐ ${b.rating.toFixed(1)}`,
            business: b,
            priority: 0,
          });
        });
      }
      return results;
    }

    const results: SearchSuggestion[] = [];
    
    // Add "Near me" option at top when there's a query and location
    if (userLocation && (query.toLowerCase().includes('near') || query.toLowerCase().includes('me'))) {
      results.push({
        id: 'nearme',
        label: 'Near Me',
        type: 'nearme',
        icon: <LocateFixed className="h-4 w-4 text-blue-500" />,
        subtitle: `${query} near your location`,
        priority: -1,
        location: userLocation,
      });
    }

    // Match businesses with priority scoring
    businesses.forEach((b) => {
      const priority = getMatchPriority(b.name, query);
      if (priority > 0) {
        const distance = userLocation && b.latitude && b.longitude
          ? calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
          : null;
        
        results.push({
          id: `business-${b.id}`,
          label: b.name,
          type: 'business',
          icon: <Store className="h-4 w-4 text-blue-500" />,
          subtitle: distance 
            ? `${distance.toFixed(1)}km away • ⭐ ${b.rating.toFixed(1)}`
            : `${b.city || 'Business'} • ⭐ ${b.rating.toFixed(1)}`,
          business: b,
          priority,
          location: b.latitude && b.longitude ? { lat: b.latitude, lng: b.longitude } : undefined,
        });
      }
    });

    // Match categories with priority scoring
    categories.forEach((cat, i) => {
      const priority = getMatchPriority(cat, query);
      if (priority > 0) {
        results.push({
          id: `cat-${i}`,
          label: cat,
          type: 'category',
          icon: <Tag className="h-4 w-4 text-emerald-500" />,
          subtitle: 'Category',
          priority: priority + 1, // Categories slightly lower priority than businesses
        });
      }
    });

    // Match service names with priority scoring
    serviceNames.forEach((service, i) => {
      const priority = getMatchPriority(service, query);
      if (priority > 0) {
        results.push({
          id: `service-${i}`,
          label: service,
          type: 'service',
          icon: <Scissors className="h-4 w-4 text-purple-500" />,
          subtitle: 'Service',
          priority: priority + 2, // Services lower priority than categories
        });
      }
    });

    // Sort by priority (lower = better), then by distance if available, then alphabetically
    results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // If both have locations and user location is available, sort by distance
      if (userLocation && a.location && b.location) {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng);
        return distA - distB;
      }
      return a.label.localeCompare(b.label);
    });

    // Return max 10 results
    return results.slice(0, 10);
  }, [query, categories, businesses, serviceNames, popularBusinesses, showPopular, userLocation, calculateDistance]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange?.(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  // Handle suggestion selection - populates search field, does NOT filter
  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    // Populate the search field with the selected suggestion
    setQuery(suggestion.label);
    onChange?.(suggestion.label);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    // Handle "Near me" selection
    if (suggestion.type === 'nearme') {
      if (onNearMe) {
        onNearMe();
      } else if (suggestion.location && onLocationSearch) {
        onLocationSearch(query, suggestion.location);
      } else {
        onSearch?.(suggestion.label);
      }
      return;
    }
    
    // If it's a business, trigger business selection (for navigation)
    if ((suggestion.type === 'business' || suggestion.type === 'popular') && suggestion.business) {
      onSelectBusiness?.(suggestion.business);
    } else {
      // For categories and services, trigger search callback
      onSearch?.(suggestion.label);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else if (query.trim()) {
        onSearch?.(query);
        setIsOpen(false);
      }
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Open dropdown on focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Handle detect current location
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      // Geolocation not supported
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingLocation(false);
        onNearMe?.();
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onNearMe]);

  // Dropdown content for portal
  const dropdownContent = isOpen && suggestions.length > 0 && mounted ? (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[60] max-h-80 overflow-y-auto rounded-xl shadow-2xl border border-border bg-white dark:bg-slate-800"
      style={{ 
        width: Math.max(dropdownPosition.width, 280) || 'auto',
        left: dropdownPosition.left,
        top: dropdownPosition.top,
      }}
    >
      {/* Header */}
      {!query && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {userLocation ? 'Popular Near You' : 'Popular Businesses'}
          </span>
        </div>
      )}
      
      {/* Suggestions List */}
      <div className="p-1.5">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            data-index={index}
            type="button"
            onClick={() => handleSelectSuggestion(suggestion)}
            className={cn(
              'w-full px-3 py-2.5 text-left rounded-lg transition-all duration-150 flex items-center gap-3',
              selectedIndex === index
                ? 'bg-primary/15 text-primary'
                : 'hover:bg-muted/70 text-foreground'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              suggestion.type === 'nearme' ? 'bg-blue-100 dark:bg-blue-900/30' :
              suggestion.type === 'popular' ? 'bg-amber-100 dark:bg-amber-900/30' :
              suggestion.type === 'category' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
              suggestion.type === 'business' ? 'bg-blue-100 dark:bg-blue-900/30' :
              'bg-purple-100 dark:bg-purple-900/30'
            )}>
              {suggestion.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{suggestion.label}</p>
              {suggestion.subtitle && (
                <p className="text-xs text-muted-foreground truncate">{suggestion.subtitle}</p>
              )}
            </div>
            {suggestion.type === 'nearme' && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                Near Me
              </span>
            )}
            {suggestion.type === 'popular' && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                Top
              </span>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  ) : null;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className={cn(
            'w-full h-10 pl-10 pr-10 rounded-lg border border-input',
            'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
            'transition-all duration-200 text-foreground placeholder:text-muted-foreground'
          )}
        />
        {query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              onChange?.('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/80 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
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

export default SearchAutocomplete;
