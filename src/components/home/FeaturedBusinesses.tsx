'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star, MapPin, Clock, Heart, ChevronRight } from 'lucide-react';
import { 
  GlassCard, 
  GlassBadge, 
  FadeIn,
  StaggerChildren,
  StaggerItem,
  Skeleton,
} from '@/components/ui/custom/glass-components';
import { useAuthStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Business } from '@/types';

interface FeaturedBusinessesProps {
  businesses: Business[];
  isLoading?: boolean;
  onSelectBusiness?: (business: Business) => void;
  onNavigate?: (page: string) => void;
  onFavorite?: (business: Business) => void;
  isGuest?: boolean;
}

export const FeaturedBusinesses: React.FC<FeaturedBusinessesProps> = ({
  businesses,
  isLoading = false,
  onSelectBusiness,
  onNavigate,
  onFavorite,
  isGuest = false,
}) => {
  if (isLoading) {
    return (
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-6 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Featured <span className="gradient-text">Businesses</span>
              </h2>
              <p className="text-muted-foreground">
                Top-rated grooming professionals in your area
              </p>
            </div>
            <button
              onClick={() => onNavigate?.('marketplace')}
              className="hidden sm:flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </FadeIn>

        {/* Business Grid */}
        {businesses.length === 0 ? (
          <FadeIn>
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Star className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Featured Businesses</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                We couldn&apos;t find any featured businesses at the moment. Check back soon for top-rated grooming professionals in your area.
              </p>
              <button
                onClick={() => onNavigate?.('marketplace')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition-opacity"
              >
                Browse All Businesses
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </FadeIn>
        ) : (
          <>
            <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {businesses.map((business) => (
                <StaggerItem key={business.id}>
                  <BusinessCard
                    business={business}
                    onClick={() => onSelectBusiness?.(business)}
                    onFavorite={() => onFavorite?.(business)}
                    isGuest={isGuest}
                  />
                </StaggerItem>
              ))}
            </StaggerChildren>

            {/* Mobile View All */}
            <div className="mt-8 text-center sm:hidden">
              <button
                onClick={() => onNavigate?.('marketplace')}
                className="inline-flex items-center gap-2 text-primary font-medium"
              >
                View All Businesses
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

// Business Card Component
interface BusinessCardProps {
  business: Business;
  onClick?: () => void;
  onFavorite?: () => void;
  isGuest?: boolean;
  compact?: boolean;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  onClick,
  onFavorite,
  isGuest = false,
  compact = false,
}) => {
  const [isFavorite, setIsFavorite] = React.useState(false);
  const { user, isAuthenticated } = useAuthStore();
  
  // Mode-based restrictions - only show favorite in CLIENT mode (or guest)
  const activeMode = user?.activeMode || 'CLIENT';
  const isAdmin = user?.roles?.includes('ADMIN');
  const isProviderMode = activeMode === 'PROVIDER' && user?.roles?.includes('BUSINESS_OWNER');
  // Show favorite for guests OR for authenticated users in CLIENT mode
  const canShowFavorite = isGuest || (!isAdmin && !isProviderMode);

  const formatRating = (rating: number) => rating.toFixed(1);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      // For guests, trigger the auth prompt
      onFavorite?.();
    } else {
      // For authenticated users, toggle favorite
      setIsFavorite(!isFavorite);
    }
  };

  return (
    <GlassCard
      variant="default"
      hover
      className={cn(
        'cursor-pointer overflow-hidden',
        compact ? 'p-0' : 'p-0'
      )}
      onClick={onClick}
    >
      {/* Image */
      <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20">
        {business.coverImage ? (
          <img
            src={business.coverImage}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        ) : (business as any).hasCoverImage ? (
          // Business has a cover image but it was stripped from listing for performance
          // Show a gradient placeholder with the business initial
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30">
            <span className="text-5xl font-bold text-primary/60">
              {business.name?.charAt(0)?.toUpperCase() || 'B'}
            </span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-50">💇</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {business.subscriptionPlan === 'FEATURED' && (
            <GlassBadge variant="primary">Featured</GlassBadge>
          )}
          {business.verificationStatus === 'APPROVED' && (
            <GlassBadge variant="success">Verified</GlassBadge>
          )}
        </div>

        {/* Favorite Button - Liquid Glass - Show for guests and client mode users */}
        {canShowFavorite && (
          <button
            onClick={handleFavoriteClick}
            className="absolute top-3 right-3 h-9 w-9 rounded-xl backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)]"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                isFavorite && !isGuest ? 'fill-red-500 text-red-500' : 'text-white'
              )}
            />
          </button>
        )}

        {/* Rating Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg glass">
          <Star className="h-4 w-4 text-yellow-500 fill-current" />
          <span className="text-white font-medium text-sm">
            {formatRating(business.rating)}
          </span>
          <span className="text-white/70 text-xs">
            ({business.reviewCount})
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 line-clamp-1">
          {business.name}
        </h3>

        {business.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {business.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {business.city && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{business.city}</span>
            </div>
          )}
          {business.services?.length && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{business.services.length} services</span>
            </div>
          )}
        </div>

        {/* Services Preview */}
        {!compact && business.services && business.services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {business.services.slice(0, 3).map((service) => (
              <span
                key={service.id}
                className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground"
              >
                {service.name}
              </span>
            ))}
            {business.services.length > 3 && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
                +{business.services.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default FeaturedBusinesses;
