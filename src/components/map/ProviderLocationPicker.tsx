'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Search,
  Navigation,
  Check,
  AlertCircle,
  Building2,
  Truck,
  Home,
  Loader2,
  Info,
  Crosshair,
  ChevronRight,
  X,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';

// Dynamically import map components
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
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

// Map click handler component - uses useMapEvents to capture clicks on the map
const MapClickHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const useMapEvents = require('react-leaflet').useMapEvents;
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Types
export interface LocationData {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  serviceRadius: number;
  serviceLocationType: 'at_provider' | 'mobile' | 'both';
}

interface ProviderLocationPickerProps {
  initialLocation?: Partial<LocationData>;
  onLocationChange: (location: LocationData) => void;
  onNext?: () => void;
  onBack?: () => void;
}

// Sample locations for autocomplete
const sampleAddresses = [
  { address: '123 Main St, New York, NY 10001', lat: 40.7128, lng: -74.006 },
  { address: '456 Oak Ave, Los Angeles, CA 90001', lat: 34.0522, lng: -118.2437 },
  { address: '789 Pine Rd, Chicago, IL 60601', lat: 41.8781, lng: -87.6298 },
  { address: '321 Elm St, Houston, TX 77001', lat: 29.7604, lng: -95.3698 },
  { address: '555 Market St, San Francisco, CA 94102', lat: 37.7749, lng: -122.4194 },
];

