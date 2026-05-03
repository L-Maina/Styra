'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  SlidersHorizontal, 
  Grid3X3, 
  List, 
  MapPin,
  Star,
  X,
  ChevronDown,
  Navigation,
  Calendar,
  DollarSign,
  Clock,
  Filter,
  Check,
  Loader2,
  LayoutGrid,
  Heart,
  TrendingUp,
  ArrowUpDown,
  Target,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GlassBadge,
  FadeIn,
  StaggerChildren,
  StaggerItem,
} from '@/components/ui/custom/glass-components';
import { LocationAutocomplete } from '@/components/ui/custom/LocationAutocomplete';
import { SearchAutocomplete } from '@/components/ui/custom/SearchAutocomplete';
import { BusinessCard } from '@/components/home/FeaturedBusinesses';
import type { Business } from '@/types';
import { cn } from '@/lib/utils';

interface MarketplacePageProps {
  businesses: Business[];
  searchQuery?: string;
  selectedCategory?: string;
  useMyLocation?: boolean;
  onSelectBusiness?: (business: Business) => void;
  onSearch?: (query: string) => void;
  onFavorite?: (business: Business) => void;
  isGuest?: boolean;
}

// Service categories for chips
const serviceCategories = [
  { id: 'all', label: 'All Services', icon: LayoutGrid },
  { id: 'haircuts', label: 'Haircuts & Styling', icon: null },
  { id: 'beard', label: 'Beard Grooming', icon: null },
  { id: 'coloring', label: 'Hair Coloring', icon: null },
  { id: 'nails', label: 'Nail Services', icon: null },
  { id: 'skincare', label: 'Skin Care', icon: null },
  { id: 'makeup', label: 'Makeup', icon: null },
  { id: 'spa', label: 'Spa & Wellness', icon: null },
  { id: 'massage', label: 'Massage', icon: null },
  { id: 'barber', label: 'Barber Services', icon: null },
  { id: 'extensions', label: 'Hair Extensions', icon: null },
];

// Sort options
const sortOptions = [
  { value: 'relevance', label: 'Relevance', icon: Target },
  { value: 'distance', label: 'Distance', icon: MapPin },
  { value: 'rating', label: 'Rating', icon: Star },
  { value: 'price_low', label: 'Price: Low to High', icon: ArrowUpDown },
  { value: 'price_high', label: 'Price: High to Low', icon: ArrowUpDown },
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
];

