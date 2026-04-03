'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Heart, 
  CreditCard, 
  Bell, 
  Settings,
  ChevronRight,
  Clock,
  MapPin,
  Star,
  X,
  MessageSquare,
  TrendingUp,
  Wallet,
  Search,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Building2,
  ExternalLink,
  Filter,
  Download,
  Share2,
  Gift,
  Users,
  User as UserIcon,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassBadge,
  GlassInput,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';
import { useAuthStore, useCurrencyStore } from '@/store';
import { BrandLogo } from '@/components/ui/brand-logo';
import type { User, Booking as ApiBooking } from '@/types';

interface CustomerDashboardProps {
  user: User | null;
  onNavigate?: (page: string, tab?: string) => void;
  initialTab?: string;
  bookings?: ApiBooking[];
}

type DashboardSection = 'overview' | 'bookings' | 'favorites' | 'reviews' | 'payments' | 'settings';

interface Booking {
  id: string;
  businessId: string;
  businessName: string;
  businessImage: string;
  service: string;
  date: string;
  time: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  price: number;
  staffName?: string;
  hasReview?: boolean;
}

interface Favorite {
  id: string;
  businessId: string;
  name: string;
  image: string;
  city: string;
  rating: number;
  reviewCount: number;
  category: string;
}

interface Review {
  id: string;
  businessId: string;
  businessName: string;
  rating: number;
  comment: string;
  date: string;
  service: string;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  user,
  onNavigate,
  initialTab = 'overview',
  bookings: apiBookings,
}) => {
  const [activeSection, setActiveSection] = useState<DashboardSection>((initialTab as DashboardSection) || 'overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { switchMode, isProvider, isClient, isAuthenticated } = useAuthStore();
  const { formatPrice } = useCurrencyStore();
  
  const activeMode = user?.activeMode || 'CLIENT';
  const hasProviderRole = user?.roles?.includes('BUSINESS_OWNER');
  const isAdmin = user?.roles?.includes('ADMIN');
  
  // Ensure this dashboard is only accessible in CLIENT mode
  const isProviderMode = activeMode === 'PROVIDER' && hasProviderRole;
  
  // Loading state: apiBookings is undefined while still loading
  const isLoading = apiBookings === undefined;
  const hasData = apiBookings !== undefined;

  // Map API bookings to local display format
  const mappedBookings = useMemo<Booking[]>(() => {
    if (!apiBookings) return [];
    return apiBookings.map(b => ({
      id: b.id,
      businessId: b.businessId,
      businessName: b.business?.name || 'Unknown Business',
      businessImage: b.business?.logo || b.business?.coverImage || '',
      service: b.service?.name || 'Unknown Service',
      date: b.date,
      time: b.startTime,
      status: b.status as Booking['status'],
      price: b.totalAmount,
      staffName: b.staff?.name,
      hasReview: !!b.review,
    }));
  }, [apiBookings]);

  const [bookings, setBookings] = useState<Booking[]>(mappedBookings);

  // Sync mapped bookings into state when apiBookings changes
  useEffect(() => {
    setBookings(mappedBookings);
  }, [mappedBookings]);

  // Stats computed from real bookings
  const stats = {
    totalBookings: bookings.length,
    upcomingBookings: bookings.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED').length,
    completedBookings: bookings.filter(b => b.status === 'COMPLETED').length,
    totalSpent: bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + b.price, 0),
    reviewsGiven: bookings.filter(b => b.hasReview).length,
    favoritesCount: 0, // TODO: Fetch from API when favorites endpoint is ready
  };

  // TODO: Fetch from API when favorites endpoint is ready
  const favorites: Favorite[] = [];

  // TODO: Fetch from API when reviews endpoint is ready
  const [reviews, setReviews] = useState<Review[]>([]);

  // CRITICAL: Role-based access control - must be authenticated and in CLIENT mode
  if (!user || !isAuthenticated || isAdmin || isProviderMode) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <GlassCard className="p-8 text-center max-w-md">
          <UserIcon className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            {!user || !isAuthenticated
              ? 'Please sign in to access your dashboard.'
              : isAdmin 
                ? 'Admin accounts cannot access the customer dashboard.'
                : 'Please switch to Client mode to access this dashboard.'}
          </p>
          <div className="flex gap-2 justify-center">
            {(!user || !isAuthenticated) && (
              <>
                <GlassButton variant="primary" onClick={() => onNavigate?.('login')}>
                  Sign In
                </GlassButton>
                <GlassButton variant="outline" onClick={() => onNavigate?.('home')}>
                  Browse Services
                </GlassButton>
              </>
            )}
            {isProviderMode && (
              <GlassButton variant="primary" onClick={() => { switchMode('CLIENT'); }}>
                Switch to Client Mode
              </GlassButton>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'COMPLETED':
        return 'primary';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    setBookings(bookings.map(b => 
      b.id === bookingId ? { ...b, status: 'CANCELLED' as const } : b
    ));
    setShowCancelModal(null);
  };

  const handleSubmitReview = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      const newReview: Review = {
        id: `r${Date.now()}`,
        businessId: booking.businessId,
        businessName: booking.businessName,
        rating: reviewRating,
        comment: reviewComment,
        date: new Date().toISOString().split('T')[0],
        service: booking.service,
      };
      setReviews([newReview, ...reviews]);
      setBookings(bookings.map(b => 
        b.id === bookingId ? { ...b, hasReview: true } : b
      ));
    }
    setShowReviewModal(null);
    setReviewRating(5);
    setReviewComment('');
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'upcoming') return b.status === 'CONFIRMED' || b.status === 'PENDING';
    if (filterStatus === 'completed') return b.status === 'COMPLETED';
    if (filterStatus === 'cancelled') return b.status === 'CANCELLED';
    return true;
  });

  // Navigation items for My Account
  const navItems = [
    { id: 'overview', label: 'Overview', icon: TrendingUp, description: 'Quick stats & recent activity' },
    { id: 'bookings', label: 'My Bookings', icon: Calendar, description: 'Upcoming & past appointments', count: stats.upcomingBookings },
    { id: 'favorites', label: 'Favorites', icon: Heart, description: 'Saved businesses', count: stats.favoritesCount },
    { id: 'reviews', label: 'My Reviews', icon: Star, description: 'Reviews you\'ve written', count: stats.reviewsGiven },
    { id: 'payments', label: 'Payments', icon: CreditCard, description: 'Payment methods & history' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Account preferences' },
  ];

  const renderContent = () => {
    // Loading state while bookings are being fetched
    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/30 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <div className="h-7 w-12 bg-muted rounded mb-1" />
                    <div className="h-4 w-20 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-6 rounded-xl bg-muted/30 animate-pulse">
            <div className="h-5 w-40 bg-muted rounded mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-12 h-12 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-muted rounded mb-1" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FadeIn>
                <GlassCard variant="default" className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.upcomingBookings}</p>
                      <p className="text-sm text-muted-foreground">Upcoming</p>
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>
              <FadeIn delay={0.1}>
                <GlassCard variant="default" className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.completedBookings}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>
              <FadeIn delay={0.2}>
                <GlassCard variant="default" className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatPrice(stats.totalSpent)}</p>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>
              <FadeIn delay={0.3}>
                <GlassCard variant="default" className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Star className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.reviewsGiven}</p>
                      <p className="text-sm text-muted-foreground">Reviews Given</p>
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>
            </div>

            {/* Upcoming Bookings */}
            <FadeIn delay={0.4}>
              <GlassCard variant="default" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Upcoming Appointments</h3>
                  <button 
                    onClick={() => setActiveSection('bookings')}
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING').slice(0, 3).map(booking => (
                    <div key={booking.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <img 
                        src={booking.businessImage} 
                        alt={booking.businessName}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{booking.businessName}</p>
                        <p className="text-sm text-muted-foreground">{booking.service}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{booking.date}</p>
                        <p className="text-xs text-muted-foreground">{booking.time}</p>
                      </div>
                      <GlassBadge variant={getStatusColor(booking.status) as any} className="shrink-0">
                        {booking.status}
                      </GlassBadge>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </FadeIn>

            {/* Quick Actions */}
            <FadeIn delay={0.5}>
              <div className="grid sm:grid-cols-3 gap-4">
                <GlassCard 
                  variant="default" 
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onNavigate?.('marketplace')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Find Services</p>
                      <p className="text-sm text-muted-foreground">Browse providers</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard 
                  variant="default" 
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setActiveSection('favorites')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium">My Favorites</p>
                      <p className="text-sm text-muted-foreground">{stats.favoritesCount} saved</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard 
                  variant="default" 
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setActiveSection('reviews')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Star className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium">My Reviews</p>
                      <p className="text-sm text-muted-foreground">{stats.reviewsGiven} written</p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </FadeIn>
          </div>
        );

      case 'bookings':
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold">My Bookings</h2>
              <div className="flex items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="all">All Bookings</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate?.('marketplace')}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New Booking
                </GlassButton>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredBookings.map((booking, index) => (
                <motion.div
                  key={booking.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard variant="default" className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <img 
                          src={booking.businessImage} 
                          alt={booking.businessName}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{booking.businessName}</h3>
                          <p className="text-muted-foreground">{booking.service}</p>
                          {booking.staffName && (
                            <p className="text-sm text-muted-foreground mt-1">
                              with {booking.staffName}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {booking.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {booking.time}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-lg">{formatPrice(booking.price)}</div>
                            <GlassBadge variant={getStatusColor(booking.status) as any}>
                              {booking.status}
                            </GlassBadge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {(booking.status === 'CONFIRMED' || booking.status === 'PENDING') && (
                            <>
                              <GlassButton
                                variant="outline"
                                size="sm"
                                leftIcon={<RefreshCw className="h-3 w-3" />}
                              >
                                Reschedule
                              </GlassButton>
                              <GlassButton
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => setShowCancelModal(booking.id)}
                                leftIcon={<X className="h-3 w-3" />}
                              >
                                Cancel
                              </GlassButton>
                            </>
                          )}
                          {booking.status === 'COMPLETED' && !booking.hasReview && (
                            <GlassButton
                              variant="primary"
                              size="sm"
                              onClick={() => setShowReviewModal(booking.id)}
                              leftIcon={<Star className="h-3 w-3" />}
                            >
                              Write Review
                            </GlassButton>
                          )}
                          {booking.status === 'COMPLETED' && booking.hasReview && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="h-3 w-3" /> Reviewed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredBookings.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No bookings found</h3>
                <p className="text-muted-foreground mb-4">
                  {filterStatus === 'all' 
                    ? "You haven't made any bookings yet."
                    : `No ${filterStatus} bookings.`}
                </p>
                <GlassButton
                  variant="primary"
                  onClick={() => onNavigate?.('marketplace')}
                >
                  Find Services
                </GlassButton>
              </div>
            )}
          </div>
        );

      case 'favorites':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">My Favorites</h2>
              <span className="text-sm text-muted-foreground">{favorites.length} saved</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {favorites.map((business, index) => (
                <FadeIn key={business.id} delay={0.1 * (index + 1)}>
                  <GlassCard variant="default" className="p-4 group">
                    <div className="flex items-start gap-4">
                      <img 
                        src={business.image} 
                        alt={business.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{business.name}</h3>
                        <p className="text-sm text-muted-foreground">{business.city}</p>
                        <p className="text-xs text-muted-foreground">{business.category}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-sm font-medium">{business.rating}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ({business.reviewCount} reviews)
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                          <Heart className="h-5 w-5 fill-red-500 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <GlassButton
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => onNavigate?.('business')}
                      >
                        View
                      </GlassButton>
                      <GlassButton
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onNavigate?.('booking')}
                      >
                        Book Now
                      </GlassButton>
                    </div>
                  </GlassCard>
                </FadeIn>
              ))}
            </div>

            {favorites.length === 0 && (
              <div className="text-center py-12">
                <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No favorites yet</h3>
                <p className="text-muted-foreground mb-4">
                  Save your favorite businesses for quick access.
                </p>
                <GlassButton
                  variant="primary"
                  onClick={() => onNavigate?.('marketplace')}
                >
                  Explore Businesses
                </GlassButton>
              </div>
            )}
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">My Reviews</h2>
              <span className="text-sm text-muted-foreground">{reviews.length} reviews written</span>
            </div>

            {reviews.map((review, index) => (
              <FadeIn key={review.id} delay={0.1 * (index + 1)}>
                <GlassCard variant="default" className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{review.businessName}</h3>
                        <span className="text-xs text-muted-foreground">• {review.service}</span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i < review.rating
                                ? "text-yellow-500 fill-current"
                                : "text-muted-foreground/30"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground">{review.comment}</p>
                      <p className="text-xs text-muted-foreground mt-2">{review.date}</p>
                    </div>
                    <GlassButton variant="ghost" size="sm">
                      <Edit3 className="h-4 w-4" />
                    </GlassButton>
                  </div>
                </GlassCard>
              </FadeIn>
            ))}

            {reviews.length === 0 && (
              <div className="text-center py-12">
                <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No reviews yet</h3>
                <p className="text-muted-foreground mb-4">
                  After completing a service, you can leave a review.
                </p>
              </div>
            )}
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-4">
            <GlassCard variant="default" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Payment Methods</h3>
                <GlassButton variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  Add New
                </GlassButton>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div>
                      <div className="font-medium">•••• 4242</div>
                      <div className="text-sm text-muted-foreground">Expires 12/25</div>
                    </div>
                  </div>
                  <GlassBadge variant="primary">Default</GlassBadge>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 rounded bg-gradient-to-r from-red-600 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                      MC
                    </div>
                    <div>
                      <div className="font-medium">•••• 8888</div>
                      <div className="text-sm text-muted-foreground">Expires 06/26</div>
                    </div>
                  </div>
                  <GlassButton variant="ghost" size="sm">Set Default</GlassButton>
                </div>
              </div>
            </GlassCard>

            <GlassCard variant="default" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Payment History</h3>
                <GlassButton variant="ghost" size="sm" leftIcon={<Download className="h-4 w-4" />}>
                  Export
                </GlassButton>
              </div>
              <div className="space-y-3">
                {bookings.filter(b => b.status === 'COMPLETED').map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <div className="font-medium">{payment.businessName}</div>
                        <div className="text-sm text-muted-foreground">{payment.service}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatPrice(payment.price)}</div>
                      <div className="text-xs text-muted-foreground">{payment.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard variant="default" className="p-6">
              <h3 className="font-semibold mb-4">Spending Overview</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">This Month</p>
                  {/* TODO: Fetch monthly spending from API */}
                  <p className="text-2xl font-bold">{formatPrice(0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">This Year</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.totalSpent)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">All Time</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.totalSpent)}</p>
                </div>
              </div>
            </GlassCard>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <GlassCard variant="default" className="p-6">
              <h3 className="font-semibold mb-4">Profile Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name</label>
                  <GlassInput
                    type="text"
                    value={user?.name || ''}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <GlassInput
                    type="email"
                    value={user?.email || ''}
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Phone</label>
                  <GlassInput
                    type="tel"
                    value={user?.phone || ''}
                    placeholder="Enter your phone"
                  />
                </div>
                <GlassButton variant="primary">Save Changes</GlassButton>
              </div>
            </GlassCard>

            <GlassCard variant="default" className="p-6">
              <h3 className="font-semibold mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: 'Booking confirmations', description: 'Get notified when your booking is confirmed', enabled: true },
                  { label: 'Appointment reminders', description: 'Receive reminders before your appointments', enabled: true },
                  { label: 'Promotional emails', description: 'Receive special offers and promotions', enabled: false },
                  { label: 'Review reminders', description: 'Get reminded to leave reviews after services', enabled: true },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{pref.label}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <button
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        pref.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <motion.div
                        animate={{ x: pref.enabled ? 24 : 2 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Become a Provider Section */}
            {!hasProviderRole && !isAdmin && (
              <GlassCard variant="elevated" className="p-6 border-primary/30">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Become a Service Provider</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ready to offer your services? Join our platform as a provider and start earning.
                    </p>
                    <GlassButton
                      variant="primary"
                      onClick={() => onNavigate?.('onboarding')}
                    >
                      Get Started
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen py-8"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-start gap-3">
              <BrandLogo variant="icon" size={40} className="hidden sm:block shrink-0 mt-1" />
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  Welcome back, <span className="gradient-text">{user?.name || 'Guest'}</span>
                </h1>
                <p className="text-muted-foreground">
                  Manage your bookings, favorites, and account settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Switch to Provider Mode if applicable */}
              {hasProviderRole && !isAdmin && (
                <GlassButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    switchMode('PROVIDER');
                    onNavigate?.('business-dashboard');
                  }}
                  leftIcon={<Building2 className="h-4 w-4" />}
                >
                  Switch to Provider
                </GlassButton>
              )}
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => onNavigate?.('marketplace')}
                leftIcon={<Search className="h-4 w-4" />}
              >
                Find Services
              </GlassButton>
            </div>
          </div>
        </FadeIn>

        {/* Role Mode Indicator */}
        <FadeIn delay={0.1}>
          <div className="mb-6 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
              <Star className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <span className="font-medium">Client Mode</span>
              <span className="text-muted-foreground ml-2">• Browse, book, and review services</span>
            </div>
            {hasProviderRole && (
              <span className="text-xs text-muted-foreground">
                You also have a Provider account
              </span>
            )}
          </div>
        </FadeIn>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <FadeIn delay={0.2}>
            <div className="lg:col-span-1">
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden w-full flex items-center justify-between p-4 glass-card mb-4"
              >
                <div className="flex items-center gap-3">
                  <UserIcon className="h-5 w-5 text-primary" />
                  <span className="font-medium">My Account</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  isMobileMenuOpen && "rotate-180"
                )} />
              </button>

              {/* Navigation Menu */}
              <div className={cn(
                "glass-card p-4",
                isMobileMenuOpen ? "block" : "hidden lg:block"
              )}>
                <div className="flex items-center gap-2 px-4 py-2 mb-2">
                  <UserIcon className="h-5 w-5 text-primary" />
                  <span className="font-semibold">My Account</span>
                </div>
                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id as DashboardSection);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors group',
                        activeSection === item.id
                          ? 'gradient-bg text-white'
                          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <div>
                          <span className="font-medium">{item.label}</span>
                          <p className={cn(
                            "text-xs",
                            activeSection === item.id ? "text-white/70" : "text-muted-foreground"
                          )}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          activeSection === item.id 
                            ? "bg-white/20 text-white" 
                            : "bg-primary/10 text-primary"
                        )}>
                          {item.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </FadeIn>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Cancel Booking Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCancelModal(null)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-background/95 border border-border/50 rounded-2xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Cancel Booking?</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to cancel this booking? The business will be notified and you may need to rebook.
              </p>
              <div className="flex gap-3">
                <GlassButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowCancelModal(null)}
                >
                  Keep Booking
                </GlassButton>
                <GlassButton
                  variant="outline"
                  className="flex-1 text-red-500 border-red-500 hover:bg-red-500/10"
                  onClick={() => handleCancelBooking(showCancelModal)}
                >
                  Cancel Booking
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowReviewModal(null)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-background/95 border border-border/50 rounded-2xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-lg mb-4">Write a Review</h3>
              
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          "h-6 w-6 transition-colors",
                          star <= reviewRating
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Your Review</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full h-32 p-3 rounded-lg border border-input bg-background/50 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <GlassButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowReviewModal(null)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  className="flex-1"
                  onClick={() => handleSubmitReview(showReviewModal)}
                  disabled={!reviewComment.trim()}
                >
                  Submit Review
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CustomerDashboard;
