// Map utility functions for directions, sharing, and deep linking

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface DirectionsResult {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: [number, number][];
}

// Tile providers for different map themes
export const mapTileProviders = {
  standard: {
    name: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
  },
  light: {
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
};

// Get directions using OSRM (free, no API key needed)
export async function getDirections(
  origin: Location,
  destination: Location
): Promise<DirectionsResult | null> {
  try {
    // OSRM demo server - for production, use your own server or commercial routing service
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch directions');
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes?.length) {
      return null;
    }
    
    const route = data.routes[0];
    
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    };
  } catch (error) {
    console.error('Error fetching directions:', error);
    return null;
  }
}

// Format duration for display
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

// Generate shareable link for a location
export function generateShareLink(location: Location): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    lat: location.lat.toString(),
    lng: location.lng.toString(),
    name: location.name || 'Location',
    address: location.address || '',
  });
  return `${baseUrl}/map?${params.toString()}`;
}

// Generate Google Maps share link
export function generateGoogleMapsLink(location: Location): string {
  const query = encodeURIComponent(location.name || location.address || `${location.lat},${location.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// Generate Apple Maps deep link (for iOS)
export function generateAppleMapsLink(location: Location): string {
  const params = new URLSearchParams({
    ll: `${location.lat},${location.lng}`,
    q: location.name || location.address || 'Location',
  });
  return `maps://?${params.toString()}`;
}

// Generate Google Maps directions deep link (for mobile)
export function generateMobileDirectionsLink(origin: Location | null, destination: Location): string {
  const destQuery = encodeURIComponent(destination.address || `${destination.lat},${destination.lng}`);
  
  if (origin) {
    const originQuery = encodeURIComponent(origin.address || `${origin.lat},${origin.lng}`);
    return `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destQuery}&travelmode=driving`;
  }
  
  return `https://www.google.com/maps/dir/?api=1&destination=${destQuery}&travelmode=driving`;
}

// Check if running on mobile device
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check if running on iOS
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Check if running on Android
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

// Open native maps app with directions
export function openNativeMaps(origin: Location | null, destination: Location): void {
  if (isIOS()) {
    window.open(generateAppleMapsLink(destination), '_blank');
  } else {
    window.open(generateMobileDirectionsLink(origin, destination), '_blank');
  }
}

// Share location using Web Share API
export async function shareLocation(location: Location): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }
  
  try {
    await navigator.share({
      title: location.name || 'Location',
      text: location.address || `Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
      url: generateShareLink(location),
    });
    return true;
  } catch (error) {
    // User cancelled or share failed
    console.log('Share cancelled or failed:', error);
    return false;
  }
}

// Copy location to clipboard
export async function copyLocationToClipboard(location: Location): Promise<boolean> {
  const text = location.address 
    ? `${location.name || 'Location'}\n${location.address}\n${generateGoogleMapsLink(location)}`
    : `${location.name || 'Location'}: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}\n${generateGoogleMapsLink(location)}`;
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    return false;
  }
}

// Generate QR code URL for location
export function generateQRCodeUrl(location: Location, size: number = 200): string {
  const url = encodeURIComponent(generateGoogleMapsLink(location));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${url}`;
}

// Calculate estimated travel time for different modes
export function estimateTravelTime(distanceMeters: number, mode: 'driving' | 'walking' | 'cycling' | 'transit'): number {
  const speeds = {
    driving: 30 * 1000 / 3600,    // 30 km/h in m/s (average city driving)
    walking: 5 * 1000 / 3600,    // 5 km/h in m/s
    cycling: 15 * 1000 / 3600,   // 15 km/h in m/s
    transit: 20 * 1000 / 3600,   // 20 km/h in m/s (average transit)
  };
  
  return distanceMeters / speeds[mode];
}

// Get timezone for coordinates (simplified - uses offset)
export function getTimezoneOffset(lat: number, lng: number): number {
  // Simplified timezone calculation based on longitude
  // For accurate timezone, use a timezone API
  return Math.round(lng / 15);
}

// Check if location is within service radius
export function isWithinRadius(
  customerLocation: Location,
  providerLocation: Location,
  radiusKm: number
): boolean {
  const distance = calculateDistance(customerLocation, providerLocation);
  return distance <= radiusKm;
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLng = toRad(loc2.lng - loc1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Get bounds that contain all locations
export function getBoundsForLocations(locations: Location[]): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  if (locations.length === 0) {
    return { north: 90, south: -90, east: 180, west: -180 };
  }
  
  const lats = locations.map(l => l.lat);
  const lngs = locations.map(l => l.lng);
  
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}