// Rating options
const ratingOptions = [
  { value: 0, label: 'Any Rating' },
  { value: 3, label: '3+ Stars' },
  { value: 3.5, label: '3.5+ Stars' },
  { value: 4, label: '4+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
];

// Radius options for slider
const radiusOptions = [5, 10, 15, 20, 25, 30, 40, 50];

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  businesses,
  searchQuery = '',
  selectedCategory = '',
  useMyLocation = false,
  onSelectBusiness,
  onSearch,
  onFavorite,
  isGuest = false,
}) => {
  // Basic search state
  const [query, setQuery] = useState(searchQuery);
  
  // Location state
  const [locationText, setLocationText] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(15);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  
  // Sync query with searchQuery prop (for footer service links)
  useEffect(() => {
    if (searchQuery) {
      setQuery(searchQuery);
    }
  }, [searchQuery]);
  
  // Service categories state (multi-select)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    selectedCategory ? [selectedCategory] : ['all']
  );
  
  // Price filter state
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceSliderValue, setPriceSliderValue] = useState<[number, number]>([0, 99999]);
  const [freeConsultation, setFreeConsultation] = useState(false);
  
  // Rating filter state
  const [minRating, setMinRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  
  // Availability filter state
  const [availableNow, setAvailableNow] = useState(false);
  const [availableToday, setAvailableToday] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  
  // Sort state
  const [sortBy, setSortBy] = useState('relevance');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // View and UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Dropdown hover states with debounce to prevent accidental close
  const [hoveredDropdown, setHoveredDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover handlers with delay to bridge gap between button and dropdown
  const handleDropdownEnter = useCallback((id: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setHoveredDropdown(id);
  }, []);

  const handleDropdownLeave = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setHoveredDropdown(null);
      dropdownTimeoutRef.current = null;
    }, 150);
  }, []);

  // Get unique cities from businesses
  const cities = useMemo(() => {
    const uniqueCities = [...new Set(businesses.map((b) => b.city).filter(Boolean))];
    return uniqueCities as string[];
  }, [businesses]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (query) count++;
    if (locationText) count++;
    if (!selectedCategories.includes('all') && selectedCategories.length > 0) count++;
    if (minPrice || maxPrice) count++;
    if (freeConsultation) count++;
    if (minRating > 0) count++;
    if (availableNow) count++;
    if (availableToday) count++;
    if (selectedDate) count++;
    return count;
  }, [query, locationText, selectedCategories, minPrice, maxPrice, freeConsultation, minRating, availableNow, availableToday, selectedDate]);

  // Handle "Near me" button - defined before useEffect that uses it
  const handleNearMe = useCallback((silent = false) => {
    if (!navigator.geolocation) {
      // Silently fail - user can type location manually
      // Geolocation not supported
      return;
    }

    setIsDetectingLocation(true);
    // Show "My Location" immediately in the location bar
    setLocationText('My Location');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          const displayName = data.display_name.split(',').slice(0, 2).join(', ');
          setLocationText(displayName);
        } catch (error) {
          // Keep "My Location" if reverse geocoding fails - coordinates are captured
          // Reverse geocoding failed — keeping 'My Location'
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        // Silently fail - log to console, don't show alert
        // Location detection unavailable
        setLocationText(''); // Clear the "My Location" text on failure
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Auto-detect location when useMyLocation is true (from footer service links)
  useEffect(() => {
    if (useMyLocation && !userLocation && !isDetectingLocation) {
      handleNearMe(true); // Silent mode - no alerts
    }
  }, [useMyLocation, userLocation, isDetectingLocation, handleNearMe]);

  // Handle location change
  const handleLocationChange = useCallback((value: string, location?: { lat: number; lng: number }) => {
    setLocationText(value);
    if (location) {
      setUserLocation(location);
    } else {
      setUserLocation(null);
    }
  }, []);

  // Handle category chip toggle
  const handleCategoryToggle = useCallback((categoryId: string) => {
    if (categoryId === 'all') {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        const newCategories = prev.filter(c => c !== 'all');
        if (prev.includes(categoryId)) {
          const filtered = newCategories.filter(c => c !== categoryId);
          return filtered.length === 0 ? ['all'] : filtered;
        } else {
          return [...newCategories, categoryId];
        }
      });
    }
  }, []);

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

  // Filter and sort businesses
  const filteredBusinesses = useMemo(() => {
    let result = [...businesses];

    // Filter by search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(lowerQuery) ||
          b.description?.toLowerCase().includes(lowerQuery) ||
          b.city?.toLowerCase().includes(lowerQuery)
      );
    }

    // Filter by location and radius
    if (userLocation) {
      result = result.filter((b) => {
        if (!b.latitude || !b.longitude) return false;
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.latitude,
          b.longitude
        );
        return distance <= radius;
      });
    } else if (locationText && !userLocation) {
      // Simple text-based location filter
      const lowerLocation = locationText.toLowerCase();
      result = result.filter(
        (b) =>
          b.city?.toLowerCase().includes(lowerLocation) ||
          b.address?.toLowerCase().includes(lowerLocation)
      );
    }

    // Filter by categories
    if (!selectedCategories.includes('all') && selectedCategories.length > 0) {
      result = result.filter((b) =>
        b.services?.some((s) =>
          selectedCategories.some((cat) =>
            s.category.toLowerCase().includes(cat.toLowerCase())
          )
        )
      );
    }

    // Filter by price range — only apply if user explicitly set price bounds
    if (minPrice || maxPrice) {
      const minPriceNum = minPrice ? parseInt(minPrice) : 0;
      const maxPriceNum = maxPrice ? parseInt(maxPrice) : 99999;
      
      result = result.filter((b) => {
        if (freeConsultation) {
          const hasFreeService = b.services?.some((s) => s.price === 0);
          if (!hasFreeService) return false;
        }
        
        // Businesses with no services pass the price filter (no price to filter on)
        const prices = b.services?.length ? b.services.map((s) => s.price) : null;
        if (!prices) return true;
        
        const businessMinPrice = Math.min(...prices);
        const businessMaxPrice = Math.max(...prices);
        
        return businessMinPrice <= maxPriceNum && businessMaxPrice >= minPriceNum;
      });
    } else if (freeConsultation) {
      result = result.filter((b) => {
        const hasFreeService = b.services?.some((s) => s.price === 0);
        return hasFreeService;
      });
    }

    // Filter by rating
    if (minRating > 0) {
      result = result.filter((b) => b.rating >= minRating);
    }

    // Filter by availability
    if (availableNow || availableToday || selectedDate) {
      // Simulate availability filtering - in real app, this would check booking slots
      result = result.filter((b) => b.isActive);
    }

    // Sort results
    switch (sortBy) {
      case 'distance':
        if (userLocation) {
          result.sort((a, b) => {
            if (!a.latitude || !b.latitude) return 0;
            const distA = calculateDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude || 0);
            const distB = calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude || 0);
            return distA - distB;
          });
        }
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'price_low':
        result.sort((a, b) => {
          const aPrices = a.services?.length ? a.services.map((s) => s.price) : [0];
          const bPrices = b.services?.length ? b.services.map((s) => s.price) : [0];
          const aMin = Math.min(...aPrices);
          const bMin = Math.min(...bPrices);
          return aMin - bMin;
        });
        break;
      case 'price_high':
        result.sort((a, b) => {
          const aPrices = a.services?.length ? a.services.map((s) => s.price) : [0];
          const bPrices = b.services?.length ? b.services.map((s) => s.price) : [0];
          const aMax = Math.max(...aPrices);
          const bMax = Math.max(...bPrices);
          return bMax - aMax;
        });
        break;
      case 'popular':
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      default:
        // Relevance - featured businesses first, then by rating
        result.sort((a, b) => {
          if (a.subscriptionPlan === 'FEATURED' && b.subscriptionPlan !== 'FEATURED') return -1;
          if (b.subscriptionPlan === 'FEATURED' && a.subscriptionPlan !== 'FEATURED') return 1;
          return b.rating - a.rating;
        });
    }

    return result;
  }, [businesses, query, userLocation, locationText, radius, selectedCategories, minPrice, maxPrice, priceSliderValue, freeConsultation, minRating, availableNow, availableToday, selectedDate, sortBy, calculateDistance]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setQuery('');
    setLocationText('');
    setUserLocation(null);
    setRadius(15);
    setSelectedCategories(['all']);
    setMinPrice('');
    setMaxPrice('');
    setPriceSliderValue([0, 99999]);
    setFreeConsultation(false);
    setMinRating(0);
    setAvailableNow(false);
    setAvailableToday(false);
    setSelectedDate('');
    setSortBy('relevance');
  }, []);

  // Remove individual filter
  const removeFilter = useCallback((filterType: string) => {
    switch (filterType) {
      case 'query':
        setQuery('');
        break;
      case 'location':
        setLocationText('');
        setUserLocation(null);
        break;
      case 'categories':
        setSelectedCategories(['all']);
        break;
      case 'price':
        setMinPrice('');
        setMaxPrice('');
        setPriceSliderValue([0, 99999]);
        break;
      case 'freeConsultation':
        setFreeConsultation(false);
        break;
      case 'rating':
        setMinRating(0);
        break;
      case 'availableNow':
        setAvailableNow(false);
        break;
      case 'availableToday':
        setAvailableToday(false);
        break;
      case 'selectedDate':
        setSelectedDate('');
        break;
    }
  }, []);

  // Generate active filter tags
  const activeFilterTags = useMemo(() => {
    const tags: { type: string; label: string }[] = [];
    
    if (query) {
      tags.push({ type: 'query', label: `Search: "${query}"` });
    }
    if (locationText) {
      tags.push({ type: 'location', label: locationText });
    }
    if (!selectedCategories.includes('all') && selectedCategories.length > 0) {
      const categoryLabels = selectedCategories.map(
        (cat) => serviceCategories.find((c) => c.id === cat)?.label
      ).filter(Boolean);
      tags.push({ type: 'categories', label: categoryLabels.join(', ') });
    }
    if (minPrice || maxPrice) {
      if (minPrice && maxPrice) {
        tags.push({ type: 'price', label: `$${minPrice} - $${maxPrice}` });
      } else if (minPrice) {
        tags.push({ type: 'price', label: `$${minPrice}+` });
      } else {
        tags.push({ type: 'price', label: `Up to $${maxPrice}` });
      }
    }
    if (freeConsultation) {
      tags.push({ type: 'freeConsultation', label: 'Free Consultation' });
    }
    if (minRating > 0) {
      tags.push({ type: 'rating', label: `${minRating}+ Stars` });
    }
    if (availableNow) {
      tags.push({ type: 'availableNow', label: 'Available Now' });
    }
    if (availableToday) {
      tags.push({ type: 'availableToday', label: 'Available Today' });
    }
    if (selectedDate) {
      tags.push({ type: 'selectedDate', label: selectedDate });
    }
    
    return tags;
  }, [query, locationText, selectedCategories, minPrice, maxPrice, freeConsultation, minRating, availableNow, availableToday, selectedDate]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSortDropdown(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen py-6"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">
              Discover <span className="gradient-text">Businesses</span>
            </h1>
            <p className="text-muted-foreground">
              Find the perfect grooming service for your style
            </p>
          </div>
        </FadeIn>

        {/* Main Search Bar - Airbnb Style */}
        <FadeIn delay={0.1}>
          <div className="glass-card p-4 mb-6">
            {/* Primary Search Row */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Text Search */}
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">What are you looking for?</label>
                <SearchAutocomplete
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    onSearch?.(value);
                  }}
                  businesses={businesses}
                  placeholder="Search services, businesses, or styles..."
                  className="w-full"
                />
              </div>

              {/* Location Search */}
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Where?</label>
                <LocationAutocomplete
                  value={locationText}
                  onChange={handleLocationChange}
                  placeholder="Search location..."
                  className="w-full"
                />
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <GlassButton
                  variant="primary"
                  size="lg"
                  className="w-full lg:w-auto px-8"
                  leftIcon={<Search className="h-4 w-4" />}
                  onClick={() => onSearch?.(query)}
                >
                  Search
                </GlassButton>
              </div>
            </div>

            {/* Category Chips */}
            <div className="mt-4 -mb-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 pb-2">
                {serviceCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryToggle(category.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap',
                        'border transition-all duration-200',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary/50 shadow-sm'
                          : 'bg-background/50 border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {category.id === 'all' && <LayoutGrid className="h-3.5 w-3.5" />}
                      {category.label}
                      {isSelected && category.id !== 'all' && (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Filter Bar */}
        <FadeIn delay={0.15}>
          <div className="flex items-center gap-3 mb-4">
            {/* Left: Filter Buttons */}
            <div className="flex items-center gap-2 flex-1 flex-nowrap">
              {/* Mobile Filter Button */}
              <GlassButton
                variant="default"
                onClick={() => setShowMobileFilters(true)}
                leftIcon={<Filter className="h-4 w-4" />}
                className="lg:hidden"
              >
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full gradient-bg text-white text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </GlassButton>

              {/* Desktop Filter Bar — text buttons with underline indicators, dropdown overlays */}
              <div className="hidden lg:flex items-center gap-1">
                {/* Price Filter */}
                <div
                  className="relative"
                  onMouseEnter={() => handleDropdownEnter('price')}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                      (minPrice || maxPrice)
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    {(minPrice || maxPrice) ? `$${minPrice || 0}-${maxPrice || '∞'}` : 'Price'}
                    {(minPrice || maxPrice) && (
                      <motion.span
                        layoutId="filter-underline-price"
                        className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                  
                  <AnimatePresence>
                  {hoveredDropdown === 'price' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}
                      className="w-72 bg-background/95 border border-border/50 rounded-xl p-4 z-[60] shadow-xl"
                    >
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Min</label>
                            <input
                              type="number"
                              value={minPrice}
                              onChange={(e) => setMinPrice(e.target.value)}
                              placeholder="0"
                              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Max</label>
                            <input
                              type="number"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              placeholder="500+"
                              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {['0-50', '50-100', '100-200', '200+'].map((range) => (
                            <button
                              key={range}
                              onClick={() => {
                                const parts = range.split('-');
                                setMinPrice(parts[0] === '0' ? '' : parts[0]);
                                setMaxPrice(parts[1] || '');
                              }}
                              className="px-2 py-1 text-xs rounded bg-muted/50 hover:bg-muted"
                            >
                              {range}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>

                {/* Rating Filter */}
                <div
                  className="relative"
                  onMouseEnter={() => handleDropdownEnter('rating')}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                      minRating > 0
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Star className="h-3.5 w-3.5" />
                    {minRating > 0 ? `${minRating}+ Stars` : 'Rating'}
                    {minRating > 0 && (
                      <motion.span
                        layoutId="filter-underline-rating"
                        className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                  
                  <AnimatePresence>
                  {hoveredDropdown === 'rating' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}
                      className="w-48 bg-background/95 border border-border/50 rounded-xl p-2 z-[60] shadow-xl"
                    >
                      {[0, 3, 3.5, 4, 4.5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => {
                            setMinRating(rating);
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left',
                            minRating === rating ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                          )}
                        >
                          {rating === 0 ? 'Any Rating' : `${rating}+ Stars`}
                        </button>
                      ))}
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>

                {/* Availability Filter */}
                <div
                  className="relative"
                  onMouseEnter={() => handleDropdownEnter('availability')}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                      (availableNow || availableToday)
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {availableNow ? 'Open Now' : availableToday ? 'Open Today' : 'Availability'}
                    {(availableNow || availableToday) && (
                      <motion.span
                        layoutId="filter-underline-availability"
                        className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                  
                  <AnimatePresence>
                  {hoveredDropdown === 'availability' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}
                      className="w-56 bg-background/95 border border-border/50 rounded-xl p-3 z-[60] shadow-xl"
                    >
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setAvailableNow(!availableNow);
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left',
                            availableNow ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                          )}
                        >
                          <Clock className="h-4 w-4" />
                          Open Now
                        </button>
                        <button
                          onClick={() => {
                            setAvailableToday(!availableToday);
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left',
                            availableToday ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                          )}
                        >
                          <Calendar className="h-4 w-4" />
                          Open Today
                        </button>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>

                {/* Radius Filter (only when location is set) */}
                {locationText && (
                  <div
                    className="relative"
                    onMouseEnter={() => handleDropdownEnter('radius')}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <button
                      className="relative flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {radius}km
                    </button>
                    
                    <AnimatePresence>
                    {hoveredDropdown === 'radius' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}
                        className="w-56 bg-background/95 border border-border/50 rounded-xl p-3 z-[60] shadow-xl"
                      >
                        <label className="text-xs text-muted-foreground mb-2 block">
                          Search radius: {radius} km
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={radius}
                          onChange={(e) => setRadius(parseInt(e.target.value))}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>5km</span>
                          <span>50km</span>
                        </div>
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sort & View */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Sort Dropdown */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-background/50 border border-border hover:border-primary/50 transition-colors"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {sortOptions.find((o) => o.value === sortBy)?.label}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8 }}
                      className="w-48 bg-background/95 border border-border/50 rounded-xl p-2 z-50 shadow-xl"
                    >
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
                            sortBy === option.value
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* View Toggle */}
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted/50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Active Filter Tags */}
        {activeFilterTags.length > 0 && (
          <FadeIn delay={0.2}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {activeFilterTags.map((tag) => (
                <GlassBadge
                  key={tag.type}
                  variant="primary"
                  className="flex items-center gap-1.5 pr-1"
                >
                  <span>{tag.label}</span>
                  <button
                    onClick={() => removeFilter(tag.type)}
                    className="p-0.5 rounded-full hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </GlassBadge>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-sm text-destructive hover:text-destructive/80 font-medium"
              >
                Clear all
              </button>
            </div>
          </FadeIn>
        )}

        {/* Results Count */}
        <FadeIn delay={0.2}>
          <div className="mb-4">
            <p className="text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">{filteredBusinesses.length}</span>
              {' '}businesses
              {locationText && (
                <span>
                  {' '}within <span className="font-medium">{radius}km</span> of{' '}
                  <span className="font-medium">{locationText}</span>
                </span>
              )}
            </p>
          </div>
        </FadeIn>

        {/* Business Grid/List */}
        {filteredBusinesses.length > 0 ? (
          <StaggerChildren
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {filteredBusinesses.map((business) => (
              <StaggerItem key={business.id}>
                <BusinessCard
                  business={business}
                  onClick={() => onSelectBusiness?.(business)}
                  onFavorite={() => onFavorite?.(business)}
                  isGuest={isGuest}
                  compact={viewMode === 'list'}
                />
              </StaggerItem>
            ))}
          </StaggerChildren>
        ) : (
          <FadeIn>
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No businesses found</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              <GlassButton variant="primary" onClick={clearAllFilters}>
                Clear All Filters
              </GlassButton>
            </div>
          </FadeIn>
        )}
      </div>

      {/* Mobile Filter Panel */}
      <AnimatePresence>
        {showMobileFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMobileFilters(false)}
            />

            {/* Filter Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 rounded-lg hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* Location & Radius */}
                <div>
                  <h3 className="font-medium mb-3">Location</h3>
                  <LocationAutocomplete
                    value={locationText}
                    onChange={handleLocationChange}
                    placeholder="Search location..."
                    className="mb-3"
                  />
                  <div className="flex gap-2 mb-3">
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleNearMe()}
                      disabled={isDetectingLocation}
                      leftIcon={isDetectingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    >
                      Near Me
                    </GlassButton>
                  </div>
                  {locationText && (
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Radius: {radius} km
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>5km</span>
                        <span>25km</span>
                        <span>50km</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Service Categories */}
                <div>
                  <h3 className="font-medium mb-3">Service Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {serviceCategories.map((category) => {
                      const isSelected = selectedCategories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          onClick={() => handleCategoryToggle(category.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                            'border transition-all duration-200',
                            isSelected
                              ? 'gradient-bg text-white border-transparent'
                              : 'bg-background border-border hover:border-primary/50'
                          )}
                        >
                          {category.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <h3 className="font-medium mb-3">Price Range</h3>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Min</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="number"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder="0"
                          className="w-full h-10 pl-7 pr-2 rounded-lg border border-input bg-background text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Max</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="number"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder="500+"
                          className="w-full h-10 pl-7 pr-2 rounded-lg border border-input bg-background text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeConsultation}
                      onChange={(e) => setFreeConsultation(e.target.checked)}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Free consultation only</span>
                  </label>
                </div>

                {/* Rating */}
                <div>
                  <h3 className="font-medium mb-3">Minimum Rating</h3>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setMinRating(star === minRating ? 0 : star)}
                        className="p-1"
                      >
                        <Star
                          className={cn(
                            'h-7 w-7 transition-colors',
                            star <= minRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-muted-foreground'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ratingOptions.slice(1).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setMinRating(minRating === option.value ? 0 : option.value)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm transition-colors',
                          minRating === option.value
                            ? 'gradient-bg text-white'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <h3 className="font-medium mb-3">Availability</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={availableNow}
                        onChange={(e) => setAvailableNow(e.target.checked)}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-sm font-medium">Available Now</p>
                        <p className="text-xs text-muted-foreground">Show businesses open now</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={availableToday}
                        onChange={(e) => setAvailableToday(e.target.checked)}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-sm font-medium">Available Today</p>
                        <p className="text-xs text-muted-foreground">Show businesses open today</p>
                      </div>
                    </label>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Select specific date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-background text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 flex gap-3">
                <GlassButton
                  variant="outline"
                  className="flex-1"
                  onClick={clearAllFilters}
                >
                  Clear All
                </GlassButton>
                <GlassButton
                  variant="primary"
                  className="flex-1"
                  onClick={() => setShowMobileFilters(false)}
                >
                  Show {filteredBusinesses.length} Results
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MarketplacePage;