export const ProviderLocationPicker: React.FC<ProviderLocationPickerProps> = ({
  initialLocation,
  onLocationChange,
  onNext,
  onBack,
}) => {
  const [isClient, setIsClient] = useState(false);
  const [step, setStep] = useState<'search' | 'pin' | 'settings'>('search');
  
  // Location state
  const [searchQuery, setSearchQuery] = useState(initialLocation?.address || '');
  const [suggestions, setSuggestions] = useState<typeof sampleAddresses>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  // Pin location
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number } | null>(
    initialLocation?.latitude && initialLocation?.longitude
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : null
  );
  const [isDragging, setIsDragging] = useState(false);
  
  // Settings
  const [serviceRadius, setServiceRadius] = useState(initialLocation?.serviceRadius || 10);
  const [serviceLocationType, setServiceLocationType] = useState<'at_provider' | 'mobile' | 'both'>(
    initialLocation?.serviceLocationType || 'at_provider'
  );
  
  // Validation
  const [error, setError] = useState<string | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);

  // Client-side only rendering
  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsClient(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setError(null);
    setShowSuggestions(true);

    if (query.length > 2) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const filtered = sampleAddresses.filter(addr =>
          addr.address.toLowerCase().includes(query.toLowerCase())
        );
        setSuggestions(filtered);
        setIsLoading(false);
      }, 300);
    } else {
      setSuggestions([]);
    }
  };

  // Handle address selection
  const handleSelectAddress = (suggestion: typeof sampleAddresses[0]) => {
    setSearchQuery(suggestion.address);
    setPinPosition({ lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setSuggestions([]);
    setStep('pin');
  };

  // Handle "Use My Location"
  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    
    setIsLocating(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setPinPosition(loc);
        setSearchQuery('Current Location');
        setIsLocating(false);
        setStep('pin');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Unable to get your location. Please enter your address manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle map click to set pin
  const handleMapClick = (e: { lat: number; lng: number }) => {
    setPinPosition(e);
    setError(null);
  };

  // Handle continue to settings
  const handleContinueToSettings = () => {
    if (!pinPosition) {
      setError('Please select a location on the map');
      return;
    }
    setStep('settings');
  };

  // Handle final save
  const handleSaveLocation = () => {
    if (!pinPosition) {
      setError('Please set your business location');
      return;
    }

    const locationData: LocationData = {
      address: searchQuery,
      city: extractCity(searchQuery),
      state: extractState(searchQuery),
      country: 'USA',
      postalCode: extractPostalCode(searchQuery),
      latitude: pinPosition.lat,
      longitude: pinPosition.lng,
      serviceRadius,
      serviceLocationType,
    };

    onLocationChange(locationData);
    onNext?.();
  };

  // Helper functions to extract address components
  const extractCity = (address: string): string => {
    const match = address.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
    return match ? match[1].trim() : '';
  };

  const extractState = (address: string): string => {
    const match = address.match(/,\s*([A-Z]{2})\s*\d*/);
    return match ? match[1] : '';
  };

  const extractPostalCode = (address: string): string => {
    const match = address.match(/\d{5}(-\d{4})?/);
    return match ? match[0] : '';
  };

  // Create draggable marker icon
  const getDraggableIcon = () => {
    if (typeof window === 'undefined') return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet');
    return L.divIcon({
      className: 'draggable-marker',
      html: `
        <div class="relative cursor-grab active:cursor-grabbing">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#6C4EFF] to-[#3ABEFF] flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-white">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-primary"></div>
          <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
            <svg class="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [48, 54],
      iconAnchor: [24, 54],
    });
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              <span className="gradient-text">Set Your Location</span>
            </h1>
            <p className="text-muted-foreground">
              Help customers find your business. Pin your exact location on the map.
            </p>
          </div>
        </FadeIn>

        {/* Progress Steps */}
        <FadeIn delay={0.1}>
          <div className="flex items-center justify-center gap-4 mb-8">
            {['search', 'pin', 'settings'].map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full transition-colors',
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : index < ['search', 'pin', 'settings'].indexOf(step)
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  {index < ['search', 'pin', 'settings'].indexOf(step) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center text-sm font-medium">{index + 1}</span>
                  )}
                  <span className="text-sm font-medium capitalize">{s === 'pin' ? 'Pin Location' : s}</span>
                </div>
                {index < 2 && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        </FadeIn>

        {/* Step 1: Search */}
        <AnimatePresence mode="wait">
          {step === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <GlassCard variant="elevated" className="p-6">
                <div className="max-w-xl mx-auto">
                  <div ref={searchRef} className="relative mb-6">
                    <label className="text-sm font-medium mb-2 block">Business Address</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <GlassInput
                          placeholder="Enter your business address..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          leftIcon={<MapPin className="h-4 w-4" />}
                          rightIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                        />
                        
                        {/* Autocomplete suggestions */}
                        <AnimatePresence>
                          {showSuggestions && suggestions.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl overflow-hidden z-50 shadow-xl"
                            >
                              {suggestions.map((suggestion, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleSelectAddress(suggestion)}
                                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0"
                                >
                                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                  <span className="text-sm">{suggestion.address}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">OR</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="text-center">
                    <GlassButton
                      variant="default"
                      onClick={handleUseMyLocation}
                      disabled={isLocating}
                      leftIcon={isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    >
                      Use My Current Location
                    </GlassButton>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Step 2: Pin Location */}
          {step === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <GlassCard variant="elevated" className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Pin Your Exact Location</h3>
                      <p className="text-sm text-muted-foreground">
                        Drag the marker to your exact business location
                      </p>
                    </div>
                    <GlassButton
                      variant="default"
                      size="sm"
                      onClick={() => setStep('search')}
                    >
                      Change Address
                    </GlassButton>
                  </div>
                </div>

                <div className="relative h-[400px] rounded-xl overflow-hidden border border-border/50">
                  {isClient && pinPosition && (
                    <MapContainer
                      center={[pinPosition.lat, pinPosition.lng]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                      />
                      <MapClickHandler onMapClick={(lat, lng) => handleMapClick({ lat, lng })} />
                      <Marker
                        position={[pinPosition.lat, pinPosition.lng]}
                        icon={getDraggableIcon()}
                        draggable={true}
                        eventHandlers={{
                          dragstart: () => setIsDragging(true),
                          dragend: (e: any) => {
                            const marker = e.target;
                            const position = marker.getLatLng();
                            setPinPosition({ lat: position.lat, lng: position.lng });
                            setIsDragging(false);
                          },
                        }}
                      />
                    </MapContainer>
                  )}

                  {/* Crosshair overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className={cn(
                      'transition-opacity',
                      isDragging ? 'opacity-100' : 'opacity-0'
                    )}>
                      <Crosshair className="h-8 w-8 text-primary" />
                    </div>
                  </div>

                  {/* Instructions overlay */}
                  <div className="absolute top-4 left-4 right-4 z-[1000]">
                    <div className="glass px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      <span>Click on the map or drag the pin to adjust position</span>
                    </div>
                  </div>

                  {/* Coordinates display */}
                  {pinPosition && (
                    <div className="absolute bottom-4 left-4 right-4 z-[1000]">
                      <div className="glass px-4 py-2 rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">Lat:</span>
                            <span className="font-mono">{pinPosition.lat.toFixed(6)}</span>
                            <span className="text-muted-foreground">Lng:</span>
                            <span className="font-mono">{pinPosition.lng.toFixed(6)}</span>
                          </div>
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="h-4 w-4" />
                            Location set
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-between">
                  <GlassButton variant="ghost" onClick={() => setStep('search')}>
                    Back
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={handleContinueToSettings}
                    disabled={!pinPosition}
                  >
                    Continue to Settings
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Step 3: Settings */}
          {step === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <GlassCard variant="elevated" className="p-6">
                <div className="max-w-xl mx-auto">
                  {/* Service Location Type */}
                  <div className="mb-8">
                    <label className="text-sm font-medium mb-3 block">How do you provide services?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: 'at_provider', label: 'At My Location', icon: Building2, desc: 'Clients come to you' },
                        { value: 'mobile', label: 'Mobile Service', icon: Truck, desc: 'You go to clients' },
                        { value: 'both', label: 'Both Options', icon: Home, desc: 'Flexible service' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setServiceLocationType(option.value as any)}
                          className={cn(
                            'p-4 rounded-xl border-2 transition-all text-left',
                            serviceLocationType === option.value
                              ? 'border-primary bg-primary/10'
                              : 'border-border/50 hover:border-primary/50'
                          )}
                        >
                          <option.icon className={cn(
                            'h-6 w-6 mb-2',
                            serviceLocationType === option.value ? 'text-primary' : 'text-muted-foreground'
                          )} />
                          <p className="font-medium text-sm">{option.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service Radius */}
                  {(serviceLocationType === 'mobile' || serviceLocationType === 'both') && (
                    <div className="mb-8">
                      <label className="text-sm font-medium mb-3 block">
                        Service Radius: {serviceRadius} km
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        How far are you willing to travel for mobile services?
                      </p>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={serviceRadius}
                        onChange={(e) => setServiceRadius(parseInt(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1 km</span>
                        <span>25 km</span>
                        <span>50 km</span>
                      </div>

                      {/* Radius preview on mini map */}
                      {pinPosition && isClient && (
                        <div className="mt-4 h-[200px] rounded-xl overflow-hidden border border-border/50">
                          <MapContainer
                            center={[pinPosition.lat, pinPosition.lng]}
                            zoom={10}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                          >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker
                              position={[pinPosition.lat, pinPosition.lng]}
                              icon={getDraggableIcon()}
                            />
                            <Circle
                              center={[pinPosition.lat, pinPosition.lng]}
                              radius={serviceRadius * 1000}
                              pathOptions={{
                                color: '#6C4EFF',
                                fillColor: '#6C4EFF',
                                fillOpacity: 0.15,
                              }}
                            />
                          </MapContainer>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location Summary */}
                  <div className="p-4 rounded-xl bg-muted/50 mb-6">
                    <h4 className="font-medium mb-3">Location Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{searchQuery}</span>
                      </div>
                      {pinPosition && (
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Location pinned: {pinPosition.lat.toFixed(4)}, {pinPosition.lng.toFixed(4)}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        {serviceLocationType === 'at_provider' ? <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" /> :
                         serviceLocationType === 'mobile' ? <Truck className="h-4 w-4 text-muted-foreground mt-0.5" /> :
                         <Home className="h-4 w-4 text-muted-foreground mt-0.5" />}
                        <span>
                          {serviceLocationType === 'at_provider' ? 'Services at your location' :
                           serviceLocationType === 'mobile' ? `Mobile service within ${serviceRadius}km radius` :
                           `Both options available, mobile within ${serviceRadius}km`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <GlassButton variant="ghost" onClick={() => setStep('pin')}>
                      Back
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      onClick={handleSaveLocation}
                    >
                      Save Location
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProviderLocationPicker;
