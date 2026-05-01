'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Search,
  X,
  Star,
  MapPin,
  List,
  Clock,
  Building2,
  Loader2,
  Crosshair,
  SlidersHorizontal,
  Heart,
  Navigation2,
  Layers,
  Columns,
  Plus,
  Minus,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import type { Business } from '@/types';

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const MarkerClusterGroup: React.ComponentType<any> = dynamic(
  () => import('react-leaflet-markercluster').then((mod) => mod.default),
  { ssr: false }
) as React.ComponentType<any>;

// Map view updater - must be used inside MapContainer, uses useMap to control view
const MapViewUpdater: React.FC<{ center: { lat: number; lng: number }; zoom: number }> = ({ center, zoom }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const useMap = require('react-leaflet').useMap;
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      map.setView([center.lat, center.lng], zoom, { animate: true, duration: 0.5 });
    }
  }, [center, zoom, map]);
  
  return null;
};

// Map themes - CARTO Voyager for Apple Maps style
const mapThemes = {
  standard: { 
    name: 'Standard', 
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', 
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: { 
    name: 'Satellite', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri'
  },
  dark: { 
    name: 'Dark', 
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', 
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
};

type MapTheme = keyof typeof mapThemes;
type ServiceLocationType = 'at_provider' | 'mobile' | 'both';

interface MapBusiness extends Business {
  serviceLocationType?: ServiceLocationType;
  startingPrice?: number;
  category?: string;
  isAvailableToday?: boolean;
  distance?: number;
}

// Geocoding result from Nominatim
interface GeocodingResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

// Search suggestion
interface SearchSuggestion {
  id: string;
  type: 'business' | 'location' | 'nearme';
  name: string;
  subtitle?: string;
  lat?: number;
  lng?: number;
  isPremium?: boolean;
  rating?: number;
  price?: number;
}

// Service type colors (Apple Maps style)
const SERVICE_COLORS: Record<ServiceLocationType, string> = {
  at_provider: '#FF3B30', // Red - At Provider
  mobile: '#007AFF',      // Blue - Mobile Service
  both: '#34C759',        // Green - Both
};

// Create Apple Maps style price tag marker
function createAppleMarkerIcon(price: number, isSelected: boolean, serviceType: ServiceLocationType) {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet');
  
  const color = SERVICE_COLORS[serviceType] || SERVICE_COLORS.at_provider;
  const scale = isSelected ? 1.15 : 1;
  
  return L.divIcon({
    className: 'apple-map-marker',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;transform:scale(${scale});transition:transform 0.2s ease;">
        <div style="background:${color};border-radius:20px;padding:6px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.25),0 0 0 2px white;font-weight:600;font-size:13px;white-space:nowrap;color:white;">$${price}</div>
        <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};filter:drop-shadow(0 1px 1px rgba(0,0,0,0.2));"></div>
      </div>
    `,
    iconSize: [50, 40],
    iconAnchor: [25, 44],
  });
}

// Create user location marker - Apple Maps/Google Maps style
// Blue dot with white border and pulsing animation
function createUserLocationIcon() {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet');
  
  return L.divIcon({
    className: 'user-location-marker', // Custom class - ensure no default Leaflet styling
    html: `
      <div class="user-location-container" style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <!-- Outer pulsing ring animation -->
        <div style="position:absolute;width:40px;height:40px;background:rgba(0,122,255,0.15);border-radius:50%;animation:userPulse 2s ease-out infinite;"></div>
        <!-- Middle ring -->
        <div style="position:absolute;width:24px;height:24px;background:rgba(0,122,255,0.25);border-radius:50%;"></div>
        <!-- Main blue dot with white border -->
        <div style="width:16px;height:16px;background:#007AFF;border-radius:50%;box-shadow:0 0 0 3px white,0 2px 6px rgba(0,0,0,0.2);position:relative;z-index:1;"></div>
      </div>
      <style>
        .user-location-marker { background: transparent !important; border: none !important; }
        @keyframes userPulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// Create cluster icon for marker clustering - blue circle with count
function createClusterIcon(cluster: { getChildCount: () => number }) {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet');
  
  const count = cluster.getChildCount();
  let size = 36;
  if (count >= 100) size = 44;
  else if (count >= 10) size = 40;
  
  return L.divIcon({
    className: 'custom-cluster-icon',
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        background:#007AFF;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:600;
        font-size:${count >= 100 ? '11px' : '13px'};
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        box-shadow:0 2px 6px rgba(0,122,255,0.35),0 0 0 2px white;
      ">
        ${count}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Business detail panel - bottom sheet style with glass morphism
const BusinessDetailPanel: React.FC<{
  business: MapBusiness;
  onClose: () => void;
  onBook: () => void;
  onViewDetails: () => void;
}> = ({ business, onClose, onBook, onViewDetails }) => {
  const price = business.startingPrice || business.services?.[0]?.price || 0;
  const serviceType = business.serviceLocationType || 'at_provider';
  const serviceColor = SERVICE_COLORS[serviceType];
  
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      className="absolute bottom-0 left-0 right-0 z-[1000] backdrop-blur-2xl bg-white/70 border-t border-white/30 shadow-2xl shadow-black/10 rounded-t-3xl max-h-[60vh] overflow-hidden"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1.5 bg-gray-300/60 rounded-full" />
      </div>
      
      <div className="px-5 pb-6 overflow-y-auto max-h-[calc(60vh-40px)]">
        {/* Business info */}
        <div className="flex gap-4 mb-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm">
            {business.logo ? (
              <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-gray-500 dark:text-slate-300 text-xl font-semibold">
                {business.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{business.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${serviceColor}20`, color: serviceColor }}
                  >
                    {serviceType === 'at_provider' ? 'At Location' : serviceType === 'mobile' ? 'Mobile' : 'Both'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{business.category || 'Grooming'}</span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors">
                <X className="h-5 w-5 text-gray-400 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-semibold">{business.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">({business.reviewCount})</span>
              </div>
              {business.distance && (
                <>
                  <span className="text-gray-300 dark:text-slate-600">•</span>
                  <span className="text-sm text-gray-600 dark:text-slate-300">{(business.distance / 1000).toFixed(1)} km away</span>
                </>
              )}
              <span className="text-gray-300 dark:text-slate-600">•</span>
              <span className="text-sm font-semibold" style={{ color: serviceColor }}>${price}</span>
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 py-3 border-t border-white/10">
          <button 
            onClick={onBook} 
            className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl font-semibold text-sm hover:bg-[#0066DD] transition-colors shadow-lg shadow-[#007AFF]/20"
          >
            Book Now
          </button>
          <button 
            onClick={() => business.latitude && business.longitude && window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`, 
              '_blank'
            )} 
            className="flex-1 flex items-center justify-center gap-2 py-3 backdrop-blur-2xl bg-white/50 dark:bg-slate-700/50 text-gray-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-white/70 dark:hover:bg-slate-600/70 transition-colors border border-white/30 dark:border-slate-600/30"
          >
            <Navigation2 className="h-4 w-4" /> Directions
          </button>
          <button className="w-12 h-12 flex items-center justify-center backdrop-blur-2xl bg-white/50 dark:bg-slate-700/50 rounded-xl hover:bg-white/70 dark:hover:bg-slate-600/70 transition-colors border border-white/30 dark:border-slate-600/30">
            <Heart className="h-5 w-5 text-gray-600 dark:text-slate-300" />
          </button>
        </div>
        
        {/* View details link */}
        <button 
          onClick={onViewDetails} 
          className="w-full mt-2 py-2.5 text-center text-[#007AFF] font-medium text-sm hover:bg-blue-50/50 rounded-lg transition-colors"
        >
          View Full Details
        </button>
      </div>
    </motion.div>
  );
};

// Main MapPage component
interface MapPageProps {
  businesses: MapBusiness[];
  onSelectBusiness?: (business: MapBusiness) => void;
  onBookBusiness?: (business: MapBusiness) => void;
}

export const MapPage: React.FC<MapPageProps> = ({ businesses, onSelectBusiness, onBookBusiness }) => {
  const { resolvedTheme } = useTheme();
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<MapBusiness | null>(null);
  const [hoveredBusinessId, setHoveredBusinessId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [manualMapTheme, setManualMapTheme] = useState<MapTheme | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('map');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Filters state
  const [filters, setFilters] = useState({
    rating: 0,
    serviceType: 'all' as 'all' | 'at_provider' | 'mobile',
    distanceRadius: 50,
    availableToday: false,
  });

  // Map center and zoom - Default to Nairobi, Kenya (Styra HQ)
  // Will be updated to user location when permission is granted
  const [center, setCenter] = useState({ lat: -1.2921, lng: 36.8219 }); // Nairobi, Kenya
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [zoom, setZoom] = useState(12); // City level zoom

  // Mount effect - also auto-detect location with permission request
  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsMounted(true));
    
    // Request location permission on mount - this triggers browser permission popup
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setCenter({ lat: latitude, lng: longitude });
          setZoom(15); // Street level zoom
          setIsLocating(false);
          // Store permission granted state
          sessionStorage.setItem('styra-location-permission', 'granted');
        },
        (error) => {
          setIsLocating(false);
          // Log for debugging but don't show error - user can manually trigger
          // Auto-location detection failed
          // If permission denied, store that info
          if (error.code === error.PERMISSION_DENIED) {
            sessionStorage.setItem('styra-location-permission', 'denied');
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000,
          maximumAge: 0 // Always get fresh position
        }
      );
    }
    
    return () => cancelAnimationFrame(timer);
  }, []);

  // Map theme follows the app theme — use next-themes resolvedTheme for reliable detection
  // User can manually override (e.g., satellite), otherwise auto-follows light=standard, dark=dark
  const isDarkMode = resolvedTheme === 'dark';
  const mapTheme: MapTheme = manualMapTheme ?? (isDarkMode ? 'dark' : 'standard');

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search locations worldwide using Nominatim
  const searchLocations = useCallback(async (query: string) => {
    const nearMeSuggestion: SearchSuggestion = {
      id: 'nearme',
      type: 'nearme',
      name: 'Near Me',
      subtitle: userLocation ? 'Search near your current location' : 'Enable location to search nearby',
      lat: userLocation?.lat,
      lng: userLocation?.lng,
    };
    
    if (query.length < 2) {
      // Show "Near Me" option and premium listings when search is empty
      const premium = businesses
        .filter(b => b.subscriptionPlan === 'FEATURED')
        .slice(0, 5)
        .map(b => ({
          id: `business-${b.id}`,
          type: 'business' as const,
          name: b.name,
          subtitle: `${b.city || ''} • ${b.category || 'Grooming'}`,
          lat: b.latitude,
          lng: b.longitude,
          isPremium: true,
          rating: b.rating,
          price: b.startingPrice || b.services?.[0]?.price,
        }));
      setSearchSuggestions([nearMeSuggestion, ...premium]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Nominatim geocoding API - no bounds restriction for worldwide search
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const data: GeocodingResult[] = await res.json();
      
      // Also search matching businesses
      const matchingBusinesses = businesses
        .filter(b =>
          b.name.toLowerCase().includes(query.toLowerCase()) ||
          b.city?.toLowerCase().includes(query.toLowerCase()) ||
          b.category?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5);
      
      // Add "Near Me" option if query contains 'near' or 'me'
      const showNearMe = query.toLowerCase().includes('near') || query.toLowerCase().includes('me');
      
      setSearchSuggestions([
        ...(showNearMe ? [nearMeSuggestion] : []),
        ...matchingBusinesses.map(b => ({
          id: `business-${b.id}`,
          type: 'business' as const,
          name: b.name,
          subtitle: `${b.city || ''} • $${b.startingPrice || b.services?.[0]?.price || 0}`,
          lat: b.latitude,
          lng: b.longitude,
          isPremium: b.subscriptionPlan === 'FEATURED',
          rating: b.rating,
          price: b.startingPrice || b.services?.[0]?.price,
        })),
        ...data.map(l => ({
          id: `location-${l.place_id}`,
          type: 'location' as const,
          name: l.display_name.split(',')[0],
          subtitle: l.display_name.split(',').slice(1, 3).join(','),
          lat: parseFloat(l.lat),
          lng: parseFloat(l.lon),
        })),
      ]);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  }, [businesses, userLocation]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => searchLocations(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchLocations]);

  // Handle Near Me button - get user's location
  // Fails silently - user can manually search for location
  const handleNearMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Silently fail - user can type location manually
      // Geolocation not supported
      return;
    }
    
    setIsLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setCenter({ lat: latitude, lng: longitude });
        setZoom(15); // Street level zoom (14-16 range)
        setIsLocating(false);
        // Store permission granted state
        sessionStorage.setItem('styra-location-permission', 'granted');
      },
      (error) => {
        setIsLocating(false);
        // Silently fail - log to console, don't show error
        // Location detection unavailable
        // If permission denied, store that info
        if (error.code === error.PERMISSION_DENIED) {
          sessionStorage.setItem('styra-location-permission', 'denied');
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 0 
      }
    );
  }, []);

  // Handle search suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.name);
    setShowSearchResults(false);
    
    // Handle "Near me" selection
    if (suggestion.type === 'nearme') {
      handleNearMe();
      return;
    }
    
    if (suggestion.lat && suggestion.lng) {
      setCenter({ lat: suggestion.lat, lng: suggestion.lng });
      setZoom(suggestion.type === 'business' ? 16 : 12);
      
      if (suggestion.type === 'business') {
        const business = businesses.find(b => `business-${b.id}` === suggestion.id);
        if (business) {
          setSelectedBusiness(business);
        }
      }
    }
  }, [businesses, handleNearMe]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Filter businesses based on current filters
  const filteredBusinesses = useMemo(() => {
    return businesses
      .filter(b => {
        // Rating filter
        const matchesRating = b.rating >= filters.rating;
        
        // Service type filter
        const serviceType = b.serviceLocationType || 'at_provider';
        const matchesServiceType = 
          filters.serviceType === 'all' || 
          serviceType === filters.serviceType || 
          serviceType === 'both';
        
        // Available today filter
        const matchesAvailability = !filters.availableToday || b.isAvailableToday;
        
        // Distance filter (only if user location is available)
        let matchesDistance = true;
        if (userLocation && b.latitude && b.longitude) {
          const dist = calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
          matchesDistance = dist <= filters.distanceRadius * 1000;
        }
        
        return matchesRating && matchesServiceType && matchesAvailability && matchesDistance;
      })
      .map(b => {
        // Add distance if user location is available
        if (userLocation && b.latitude && b.longitude) {
          return { 
            ...b, 
            distance: calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude) 
          };
        }
        return b;
      })
      .sort((a, b) => {
        // Sort by distance if available, otherwise by rating
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        return b.rating - a.rating;
      });
  }, [businesses, filters, userLocation, calculateDistance]);

  const distanceOptions = [5, 10, 25, 50, 100];

  return (
    <div className="h-[calc(100vh-64px)] relative bg-gray-100 dark:bg-slate-900">
      {/* Search Bar Container - Centered at top with glass morphism */}
      <div className="absolute top-4 left-4 right-4 z-[60]" ref={searchRef}>
        <div className="max-w-lg mx-auto">
          {/* Search Input - Liquid Glass morphism */}
          <div className="backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 rounded-2xl shadow-2xl shadow-black/5 border border-white/30 dark:border-slate-700/50 overflow-hidden">
            <div className="flex items-center px-4 py-3">
              <Search className="h-5 w-5 text-gray-400 dark:text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search anywhere worldwide..."
                value={searchQuery}
                onChange={(e) => { 
                  setSearchQuery(e.target.value); 
                  setShowSearchResults(true); 
                }}
                onFocus={() => { 
                  setShowSearchResults(true); 
                  searchLocations(searchQuery); 
                }}
                className="flex-1 px-3 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm bg-transparent"
              />
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-slate-400 mr-2" />}
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="p-1.5 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400 dark:text-slate-400" />
                </button>
              )}
            </div>
            
            {/* Autocomplete Dropdown */}
            <AnimatePresence>
              {showSearchResults && searchSuggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-white/10 dark:border-slate-700/50 max-h-64 overflow-y-auto"
                >
                  {searchSuggestions.map(suggestion => (
                    <button 
                      key={suggestion.id} 
                      onClick={() => handleSelectSuggestion(suggestion)} 
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/50 dark:hover:bg-slate-700/50 text-left transition-colors"
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                        suggestion.type === 'nearme' 
                          ? "bg-blue-100/80 dark:bg-blue-900/50" 
                          : suggestion.type === 'business' 
                            ? suggestion.isPremium ? "bg-amber-100/80 dark:bg-amber-900/50" : "bg-gray-100/80 dark:bg-slate-700/50" 
                            : "bg-emerald-50/80 dark:bg-emerald-900/50"
                      )}>
                        {suggestion.type === 'nearme' ? (
                          <Crosshair className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : suggestion.type === 'business' ? (
                          <Building2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                        ) : (
                          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{suggestion.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{suggestion.subtitle}</p>
                      </div>
                      {suggestion.type === 'nearme' && (
                        <span className="text-xs bg-blue-100/80 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Near Me
                        </span>
                      )}
                      {suggestion.isPremium && suggestion.type !== 'nearme' && (
                        <span className="text-xs bg-amber-100/80 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Premium
                        </span>
                      )}
                      {suggestion.rating && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <span>{suggestion.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Quick Filter Chips - Liquid Glass morphism */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {/* Near Me Button */}
            <button 
              onClick={handleNearMe} 
              disabled={isLocating} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all shadow-lg shadow-black/5 border",
                userLocation 
                  ? "bg-[#007AFF] text-white border-[#0066DD] shadow-[#007AFF]/20" 
                  : "backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 text-gray-700 dark:text-slate-200 border-white/30 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-700/80"
              )}
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
              <span>My Location</span>
            </button>
            
            {/* Filters Button */}
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all shadow-lg shadow-black/5 border",
                showFilters || filters.rating > 0 || filters.serviceType !== 'all' 
                  ? "bg-[#007AFF] text-white border-[#0066DD] shadow-[#007AFF]/20" 
                  : "backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 text-gray-700 dark:text-slate-200 border-white/30 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-700/80"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {(filters.rating > 0 || filters.serviceType !== 'all' || filters.availableToday) && (
                <span className="w-2 h-2 bg-white rounded-full" />
              )}
            </button>
            
            {/* View Toggle */}
            <button 
              onClick={() => {
                if (viewMode === 'map') setViewMode('split');
                else if (viewMode === 'split') setViewMode('list');
                else setViewMode('map');
              }} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all shadow-lg shadow-black/5 border",
                viewMode !== 'map' 
                  ? "bg-[#007AFF] text-white border-[#0066DD] shadow-[#007AFF]/20" 
                  : "backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 text-gray-700 dark:text-slate-200 border-white/30 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-700/80"
              )}
            >
              {viewMode === 'split' ? (
                <Columns className="h-4 w-4" />
              ) : viewMode === 'list' ? (
                <MapPin className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
              <span>{viewMode === 'map' ? 'List' : viewMode === 'list' ? 'Map' : 'Split'}</span>
            </button>
          </div>
          
          {/* Filters Panel - Liquid Glass morphism */}
          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 rounded-2xl shadow-2xl shadow-black/5 border border-white/30 dark:border-slate-700/50 p-4 mt-2 z-[1001]"
              >
                <div className="grid grid-cols-2 gap-4">
                  {/* Rating Filter */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Rating</label>
                    <select 
                      value={filters.rating} 
                      onChange={e => setFilters(f => ({ ...f, rating: parseFloat(e.target.value) }))} 
                      className="w-full h-10 px-3 rounded-xl border border-gray-200/50 dark:border-slate-600/50 bg-white/80 dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                    >
                      <option value={0}>Any Rating</option>
                      <option value={3.5}>3.5+ Stars</option>
                      <option value={4}>4+ Stars</option>
                      <option value={4.5}>4.5+ Stars</option>
                    </select>
                  </div>
                  
                  {/* Service Type Filter */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Service Type</label>
                    <select 
                      value={filters.serviceType} 
                      onChange={e => setFilters(f => ({ ...f, serviceType: e.target.value as typeof filters.serviceType }))} 
                      className="w-full h-10 px-3 rounded-xl border border-gray-200/50 dark:border-slate-600/50 bg-white/80 dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                    >
                      <option value="all">All Types</option>
                      <option value="at_provider">At Location</option>
                      <option value="mobile">Mobile Service</option>
                    </select>
                  </div>
                  
                  {/* Distance Radius Filter */}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">
                      Distance Radius: {filters.distanceRadius} km
                    </label>
                    <div className="flex gap-2">
                      {distanceOptions.map(d => (
                        <button 
                          key={d} 
                          onClick={() => setFilters(f => ({ ...f, distanceRadius: d }))} 
                          className={cn(
                            "flex-1 h-10 rounded-xl text-sm font-medium transition-all",
                            filters.distanceRadius === d 
                              ? "bg-[#007AFF] text-white" 
                              : "bg-white/60 dark:bg-slate-700/60 text-gray-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-600/80 border border-gray-200/50 dark:border-slate-600/50"
                          )}
                        >
                          {d}km
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Available Today Toggle */}
                  <div className="col-span-2">
                    <button 
                      onClick={() => setFilters(f => ({ ...f, availableToday: !f.availableToday }))} 
                      className={cn(
                        "w-full h-10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                        filters.availableToday 
                          ? "bg-green-500 text-white" 
                          : "bg-white/60 dark:bg-slate-700/60 text-gray-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-600/80 border border-gray-200/50 dark:border-slate-600/50"
                      )}
                    >
                      <Clock className="h-4 w-4" />
                      Available Today
                    </button>
                  </div>
                </div>
                
                {/* Filter Actions */}
                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-white/10 dark:border-slate-700/50">
                  <button 
                    onClick={() => setFilters({ 
                      rating: 0, 
                      serviceType: 'all', 
                      distanceRadius: 50, 
                      availableToday: false 
                    })} 
                    className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-medium"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={() => setShowFilters(false)} 
                    className="px-4 py-2 bg-[#007AFF] text-white rounded-xl text-sm font-medium hover:bg-[#0066DD] transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area - Map and/or List */}
      <div className={cn("h-full flex", viewMode === 'split' && 'gap-0.5')}>
        {/* Map Container */}
        <div className={cn(
          "h-full transition-all duration-300",
          viewMode === 'list' ? 'w-0 overflow-hidden' : viewMode === 'split' ? 'w-1/2' : 'w-full'
        )}>
          {isMounted && (
            <MapContainer 
              center={[center.lat, center.lng]} 
              zoom={zoom} 
              style={{ height: '100%', width: '100%' }} 
              zoomControl={false}
            >
              <TileLayer 
                key={mapTheme}
                url={mapThemes[mapTheme].url} 
                subdomains={(mapThemes[mapTheme] as { subdomains?: string[] }).subdomains || []}
                attribution={mapThemes[mapTheme].attribution}
              />
              <MapViewUpdater center={center} zoom={zoom} />
              
              {/* User Location Marker - Single marker only */}
              {userLocation && (
                <Marker 
                  key="user-location-marker"
                  position={[userLocation.lat, userLocation.lng]} 
                  icon={createUserLocationIcon()} 
                />
              )}
              
              {/* Business Markers with Clustering */}
              <MarkerClusterGroup
                iconCreateFunction={createClusterIcon}
                maxClusterRadius={50}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
                zoomToBoundsOnClick={true}
              >
                {filteredBusinesses.map(business => 
                  business.latitude && business.longitude && (
                    <Marker
                      key={business.id}
                      position={[business.latitude, business.longitude]}
                      icon={createAppleMarkerIcon(
                        business.startingPrice || business.services?.[0]?.price || 0,
                        selectedBusiness?.id === business.id || hoveredBusinessId === business.id,
                        business.serviceLocationType || 'at_provider'
                      )}
                      eventHandlers={{ 
                        click: () => setSelectedBusiness(business) 
                      }}
                    />
                  )
                )}
              </MarkerClusterGroup>
            </MapContainer>
          )}
          
          {/* Floating Map Controls */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[999] flex flex-col gap-2">
            {/* Zoom Controls */}
            <div className="backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 rounded-2xl shadow-2xl shadow-black/5 border border-white/30 dark:border-slate-700/50 overflow-hidden">
              <button 
                onClick={() => setZoom(z => Math.min(z + 1, 18))}
                className="w-11 h-11 flex items-center justify-center text-gray-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
                title="Zoom In"
              >
                <Plus className="h-5 w-5" />
              </button>
              <div className="h-px bg-white/20 dark:bg-slate-700/50" />
              <button 
                onClick={() => setZoom(z => Math.max(z - 1, 1))}
                className="w-11 h-11 flex items-center justify-center text-gray-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
                title="Zoom Out"
              >
                <Minus className="h-5 w-5" />
              </button>
            </div>
            
            {/* Theme Toggle */}
            <div className="backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 rounded-2xl shadow-2xl shadow-black/5 border border-white/30 dark:border-slate-700/50 overflow-hidden">
              <button 
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className={cn(
                  "w-11 h-11 flex items-center justify-center transition-colors",
                  showThemeMenu ? "bg-[#007AFF] text-white" : "text-gray-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                )}
                title="Map Style"
              >
                <Layers className="h-5 w-5" />
              </button>
              
              <AnimatePresence>
                {showThemeMenu && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/20 dark:border-slate-700/50"
                  >
                    {(Object.keys(mapThemes) as MapTheme[]).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          setManualMapTheme(theme);
                          setShowThemeMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-xs font-medium text-left transition-colors",
                          mapTheme === theme 
                            ? "bg-[#007AFF] text-white" 
                            : "text-gray-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                        )}
                      >
                        {mapThemes[theme].name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Recenter on User Location */}
            {userLocation && (
              <button 
                onClick={() => {
                  setCenter(userLocation);
                  setZoom(15);
                }}
                className="w-11 h-11 backdrop-blur-2xl bg-white/70 dark:bg-slate-800/80 rounded-2xl shadow-2xl shadow-black/5 border border-white/30 dark:border-slate-700/50 flex items-center justify-center text-[#007AFF] hover:bg-white/80 dark:hover:bg-slate-700/80 transition-colors"
                title="Recenter on My Location"
              >
                <Crosshair className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        
        {/* List View */}
        <div className={cn(
          "h-full backdrop-blur-2xl bg-white/70 dark:bg-slate-800/90 overflow-y-auto transition-all duration-300",
          viewMode === 'map' ? 'w-0 overflow-hidden' : viewMode === 'split' ? 'w-1/2' : 'w-full'
        )}>
          {/* List Header */}
          <div className="p-4 border-b border-white/10 dark:border-slate-700/50 sticky top-0 backdrop-blur-2xl bg-white/70 dark:bg-slate-800/90 z-10 shadow-sm">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{filteredBusinesses.length} Providers Found</h3>
            {userLocation && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Sorted by distance from your location</p>
            )}
          </div>
          
          {/* Provider List */}
          {filteredBusinesses.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
              <p>No providers found matching your criteria</p>
            </div>
          ) : (
            filteredBusinesses.map(business => (
              <div
                key={business.id}
                onClick={() => { 
                  setSelectedBusiness(business); 
                  if (business.latitude && business.longitude) { 
                    setCenter({ lat: business.latitude, lng: business.longitude }); 
                    setZoom(16); 
                  }
                }}
                onMouseEnter={() => setHoveredBusinessId(business.id)}
                onMouseLeave={() => setHoveredBusinessId(null)}
                className={cn(
                  "p-4 border-b border-white/10 dark:border-slate-700/50 cursor-pointer transition-colors hover:bg-white/40 dark:hover:bg-slate-700/40",
                  selectedBusiness?.id === business.id && "bg-blue-50/50 dark:bg-blue-900/30"
                )}
              >
                <div className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 flex-shrink-0">
                    {business.logo ? (
                      <img src={business.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-gray-500 dark:text-slate-300 font-semibold">
                        {business.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{business.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm">{business.rating.toFixed(1)}</span>
                      {business.distance && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-sm text-gray-500">{(business.distance / 1000).toFixed(1)} km</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${SERVICE_COLORS[business.serviceLocationType || 'at_provider']}20`,
                          color: SERVICE_COLORS[business.serviceLocationType || 'at_provider']
                        }}
                      >
                        {business.serviceLocationType === 'mobile' ? 'Mobile' : 
                         business.serviceLocationType === 'both' ? 'Both' : 'At Location'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-lg">
                      ${business.startingPrice || business.services?.[0]?.price || 0}
                    </span>
                    <p className="text-xs text-gray-500">starting</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Results Count Badge - Liquid Glass morphism */}
      <div className="absolute left-4 bottom-4 z-[999]">
        <div className="backdrop-blur-2xl bg-white/70 px-5 py-3 rounded-xl shadow-lg shadow-black/5 border border-white/30">
          <span className="font-semibold text-gray-900">{filteredBusinesses.length}</span>
          <span className="text-gray-500 ml-1">providers</span>
          {userLocation && (
            <span className="text-[#007AFF] ml-2 text-sm font-medium">near you</span>
          )}
        </div>
      </div>

      {/* Business Detail Panel */}
      <AnimatePresence>
        {selectedBusiness && (
          <BusinessDetailPanel
            business={selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
            onBook={() => { 
              onBookBusiness?.(selectedBusiness); 
              setSelectedBusiness(null); 
            }}
            onViewDetails={() => { 
              onSelectBusiness?.(selectedBusiness); 
              setSelectedBusiness(null); 
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapPage;
