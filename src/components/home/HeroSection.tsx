'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Star, Clock, Shield, Users } from 'lucide-react';
import { 
  GlassButton, 
  FadeIn, 
  GradientText,
  GlassCard,
} from '@/components/ui/custom/glass-components';
import { SearchAutocomplete } from '@/components/ui/custom/SearchAutocomplete';
import { LocationAutocomplete } from '@/components/ui/custom/LocationAutocomplete';
import type { Business } from '@/types';

interface HeroSectionProps {
  onNavigate?: (page: string) => void;
  onSearch?: (query: string) => void;
  businesses?: Business[];
  onSelectBusiness?: (business: Business) => void;
  userLocation?: { lat: number; lng: number } | null;
  onLocationChange?: (location: { lat: number; lng: number } | null) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ 
  onNavigate, 
  onSearch, 
  businesses = [],
  onSelectBusiness,
  userLocation,
  onLocationChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationText, setLocationText] = useState('');
  const [localUserLocation, setLocalUserLocation] = useState<{ lat: number; lng: number } | null>(userLocation || null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Sync with parent userLocation
  useEffect(() => {
    if (userLocation) {
      setLocalUserLocation(userLocation);
    }
  }, [userLocation]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
      onNavigate?.('marketplace');
    }
  };

  const handleSelectBusiness = (business: Business) => {
    // If business is selected from autocomplete, navigate to business profile
    if (onSelectBusiness) {
      onSelectBusiness(business);
      onNavigate?.('business');
    } else {
      // Fallback: navigate to marketplace with the business name as search query
      setSearchQuery(business.name);
      onSearch?.(business.name);
      onNavigate?.('marketplace');
    }
  };

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
    onNavigate?.('marketplace');
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      // Geolocation not supported
      onNavigate?.('map');
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocalUserLocation({ lat: latitude, lng: longitude });
        onLocationChange?.({ lat: latitude, lng: longitude });
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          const displayName = data.display_name.split(',').slice(0, 2).join(', ');
          setLocationText(displayName);
        } catch (error) {
          // Reverse geocoding failed — using coordinates
          setLocationText('My Location');
        } finally {
          setIsDetectingLocation(false);
        }
        
        onNavigate?.('map');
      },
      (error) => {
        // Location detection unavailable
        setIsDetectingLocation(false);
        onNavigate?.('map');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLocationChange = (value: string, location?: { lat: number; lng: number }) => {
    setLocationText(value);
    if (location) {
      setLocalUserLocation(location);
      onLocationChange?.(location);
    }
  };

  const handleLocationSearch = (query: string, location: { lat: number; lng: number }) => {
    setSearchQuery(query);
    setLocalUserLocation(location);
    onLocationChange?.(location);
    onSearch?.(query);
    onNavigate?.('marketplace');
  };

  const stats = [
    { value: '10K+', label: 'Service Providers' },
    { value: '50K+', label: 'Happy Customers' },
    { value: '100K+', label: 'Bookings Made' },
    { value: '4.9', label: 'Average Rating' },
  ];

  const features = [
    {
      icon: MapPin,
      title: 'Find Near You',
      description: 'Discover grooming services in your area with our interactive map.',
    },
    {
      icon: Clock,
      title: 'Book Instantly',
      description: 'Real-time booking with available time slots and instant confirmation.',
    },
    {
      icon: Shield,
      title: 'Verified Professionals',
      description: 'All businesses are verified for quality and safety standards.',
    },
  ];

  return (
    <section className="relative min-h-[90vh] flex items-center hero-pattern overflow-hidden">
      {/* Background Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <FadeIn delay={0.1}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
              >
                <Star className="h-4 w-4 fill-current" />
                #1 Grooming Marketplace
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Your Style,
                <br />
                <GradientText className="text-5xl md:text-6xl lg:text-7xl">
                  On Demand.
                </GradientText>
              </h1>
            </FadeIn>

            <FadeIn delay={0.3}>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                Discover grooming services across Kenya. Book haircuts, beard trims, 
                nail services, and more with verified professionals near you.
              </p>
            </FadeIn>

            {/* Search Box */}
            <FadeIn delay={0.4}>
              <div className="glass-card p-3 mb-8 max-w-xl mx-auto lg:mx-0">
                <div className="flex flex-col gap-3">
                  {/* Search Input */}
                  <SearchAutocomplete
                    value={searchQuery}
                    onChange={(value) => setSearchQuery(value)}
                    businesses={businesses}
                    onSelectBusiness={handleSelectBusiness}
                    onSearch={handleSearchSubmit}
                    onNearMe={handleNearMe}
                    onLocationSearch={handleLocationSearch}
                    userLocation={localUserLocation}
                    placeholder="Search for services, barbers, salons..."
                    className="w-full"
                  />
                  
                  {/* Location Input */}
                  <LocationAutocomplete
                    value={locationText}
                    onChange={handleLocationChange}
                    placeholder="Search location..."
                    className="w-full"
                  />
                  
                  {/* Search Button */}
                  <GlassButton
                    variant="primary"
                    onClick={handleSearch}
                    className="w-full"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </GlassButton>
                </div>
              </div>
            </FadeIn>

            {/* Quick Actions */}
            <FadeIn delay={0.5}>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <GlassButton
                  variant="outline"
                  onClick={() => onNavigate?.('map')}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Near Me
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  onClick={() => onNavigate?.('marketplace')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Browse All
                </GlassButton>
              </div>
            </FadeIn>
          </div>

          {/* Right Content - Stats & Features */}
          <div className="space-y-6">
            {/* Stats Grid */}
            <FadeIn delay={0.3}>
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="glass-card p-4 text-center"
                  >
                    <div className="text-2xl md:text-3xl font-bold gradient-text">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </FadeIn>

            {/* Feature Cards */}
            <div className="space-y-3">
              {features.map((feature, index) => (
                <FadeIn key={feature.title} delay={0.5 + index * 0.1}>
                  <GlassCard variant="default" className="flex items-start gap-4 p-4">
                    <div className="h-12 w-12 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </GlassCard>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60L60 52C120 44 240 28 360 22C480 16 600 20 720 24C840 28 960 32 1080 36C1200 40 1320 40 1380 40L1440 40V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
