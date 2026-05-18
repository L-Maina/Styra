'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Star, 
  Heart,
  Share2,
  ChevronLeft,
  MessageSquare,
  Calendar,
  Check,
  Lock,
  Tag,
  Wifi,
  Car,
  Coffee,
  Music,
  Tv,
  Zap,
  Shield,
  CreditCard,
  Accessibility,
  PawPrint,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassBadge,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { BusinessProfileSkeleton } from '@/components/ui/custom/skeleton-presets';
import { useAuthStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Business, Service, Staff, Review, User } from '@/types';

interface BusinessProfilePageProps {
  business: Business;
  isLoading?: boolean;
  onBack?: () => void;
  onBook?: (service?: Service) => void;
  onMessage?: () => void;
  onFavorite?: () => void;
  isGuest?: boolean;
}

// Parse operating hours from JSON string
function parseOperatingHours(jsonStr?: string): Record<string, string> | null {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// Parse amenities from JSON string
function parseAmenities(jsonStr?: string): string[] | null {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

// Map amenity names to icons
const amenityIcons: Record<string, React.ReactNode> = {
  'wifi': <Wifi className="h-4 w-4" />,
  'parking': <Car className="h-4 w-4" />,
  'coffee': <Coffee className="h-4 w-4" />,
  'music': <Music className="h-4 w-4" />,
  'tv': <Tv className="h-4 w-4" />,
  'ac': <Zap className="h-4 w-4" />,
  'air conditioning': <Zap className="h-4 w-4" />,
  'card payment': <CreditCard className="h-4 w-4" />,
  'card payments': <CreditCard className="h-4 w-4" />,
  'accessible': <Accessibility className="h-4 w-4" />,
  'wheelchair': <Accessibility className="h-4 w-4" />,
  'pet friendly': <PawPrint className="h-4 w-4" />,
  'pets allowed': <PawPrint className="h-4 w-4" />,
  'walk-ins': <Scissors className="h-4 w-4" />,
  'walk-ins welcome': <Scissors className="h-4 w-4" />,
  'appointments': <Calendar className="h-4 w-4" />,
  'online booking': <Globe className="h-4 w-4" />,
  'verified': <Shield className="h-4 w-4" />,
};

// Day display names in order
const dayNames: Record<string, string> = {
  'monday': 'Monday',
  'tuesday': 'Tuesday',
  'wednesday': 'Wednesday',
  'thursday': 'Thursday',
  'friday': 'Friday',
  'saturday': 'Saturday',
  'sunday': 'Sunday',
  'mon': 'Mon',
  'tue': 'Tue',
  'wed': 'Wed',
  'thu': 'Thu',
  'fri': 'Fri',
  'sat': 'Sat',
  'sun': 'Sun',
};

const defaultDayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const BusinessProfilePage: React.FC<BusinessProfilePageProps> = ({
  business,
  isLoading = false,
  onBack,
  onBook,
  onMessage,
  onFavorite,
  isGuest = false,
}) => {
  const { user, isAuthenticated } = useAuthStore();

  // Mode-based restrictions
  const activeMode = user?.activeMode || 'CLIENT';
  const isAdmin = user?.roles?.includes('ADMIN');
  const isProviderMode = activeMode === 'PROVIDER' && user?.roles?.includes('BUSINESS_OWNER');

  // Can perform client actions when in CLIENT mode (not admin, not provider mode) OR when guest
  const canPerformClientActions = !isAdmin && !isProviderMode;
  
  const [selectedTab, setSelectedTab] = useState<'services' | 'portfolio' | 'reviews' | 'about'>('services');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [coverImgError, setCoverImgError] = useState(false);

  // Determine cover image URL — use binary endpoint for fast loading
  const hasCoverImage = business.coverImage || (business as any).hasCoverImage;
  const coverImageUrl = business.coverImage || (hasCoverImage ? `/api/businesses/${business.id}/cover-image` : null);

  // Parse operating hours and amenities
  const operatingHours = useMemo(() => parseOperatingHours(business.operatingHours), [business.operatingHours]);
  const amenities = useMemo(() => parseAmenities(business.amenities), [business.amenities]);

  // Portfolio count from actual data
  const portfolioCount = business.portfolio?.length || 0;

  const tabs = [
    { id: 'services', label: 'Services', count: business.services?.length || 0 },
    { id: 'portfolio', label: 'Portfolio', count: portfolioCount },
    { id: 'reviews', label: 'Reviews', count: business.reviewCount },
    { id: 'about', label: 'About' },
  ];

  // Reviews come from the business prop (fetched via GET /api/businesses/[id] which includes reviews)
  const reviews = business.reviews || [];

  // Format full location
  const locationParts = [business.address, business.city, business.country].filter(Boolean);
  const fullLocation = locationParts.join(', ');

  // Check if currently open (basic heuristic)
  const isOpenNow = useMemo(() => {
    if (!operatingHours) return null;
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = dayNames[now.getDay()];
    const todayHours = operatingHours[todayKey] || operatingHours[todayKey.charAt(0).toUpperCase() + todayKey.slice(1)];
    if (!todayHours || todayHours.toLowerCase() === 'closed') return false;
    return true; // Simplified — actual open/close time parsing would go here
  }, [operatingHours]);

  // Show skeleton while loading
  if (isLoading) {
    return <BusinessProfileSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-24"
    >
      {/* Cover Image */}
      <div className="relative h-48 sm:h-64 md:h-80 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
        {coverImageUrl && !coverImgError ? (
          <img
            src={coverImageUrl}
            alt={business.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setCoverImgError(true)}
          />
        ) : hasCoverImage ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            <span className="text-6xl sm:text-7xl font-bold text-primary/40">
              {business.name?.charAt(0)?.toUpperCase() || 'B'}
            </span>
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Back Button - Hidden on mobile since Navbar handles back navigation */}
        <button
          onClick={onBack}
          className="hidden md:flex absolute top-4 left-4 z-10 backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)] min-h-[44px] min-w-[44px] items-center justify-center"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>

        {/* Actions - Show favorites for all users who can perform client actions (including guests) */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {canPerformClientActions && (
            <button
              onClick={() => {
                if (isGuest) {
                  onFavorite?.();
                } else {
                  setIsFavorite(!isFavorite);
                }
              }}
              className="backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)] min-h-[44px] min-w-[44px] items-center justify-center"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`h-5 w-5 transition-colors ${isFavorite && !isGuest ? 'fill-red-500 text-red-500' : 'text-white'}`}
              />
            </button>
          )}
          <button
            onClick={async () => {
              const url = typeof window !== 'undefined' ? window.location.href : '';
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: business.name,
                    text: `Check out ${business.name} on Styra`,
                    url,
                  });
                } catch (err) {
                  if ((err as DOMException).name !== 'AbortError') {
                    try {
                      await navigator.clipboard.writeText(url);
                      toast.success('Link copied to clipboard!');
                    } catch {
                      toast.error('Could not copy link');
                    }
                  }
                }
              } else if (navigator.clipboard) {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success('Link copied to clipboard!');
                } catch {
                  toast.error('Could not copy link');
                }
              } else {
                toast.error('Sharing not supported in this browser');
              }
            }}
            className="backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)] min-h-[44px] min-w-[44px] items-center justify-center"
            aria-label="Share business"
          >
            <Share2 className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {business.subscriptionPlan === 'FEATURED' && (
            <GlassBadge variant="primary">Featured</GlassBadge>
          )}
          {['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'].includes(business.verificationStatus || '') && (
            <GlassBadge variant="success">
              <Check className="h-3 w-3 mr-1" />
              Verified
            </GlassBadge>
          )}
          {isOpenNow === true && (
            <GlassBadge variant="success">Open Now</GlassBadge>
          )}
          {isOpenNow === false && (
            <GlassBadge variant="default">Closed</GlassBadge>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        {/* Business Header */}
        <FadeIn>
          <GlassCard variant="elevated" className="p-4 sm:p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Logo */}
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl sm:text-3xl overflow-hidden flex-shrink-0">
                {business.logo ? (
                  <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
                ) : (
                  '💇'
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold mb-2 truncate">{business.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base text-muted-foreground">
                      {business.category && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-4 w-4" />
                          <span className="capitalize">{business.category.replace(/[-_]/g, ' ')}</span>
                        </div>
                      )}
                      {fullLocation && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{business.city || fullLocation}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="font-medium text-foreground">{business.rating.toFixed(1)}</span>
                        <span>({business.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {canPerformClientActions ? (
                      <>
                        <GlassButton
                          variant="default"
                          leftIcon={<MessageSquare className="h-4 w-4" />}
                          onClick={onMessage}
                          className="min-h-[44px]"
                        >
                          Message
                        </GlassButton>
                        <GlassButton
                          variant="primary"
                          leftIcon={<Calendar className="h-4 w-4" />}
                          onClick={() => onBook?.(selectedService || undefined)}
                          className="min-h-[44px]"
                        >
                          Book Now
                        </GlassButton>
                      </>
                    ) : isAuthenticated ? (
                      <GlassBadge variant="default" className="text-sm py-2 px-4">
                        <Lock className="h-4 w-4 mr-2" />
                        {isAdmin ? 'Admin - View Only' : 'Provider Mode - View Only'}
                      </GlassBadge>
                    ) : null}
                  </div>
                </div>

                {/* Quick Info — all contact & location details */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border">
                  {business.phone && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${business.phone}`} className="truncate hover:text-primary transition-colors">{business.phone}</a>
                    </div>
                  )}
                  {business.email && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`mailto:${business.email}`} className="truncate hover:text-primary transition-colors">{business.email}</a>
                    </div>
                  )}
                  {business.website && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={business.website.startsWith('http') ? business.website : `https://${business.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                        {business.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {business.address && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{business.address}{business.city ? `, ${business.city}` : ''}{business.country ? `, ${business.country}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Tabs */}
        <FadeIn delay={0.1}>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
                className={`px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedTab === tab.id
                    ? 'gradient-bg text-white'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                {tab.label}
                {(tab.count ?? 0) > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                    selectedTab === tab.id ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Tab Content */}
        <motion.div
          key={selectedTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Services Tab */}
          {selectedTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {business.services && business.services.length > 0 ? (
                business.services.map((service) => (
                  <GlassCard
                    key={service.id}
                    variant="default"
                    hover
                    className={`cursor-pointer ${selectedService?.id === service.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedService(service)}
                  >
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                        {service.image ? (
                          <img src={service.image} alt={service.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-xl">✂️</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold line-clamp-1">{service.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{service.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="font-bold text-primary">
                            ${service.discountPrice || service.price}
                          </span>
                          {service.discountPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              ${service.price}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Scissors className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No services listed yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Portfolio Tab */}
          {selectedTab === 'portfolio' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {business.portfolio && business.portfolio.length > 0 ? (
                business.portfolio.map((item) => (
                  <div
                    key={item.id}
                    className="aspect-square rounded-xl overflow-hidden"
                  >
                    <img
                      src={item.image}
                      alt={item.title || 'Portfolio'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No portfolio photos yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {selectedTab === 'reviews' && (
            <div className="space-y-4">
              {/* Rating Summary */}
              <GlassCard variant="default" className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                  <div className="text-center shrink-0">
                    <div className="text-4xl sm:text-5xl font-bold gradient-text">{business.rating.toFixed(1)}</div>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 ${
                            star <= Math.round(business.rating)
                              ? 'text-yellow-500 fill-current'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {business.reviewCount} reviews
                    </div>
                  </div>
                  <div className="flex-1">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="text-sm w-8">{rating} ★</span>
                        <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full gradient-bg"
                            style={{ width: `${rating === 5 ? 70 : rating === 4 ? 20 : 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>

              {/* Review List */}
              {reviews.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No reviews yet.</p>
              )}
              {reviews.map((review) => (
                <GlassCard key={review.id} variant="default" className="p-4">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-medium shrink-0">
                      {review.customer?.name?.[0] || review.customerId?.[0] || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{review.customer?.name || 'User'}</span>
                          {review.isVerified && (
                            <GlassBadge variant="success" className="ml-1 sm:ml-2">Verified</GlassBadge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 my-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? 'text-yellow-500 fill-current'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground line-clamp-3">{review.comment}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* About Tab — Full Business Details */}
          {selectedTab === 'about' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Description */}
              <GlassCard variant="default" className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  About Us
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {business.description || 'No description available.'}
                </p>
                {business.category && (
                  <div className="mt-4 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Category:</span>
                    <GlassBadge variant="primary" className="capitalize">
                      {business.category.replace(/[-_]/g, ' ')}
                    </GlassBadge>
                  </div>
                )}
              </GlassCard>

              {/* Business Hours */}
              <GlassCard variant="default" className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Business Hours
                </h3>
                {operatingHours ? (
                  <div className="space-y-2">
                    {defaultDayOrder.map((day) => {
                      const hours = operatingHours[day] || operatingHours[day.charAt(0).toUpperCase() + day.slice(1)] || operatingHours[day.substring(0, 3)] || operatingHours[day.substring(0, 3).charAt(0).toUpperCase() + day.substring(0, 3).slice(1)];
                      const isClosed = !hours || hours.toLowerCase() === 'closed';
                      return (
                        <div key={day} className="flex justify-between items-center">
                          <span className={cn(
                            'text-sm',
                            isClosed ? 'text-muted-foreground' : 'text-foreground'
                          )}>
                            {dayNames[day] || day.charAt(0).toUpperCase() + day.slice(1)}
                          </span>
                          <span className={cn(
                            'text-sm font-medium',
                            isClosed ? 'text-destructive' : 'text-foreground'
                          )}>
                            {isClosed ? 'Closed' : hours}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {['Monday - Friday', 'Saturday', 'Sunday'].map((day) => (
                      <div key={day} className="flex justify-between">
                        <span className="text-muted-foreground text-sm">{day}</span>
                        <span className="text-sm">Contact for hours</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Business hours not specified. Contact the business for availability.
                    </p>
                  </div>
                )}
              </GlassCard>

              {/* Location & Contact */}
              <GlassCard variant="default" className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Location & Contact
                </h3>
                <div className="space-y-3">
                  {business.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Address</p>
                        <p className="text-sm text-muted-foreground">{business.address}</p>
                      </div>
                    </div>
                  )}
                  {(business.city || business.country) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">
                          {[business.city, business.country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {business.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <a href={`tel:${business.phone}`} className="text-sm text-primary hover:underline">{business.phone}</a>
                      </div>
                    </div>
                  )}
                  {business.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <a href={`mailto:${business.email}`} className="text-sm text-primary hover:underline">{business.email}</a>
                      </div>
                    </div>
                  )}
                  {business.website && (
                    <div className="flex items-start gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Website</p>
                        <a href={business.website.startsWith('http') ? business.website : `https://${business.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          {business.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}
                  {!business.address && !business.city && !business.phone && !business.email && !business.website && (
                    <p className="text-sm text-muted-foreground italic">No contact information available.</p>
                  )}
                </div>
              </GlassCard>

              {/* Amenities */}
              <GlassCard variant="default" className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary" />
                  Amenities
                </h3>
                {amenities && amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((amenity, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-sm"
                      >
                        {amenityIcons[amenity.toLowerCase()] || <Check className="h-3.5 w-3.5 text-primary" />}
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No amenities listed.</p>
                )}
              </GlassCard>

              {/* Our Team */}
              {business.staff && business.staff.length > 0 && (
                <GlassCard variant="default" className="p-6 md:col-span-2">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="h-5 w-5 text-primary">👥</span>
                    Our Team
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {business.staff.map((staff) => (
                      <div key={staff.id} className="text-center">
                        <div className="w-16 h-16 rounded-full mx-auto bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-2 overflow-hidden">
                          {staff.avatar ? (
                            <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">👤</span>
                          )}
                        </div>
                        <div className="font-medium text-sm">{staff.name}</div>
                        {staff.role && <div className="text-xs text-muted-foreground">{staff.role}</div>}
                        {staff.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{staff.bio}</p>}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Floating Book Button (Mobile) - Only for users who can perform client actions */}
      {canPerformClientActions && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-50">
          <GlassButton 
            variant="primary" 
            size="lg" 
            className="w-full" 
            onClick={() => onBook?.(selectedService || undefined)}
          >
            <Calendar className="h-5 w-5 mr-2" />
            Book Appointment
          </GlassButton>
        </div>
      )}
    </motion.div>
  );
};

export default BusinessProfilePage;
