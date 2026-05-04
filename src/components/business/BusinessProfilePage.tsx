'use client';

import React, { useState } from 'react';
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
  Play,
  MessageSquare,
  Calendar,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassBadge,
  FadeIn,
  StaggerChildren,
  StaggerItem,
} from '@/components/ui/custom/glass-components';
import { useAuthStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Business, Service, Staff, Review, User } from '@/types';

interface BusinessProfilePageProps {
  business: Business;
  onBack?: () => void;
  onBook?: (service?: Service) => void;
  onMessage?: () => void;
  onFavorite?: () => void;
  isGuest?: boolean;
}

export const BusinessProfilePage: React.FC<BusinessProfilePageProps> = ({
  business,
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
  // Guests can see the buttons but clicking triggers auth prompt
  const canPerformClientActions = !isAdmin && !isProviderMode;
  
  const [selectedTab, setSelectedTab] = useState<'services' | 'portfolio' | 'reviews' | 'about'>('services');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const tabs = [
    { id: 'services', label: 'Services', count: business.services?.length || 0 },
    { id: 'portfolio', label: 'Portfolio', count: 0 },
    { id: 'reviews', label: 'Reviews', count: business.reviewCount },
    { id: 'about', label: 'About' },
  ];

  // Reviews come from the business prop (fetched via GET /api/businesses/[id] which includes reviews)
  const reviews = business.reviews || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-24"
    >
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-primary/20 to-secondary/20">
        {business.coverImage && (
          <img
            src={business.coverImage}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Back Button - Hidden on mobile since Navbar handles back navigation */}
        <button
          onClick={onBack}
          className="hidden md:flex absolute top-4 left-4 z-10 backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)]"
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
              className="backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)]"
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
                  // User cancelled or share failed — fallback to clipboard
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
            className="backdrop-blur-xl bg-white/15 hover:bg-white/25 border border-white/20 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(108,78,255,0.14),0_0_24px_rgba(58,190,255,0.08)] hover:shadow-[0_0_20px_rgba(108,78,255,0.25),0_0_40px_rgba(58,190,255,0.15)]"
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
          {business.verificationStatus === 'APPROVED' && (
            <GlassBadge variant="success">
              <Check className="h-3 w-3 mr-1" />
              Verified
            </GlassBadge>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        {/* Business Header */}
        <FadeIn>
          <GlassCard variant="elevated" className="p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Logo */}
              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
                {business.logo ? (
                  <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
                ) : (
                  '💇'
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">{business.name}</h1>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      {business.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{business.city}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="font-medium text-foreground">{business.rating.toFixed(1)}</span>
                        <span>({business.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {/* Client actions - Show for all users who can perform client actions (including guests) */}
                    {canPerformClientActions ? (
                      <>
                        <GlassButton
                          variant="default"
                          leftIcon={<MessageSquare className="h-4 w-4" />}
                          onClick={onMessage}
                        >
                          Message
                        </GlassButton>
                        <GlassButton
                          variant="primary"
                          leftIcon={<Calendar className="h-4 w-4" />}
                          onClick={() => onBook?.(selectedService || undefined)}
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

                {/* Quick Info */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
                  {business.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{business.phone}</span>
                    </div>
                  )}
                  {business.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{business.email}</span>
                    </div>
                  )}
                  {business.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a href={business.website} className="text-primary hover:underline">
                        {business.website}
                      </a>
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
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {business.services?.map((service) => (
                <GlassCard
                  key={service.id}
                  variant="default"
                  hover
                  className={`cursor-pointer ${selectedService?.id === service.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedService(service)}
                >
                  <div className="flex gap-4">
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
              ))}
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
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No portfolio photos yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {selectedTab === 'reviews' && (
            <div className="space-y-4">
              {/* Rating Summary */}
              <GlassCard variant="default" className="p-6">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-5xl font-bold gradient-text">{business.rating.toFixed(1)}</div>
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
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-medium">
                      {review.customer?.name?.[0] || review.customerId?.[0] || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{review.customer?.name || 'User'}</span>
                          {review.isVerified && (
                            <GlassBadge variant="success" className="ml-2">Verified</GlassBadge>
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
                      <p className="text-muted-foreground">{review.comment}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* About Tab */}
          {selectedTab === 'about' && (
            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard variant="default" className="p-6">
                <h3 className="font-semibold mb-4">About Us</h3>
                <p className="text-muted-foreground">
                  {business.description || 'No description available.'}
                </p>
              </GlassCard>

              <GlassCard variant="default" className="p-6">
                <h3 className="font-semibold mb-4">Business Hours</h3>
                <div className="space-y-2">
                  {['Monday - Friday', 'Saturday', 'Sunday'].map((day) => (
                    <div key={day} className="flex justify-between">
                      <span className="text-muted-foreground">{day}</span>
                      <span>9:00 AM - 6:00 PM</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {business.staff && business.staff.length > 0 && (
                <GlassCard variant="default" className="p-6 md:col-span-2">
                  <h3 className="font-semibold mb-4">Our Team</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {business.staff.map((staff) => (
                      <div key={staff.id} className="text-center">
                        <div className="w-16 h-16 rounded-full mx-auto bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-2 overflow-hidden">
                          {staff.avatar ? (
                            <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">👤</span>
                          )}
                        </div>
                        <div className="font-medium">{staff.name}</div>
                        <div className="text-sm text-muted-foreground">{staff.role}</div>
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
