'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, User, Store, ArrowLeft, Shield } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedBusinesses } from '@/components/home/FeaturedBusinesses';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { CTASection } from '@/components/home/CTASection';
import { MapPage } from '@/components/map/MapPage';
import { MarketplacePage } from '@/components/marketplace/MarketplacePage';
import { BusinessProfilePage } from '@/components/business/BusinessProfilePage';
import { BookingPage } from '@/components/booking/BookingPage';
import { CustomerDashboard } from '@/components/dashboard/CustomerDashboard';
import { BusinessDashboard } from '@/components/dashboard/BusinessDashboard';
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(
  () => import('@/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })),
  { ssr: false, loading: () => <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div> }
);
import { AuthPage } from '@/components/auth/AuthPage';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';
import { ProviderOnboarding } from '@/components/onboarding/ProviderOnboarding';
import { ChatPage } from '@/components/chat/ChatPage';
import { PaymentCheckout } from '@/components/payment/PaymentSystem';
import { BookingCalendar } from '@/components/calendar/BookingCalendar';
import { DisputeCenter } from '@/components/disputes/DisputeSystem';
import { AboutPage } from '@/components/pages/AboutPage';
import { PrivacyPage } from '@/components/pages/PrivacyPage';
import { TermsPage } from '@/components/pages/TermsPage';
import { SupportPage } from '@/components/pages/SupportPage';
import { SafetyPage } from '@/components/pages/SafetyPage';
import { BlogPage } from '@/components/pages/BlogPage';
import { AdvertisePage } from '@/components/pages/AdvertisePage';
import { InsuranceClaimsPage } from '@/components/pages/InsuranceClaimsPage';
import { PressPage } from '@/components/pages/PressPage';
import { CareersPage } from '@/components/pages/CareersPage';

import { ApiDocumentation } from '@/components/docs/ApiDocumentation';
import { GlassButton, GlassCard } from '@/components/ui/custom/glass-components';
import { useAuthStore, useAdminStore } from '@/store';
import { api } from '@/lib/api-client';
import { useBusinesses, useBookings, useApiNotifications, useConversations } from '@/hooks/use-business-data';
import type { Business, Service } from '@/types';

// Phase D accessibility & i18n components
import { SkipLinks } from '@/components/ui/skip-links';
import { AriaLiveRegion } from '@/components/ui/aria-live-region';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { AccessibilityToolbar } from '@/components/accessibility/accessibility-toolbar';
import { NotificationPreferencesPanel } from '@/components/notifications/NotificationPreferences';
import { AnalyticsWidget } from '@/components/analytics/AnalyticsWidget';
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel';

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export default function HomePage() {
  // Use auth store for user state
  const { user, logout, switchMode, activateProviderMode, isAuthenticated } = useAuthStore();
  
  const [currentPage, setCurrentPage] = useState<string>(() => {
    // Lazy init: check persisted auth on mount
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('styra-auth') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        const u = parsed?.state?.user;
        if (u) {
          const roles = (u.roles || [u.role]).map((r: string) => (r || '').toUpperCase());
          if (roles.includes('ADMIN')) return 'admin-dashboard';
          if (roles.includes('BUSINESS_OWNER') && u.activeMode === 'PROVIDER') return 'business-dashboard';
        }
      }
    } catch { /* ignore parse errors */ }
    return 'home';
  });
  const [dashboardTab, setDashboardTab] = useState<string>('overview');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auth prompt modal state for guests
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState<'book' | 'favorite' | 'message' | 'review' | 'block' | 'report' | 'support' | 'dashboard'>('book');

  // Conversation pre-selection for messaging
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);

  // Aria live region state
  const [ariaMessage, setAriaMessage] = useState<string | null>(null);
  const announceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getApplicationByUserId, addApplication } = useAdminStore();

  // ─── Fetch real businesses from API ─────────────────────────────────
  const { data: businesses, isLoading: businessesLoading, error: businessesError, refetch: refetchBusinesses } = useBusinesses();

  // Fetch bookings for authenticated users
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useBookings(undefined, isAuthenticated);

  // Fetch notifications for authenticated users
  const { data: notifications, refetch: refetchNotifications } = useApiNotifications(isAuthenticated);

  // Fetch conversations for authenticated users
  const { data: conversations, refetch: refetchConversations } = useConversations(isAuthenticated);

  // Guest mode - if not authenticated, treat as CLIENT guest
  const isGuest = !isAuthenticated && !user;

  // Get active mode for dual role support
  const activeMode = user?.activeMode || 'CLIENT';
  const hasProviderRole = (user?.roles || []).some((r: string) => r.toUpperCase() === 'BUSINESS_OWNER') || (user?.role || '').toUpperCase() === 'BUSINESS_OWNER';
  const isAdmin = (user?.roles || []).some((r: string) => r.toUpperCase() === 'ADMIN') || (user?.role || '').toUpperCase() === 'ADMIN';

  // Mode-based access control
  const isProviderMode = activeMode === 'PROVIDER' && hasProviderRole;
  const canPerformClientActions = !isAdmin && !isProviderMode;

  // ─── Announce page changes via AriaLiveRegion ─────────────────────────
  useEffect(() => {
    if (announceRef.current) clearTimeout(announceRef.current);
    announceRef.current = setTimeout(() => {
      setAriaMessage('Page loaded: ' + currentPage);
    }, 200);
    return () => {
      if (announceRef.current) clearTimeout(announceRef.current);
    };
  }, [currentPage]);

  // ─── RBAC: Check if user can perform client-side actions (booking, payment, review, favorites) ──
  const canPerformAction = useCallback((action: 'book' | 'favorite' | 'message' | 'review' | 'block' | 'report' | 'support' | 'dashboard'): { allowed: boolean; reason?: string } => {
    // Guest check
    if (isGuest) {
      return { allowed: false, reason: 'auth' };
    }
    // Admin cannot perform any customer/provider actions
    if (isAdmin) {
      return { allowed: false, reason: 'admin' };
    }
    // Provider mode cannot book/pay/review/favorite (can still message for business comms)
    if (isProviderMode && ['book', 'favorite', 'review'].includes(action)) {
      return { allowed: false, reason: 'provider_mode' };
    }
    return { allowed: true };
  }, [isGuest, isAdmin, isProviderMode]);

  // Handler for protected actions - prompts login if guest, blocks admin
  const requireAuth = useCallback((action: 'book' | 'favorite' | 'message' | 'review' | 'block' | 'report' | 'support' | 'dashboard', callback?: () => void) => {
    const check = canPerformAction(action);
    if (!check.allowed) {
      if (check.reason === 'auth') {
        setAuthPromptAction(action);
        setShowAuthPrompt(true);
      } else if (check.reason === 'admin') {
        // Admin sees access denied
        return false;
      } else if (check.reason === 'provider_mode') {
        // Provider mode - show switch mode prompt
        return false;
      }
      return false;
    }
    callback?.();
    return true;
  }, [isGuest, isAdmin, isProviderMode, canPerformAction]);

  // Pages admin CANNOT access
  const ADMIN_BLOCKED_PAGES = new Set([
    'booking', 'payment', 'customer-dashboard', 'disputes', 'chat',
    'onboarding', 'business-dashboard', 'calendar',
  ]);

  // Simulate loading on page change
  const navigate = useCallback((page: string, tab?: string) => {
    // Admin guard: redirect admin away from customer/provider pages
    if (isAdmin && ADMIN_BLOCKED_PAGES.has(page)) {
      page = 'admin-dashboard';
    }
    // Scroll to top when navigating to a new page
    window.scrollTo(0, 0);
    setIsLoading(true);
    setTimeout(() => {
      setCurrentPage(page);
      if (tab) setDashboardTab(tab);
      setIsLoading(false);
    }, 150);
  }, [isAdmin]);

  // Handle business selection
  const handleSelectBusiness = useCallback((business: Business) => {
    setSelectedBusiness(business);
    navigate('business');
  }, [navigate]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle category selection
  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  // Handle login - navigate based on user ACTIVE MODE (DUAL USER ROLES)
  const handleLogin = useCallback((loggedInUser?: typeof user) => {
    const currentUser = loggedInUser || user;
    
    if (!currentUser) return;
    
    // Check if user has ADMIN role
    const isAdminUser = (currentUser.roles || []).some((r: string) => r.toUpperCase() === 'ADMIN') || (currentUser.role || '').toUpperCase() === 'ADMIN';
    if (isAdminUser) {
      navigate('admin-dashboard');
      return;
    }
    
    // Check if user has BUSINESS_OWNER role and verification status
    const hasBusinessRole = (currentUser.roles || []).some((r: string) => r.toUpperCase() === 'BUSINESS_OWNER') || (currentUser.role || '').toUpperCase() === 'BUSINESS_OWNER';
    
    // Get active mode (defaults to CLIENT if not set)
    const mode = currentUser.activeMode || 'CLIENT';
    
    if (hasBusinessRole && mode === 'PROVIDER') {
      // Provider mode - check verification
      const application = getApplicationByUserId(currentUser.id);
      
      if (!application || application.status === 'PENDING') {
        navigate('onboarding');
        return;
      }
      
      if (application.status === 'APPROVED') {
        navigate('business-dashboard');
        return;
      }
      
      if (application.status === 'REJECTED') {
        navigate('onboarding');
        return;
      }
    }
    
    // Default to CLIENT mode / Customer home — refresh businesses after login
    refetchBusinesses();
    navigate('home');
  }, [navigate, user, getApplicationByUserId, refetchBusinesses]);

  // Handle onboarding complete
  const handleOnboardingComplete = useCallback(() => {
    navigate('onboarding');
  }, [navigate]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try { await api.logout(); } catch (e) { /* still clear local state */ }
    logout();
    navigate('home');
  }, [navigate, logout]);

  // Handle payment complete
  const handlePaymentComplete = useCallback(() => {
    navigate('customer-dashboard');
  }, [navigate]);

  // Reusable access denied component for RBAC guards
  const renderAccessDenied = (message: string) => (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <GlassCard className="p-8 text-center max-w-md">
        <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">{message}</p>
        <GlassButton variant="primary" onClick={() => navigate('home')}>
          Go to Home
        </GlassButton>
      </GlassCard>
    </div>
  );

  // Render current page content
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <motion.div
            key="home"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <HeroSection
              onSearch={handleSearch}
              onNavigate={navigate}
              businesses={businesses}
              onSelectBusiness={handleSelectBusiness}
            />
            <FeaturedBusinesses
              businesses={businesses}
              onSelectBusiness={handleSelectBusiness}
              onNavigate={navigate}
              onFavorite={() => requireAuth('favorite')}
              isGuest={isGuest}
            />
            <CategoriesSection onSelectCategory={handleSelectCategory} />
            <CTASection onNavigate={navigate} />
          </motion.div>
        );

      case 'map':
        return (
          <MapPage
            key="map"
            businesses={businesses}
            onSelectBusiness={handleSelectBusiness}
            onBookBusiness={(business) => {
              // Require auth for booking
              requireAuth('book', () => {
                handleSelectBusiness(business);
                navigate('booking');
              });
            }}
          />
        );

      case 'marketplace':
        return (
          <MarketplacePage
            key="marketplace"
            businesses={businesses}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            useMyLocation={useMyLocation}
            onSelectBusiness={handleSelectBusiness}
            onSearch={handleSearch}
            onFavorite={() => requireAuth('favorite')}
            isGuest={isGuest}
          />
        );

      case 'business':
        return selectedBusiness ? (
          <BusinessProfilePage
            key="business"
            business={selectedBusiness}
            onBack={() => navigate('home')}
            onBook={(service) => {
              // Require auth for booking
              requireAuth('book', () => {
                setSelectedService(service ?? null);
                navigate('booking');
              });
            }}
            onFavorite={() => {
              // Require auth for favoriting
              requireAuth('favorite');
            }}
            onMessage={() => {
              // Require auth for messaging, then create/find conversation and navigate to chat
              requireAuth('message', async () => {
                const ownerId = selectedBusiness?.ownerId || selectedBusiness?.owner?.id;
                if (ownerId) {
                  try {
                    const res = await fetch('/api/conversations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ otherUserId: ownerId }),
                    });
                    const json = await res.json();
                    if (json.success && json.data?.id) {
                      setInitialConversationId(json.data.id);
                    } else if (json.conversation?.id) {
                      setInitialConversationId(json.conversation.id);
                    } else {
                      setInitialConversationId(null);
                    }
                  } catch {
                    setInitialConversationId(null);
                  }
                } else {
                  setInitialConversationId(null);
                }
                navigate('chat');
              });
            }}
            isGuest={isGuest}
          />
        ) : null;

      case 'booking':
        // Guest cannot access booking - redirect to auth
        if (isGuest) {
          return (
            <motion.div
              key="booking-auth-required"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Sign in to Book</h2>
                <p className="text-muted-foreground mb-6">
                  Create an account or sign in to complete your booking.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('login')}
                    className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('register')}
                    className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </motion.div>
          );
        }
        // Check if user can perform client actions (booking)
        if (!canPerformClientActions) {
          return (
            <motion.div
              key="booking-blocked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Booking Not Available</h2>
                <p className="text-muted-foreground mb-6">
                  {isAdmin 
                    ? "Admin accounts cannot book services."
                    : "As a service provider, you can't book services in Provider Mode. Switch to Client Mode to book."
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  {isProviderMode && (
                    <button
                      onClick={() => {
                        switchMode('CLIENT');
                        navigate('home');
                      }}
                      className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                    >
                      Switch to Client Mode
                    </button>
                  )}
                  <button
                    onClick={() => navigate('marketplace')}
                    className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium"
                  >
                    Browse Businesses
                  </button>
                </div>
              </div>
            </motion.div>
          );
        }
        return selectedBusiness ? (
          <BookingPage
            key="booking"
            business={selectedBusiness}
            selectedService={selectedService}
            onBack={() => navigate('business')}
            onComplete={() => navigate('payment')}
          />
        ) : null;

      case 'payment':
        // Guest cannot access payment
        if (isGuest) {
          requireAuth('book');
          return null;
        }
        // Admin cannot make payments
        if (isAdmin) {
          return renderAccessDenied('Admin accounts cannot make payments. Admin is a control role only.');
        }
        // Provider mode cannot make payments
        if (isProviderMode) {
          return renderAccessDenied('Switch to Client mode to make payments.');
        }
        return selectedBusiness && selectedService ? (
          <PaymentCheckout
            key="payment"
            business={selectedBusiness}
            service={selectedService}
            date={new Date().toISOString().split('T')[0]}
            time="10:00"
            onComplete={handlePaymentComplete}
            onCancel={() => navigate('booking')}
          />
        ) : null;

      case 'login':
      case 'register':
        return (
          <AuthPage
            key="auth"
            mode={currentPage}
            onLogin={handleLogin}
            onNavigate={navigate}
          />
        );

      // CUSTOMER DASHBOARD - accessible in CLIENT mode
      case 'customer-dashboard':
        // Require authentication for dashboard access
        if (isGuest) {
          return (
            <motion.div
              key="customer-dashboard-auth-required"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Sign in to Access Dashboard</h2>
                <p className="text-muted-foreground mb-6">
                  Create an account or sign in to view your dashboard and bookings.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('login')}
                    className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('register')}
                    className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </motion.div>
          );
        }
        // Admin cannot use customer dashboard
        if (isAdmin) {
          return renderAccessDenied('Admin accounts use the Admin Dashboard.');
        }
        // Allow access if in CLIENT mode or if user only has CUSTOMER role
        if (activeMode === 'PROVIDER' && hasProviderRole) {
          navigate('business-dashboard');
          return null;
        }
        return (
          <CustomerDashboard
            key="customer-dashboard"
            user={user}
            onNavigate={navigate}
            initialTab={dashboardTab as any}
            bookings={bookingsLoading ? undefined : bookings}
          />
        );

      // BUSINESS OWNER DASHBOARD (Service Provider) - accessible in PROVIDER mode
      case 'business-dashboard':
        // Check if user is authenticated
        if (!user) {
          // Not authenticated - redirect to login
          return (
            <motion.div
              key="business-dashboard-auth-required"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Sign in to Access Dashboard</h2>
                <p className="text-muted-foreground mb-6">
                  You need to be signed in as a business owner to access the Partner Dashboard.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('login')}
                    className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('register')}
                    className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </motion.div>
          );
        }
        // Admin cannot use business dashboard
        if (isAdmin) {
          return renderAccessDenied('Admin accounts use the Admin Dashboard.');
        }
        // Check if user has provider role
        if (!hasProviderRole) {
          // Authenticated but not a provider - show access denied
          return renderAccessDenied('You need to be a Business Owner to access this.');
        }
        // Check verification status
        const application = user ? getApplicationByUserId(user.id) : null;
        if (!application || application.status !== 'APPROVED') {
          // Has role but not verified - redirect to onboarding
          return (
            <motion.div
              key="business-dashboard-pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Complete Your Setup</h2>
                <p className="text-muted-foreground mb-6">
                  {!application 
                    ? "You need to complete the onboarding process to access your dashboard."
                    : "Your application is pending approval. We'll notify you once it's approved."
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  {!application && (
                    <button
                      onClick={() => navigate('onboarding')}
                      className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                    >
                      Complete Onboarding
                    </button>
                  )}
                  <button
                    onClick={() => navigate('home')}
                    className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </motion.div>
          );
        }
        return (
          <BusinessDashboard
            key="business-dashboard"
            user={user}
            onNavigate={navigate}
            bookings={bookingsLoading ? undefined : bookings}
          />
        );

      // PROVIDER ONBOARDING - accessible by customers wanting to become providers
      case 'onboarding':
        // User must be logged in
        if (!user) {
          // Not authenticated - show prompt to register/login
          return (
            <motion.div
              key="onboarding-auth-required"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Sign in to Continue</h2>
                <p className="text-muted-foreground mb-6">
                  Create an account or sign in to register your business on Styra.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('register')}
                    className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                  >
                    Create Account
                  </button>
                  <button
                    onClick={() => navigate('login')}
                    className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          );
        }
        // Admin cannot become a provider
        if (isAdmin) {
          return renderAccessDenied('Admin accounts cannot become providers. Admin is a control role only.');
        }
        // If already an approved provider, redirect to dashboard
        const existingApp = getApplicationByUserId(user.id);
        if (existingApp?.status === 'APPROVED') {
          return (
            <motion.div
              key="onboarding-already-approved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="text-center p-8">
                <h2 className="text-2xl font-bold mb-4">Already Registered</h2>
                <p className="text-muted-foreground mb-6">
                  Your business is already approved. Access your dashboard to manage your services.
                </p>
                <button
                  onClick={() => navigate('business-dashboard')}
                  className="px-6 py-3 rounded-lg gradient-bg text-white font-medium"
                >
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          );
        }
        return (
          <ProviderOnboarding
            key="onboarding"
            onComplete={handleOnboardingComplete}
          />
        );

      // ADMIN DASHBOARD
      case 'admin-dashboard':
        if (!isAdmin) {
          return renderAccessDenied('Access denied. Admin privileges required.');
        }
        return (
          <AdminDashboard key="admin-dashboard" initialTab={dashboardTab as any} />
        );

      case 'chat':
        return (
          <ChatPage key="chat" user={user} onNavigate={navigate} initialConversationId={initialConversationId} onConversationSelected={() => setInitialConversationId(null)} />
        );

      case 'calendar':
        return (
          <div key="calendar" className="min-h-screen py-8 px-4">
            <div className="max-w-6xl mx-auto">
              {selectedBusiness ? (
                <BookingCalendar
                  services={selectedBusiness.services || []}
                  onSlotSelect={(date, time) => {
                    console.log('Selected:', date, time);
                  }}
                />
              ) : (
                <div className="text-center py-16">
                  <h2 className="text-xl font-semibold mb-2">Select a Business</h2>
                  <p className="text-muted-foreground mb-4">Choose a business to view their calendar.</p>
                  <button onClick={() => navigate('marketplace')} className="px-4 py-2 rounded-lg gradient-bg text-white">
                    Browse Businesses
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'disputes':
        // Require auth for disputes
        if (isGuest) {
          return (
            <div key="disputes-auth" className="min-h-screen py-8 px-4">
              <div className="max-w-2xl mx-auto text-center py-16">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-3">Sign In Required</h2>
                <p className="text-muted-foreground mb-6">
                  You need to be signed in to view and manage disputes.
                </p>
                <GlassButton
                  variant="primary"
                  onClick={() => navigate('login')}
                  leftIcon={<User className="h-4 w-4" />}
                >
                  Sign In / Sign Up
                </GlassButton>
              </div>
            </div>
          );
        }
        return (
          <div key="disputes" className="min-h-screen py-8 px-4">
            <div className="max-w-6xl mx-auto">
              <DisputeCenter />
            </div>
          </div>
        );

      case 'about':
        return (
          <AboutPage
            key="about"
            onBack={() => navigate('home')}
            onNavigate={navigate}
          />
        );

      case 'privacy':
        return (
          <PrivacyPage
            key="privacy"
            onBack={() => navigate('home')}
            onNavigate={navigate}
          />
        );

      case 'terms':
        return (
          <TermsPage
            key="terms"
            onBack={() => navigate('home')}
            onNavigate={navigate}
          />
        );

      case 'support':
        return (
          <SupportPage
            key="support"
            onNavigate={(page) => navigate(page)}
          />
        );

      case 'safety':
        return (
          <SafetyPage
            key="safety"
            onBack={() => navigate('home')}
            onNavigate={navigate}
          />
        );

      case 'blog':
        return (
          <BlogPage
            key="blog"
            onNavigate={navigate}
          />
        );

      case 'advertise':
        return (
          <AdvertisePage
            key="advertise"
            onBack={() => navigate('home')}
            onNavigate={navigate}
          />
        );

      case 'insurance-claims':
        return (
          <InsuranceClaimsPage
            key="insurance-claims"
            onBack={() => navigate('home')}
            onNavigate={navigate}
          />
        );

      // ─── Phase D: Notification Preferences page route ───────────────
      case 'notification-preferences':
        return (
          <div key="notification-preferences" className="min-h-screen py-8 px-4">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => navigate('home')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <NotificationPreferencesPanel />
            </div>
          </div>
        );

      // ─── Phase D: Analytics Widget page route (admin only) ──────────
      case 'analytics':
        if (!isAdmin) {
          return renderAccessDenied('Access denied. Admin privileges required.');
        }
        return (
          <div key="analytics" className="min-h-screen py-8 px-4">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={() => navigate('home')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Analytics Overview</h1>
                <p className="text-muted-foreground">Track platform performance and user engagement</p>
              </div>
              <AnalyticsWidget />
            </div>
          </div>
        );

      // ─── Phase D: Analytics Panel page route (admin only) ───────────
      case 'analytics-panel':
        if (!isAdmin) {
          return renderAccessDenied('Access denied. Admin privileges required.');
        }
        return (
          <div key="analytics-panel" className="min-h-screen py-8 px-4">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={() => navigate('home')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Analytics Panel</h1>
                <p className="text-muted-foreground">Detailed analytics data with CSV export</p>
              </div>
              <AnalyticsPanel />
            </div>
          </div>
        );

      // Additional pages referenced in footer
      case 'careers':
        return (
          <CareersPage key="careers" />
        );

      case 'press':
        return (
          <PressPage key="press" onNavigate={navigate} />
        );

      case 'api-docs':
        return (
          <ApiDocumentation
            key="api-docs"
            onBack={() => navigate('home')}
          />
        );

      case 'cookies':
        return (
          <motion.div
            key="cookies"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen py-20 px-4"
          >
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-4 gradient-text">Cookie Policy</h1>
              <div className="prose prose-lg dark:prose-invert">
                <p className="text-muted-foreground mb-4">Last updated: January 2024</p>
                <h2 className="text-xl font-semibold mt-6 mb-2">What Are Cookies?</h2>
                <p className="mb-4">Cookies are small text files stored on your device when you visit our website.</p>
                <h2 className="text-xl font-semibold mt-6 mb-2">How We Use Cookies</h2>
                <ul className="list-disc list-inside mb-4">
                  <li>Authentication and security</li>
                  <li>Remembering your preferences</li>
                  <li>Analytics and improvement</li>
                </ul>
                <h2 className="text-xl font-semibold mt-6 mb-2">Managing Cookies</h2>
                <p>You can manage cookies through your browser settings.</p>
              </div>
              <button
                onClick={() => navigate('home')}
                className="mt-8 px-6 py-3 rounded-lg gradient-bg text-white font-medium"
              >
                Back to Home
              </button>
            </div>
          </motion.div>
        );

      case 'forgot-password':
        return (
          <ForgotPasswordPage key="forgot-password" onBack={() => navigate('login')} />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* Background Depth Layer */}
      <div className="bg-depth" />
      {/* SkipLinks — first child, before Navbar (targets #main-content and #main-nav) */}
      <SkipLinks />

      {/* AriaLiveRegion — announces page changes to screen readers */}
      <AriaLiveRegion message={ariaMessage} politeness="polite" role="status" clearDelay={5000} />

      {/* Navbar — wrapped in div with id="main-nav" for skip links targeting */}
      <div id="main-nav">
        <Navbar
          currentPage={currentPage}
          onNavigate={navigate}
          isGuest={isGuest}
          notifications={notifications}
          conversations={conversations}
        />
      </div>

      <main id="main-content" className="flex-1 pt-16">
        {/* Error banner for businesses fetch — non-blocking, hidden on map page (map handles its own empty state) */}
        {businessesError && currentPage !== 'map' && (
          <div className="max-w-xl mx-auto mt-6 px-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
              <p className="text-sm text-destructive font-medium">Could not load businesses</p>
              <p className="text-xs text-muted-foreground mt-1">{businessesError}</p>
              <button
                onClick={() => refetchBusinesses()}
                className="mt-2 px-4 py-1.5 text-xs rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state for businesses on home page */}
        {!businessesLoading && !businessesError && businesses.length === 0 && currentPage === 'home' && (
          <div className="min-h-[60vh] flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Businesses Yet</h2>
              <p className="text-muted-foreground mb-4">
                There are no grooming businesses listed yet. Check back soon or consider becoming a provider!
              </p>
            </div>
          </div>
        )}

        {/* Main page content — always render, passes loading/empty businesses to children */}
        {(businesses.length > 0 || currentPage !== 'home' || businessesLoading) && (
          <AnimatePresence mode="wait">
            {renderPage()}
          </AnimatePresence>
        )}
      </main>

      {/* Hide site footer on admin dashboard — admin has its own sidebar layout */}
      {currentPage !== 'admin-dashboard' && (
        <Footer 
          onNavigate={navigate} 
          onSetSearchQuery={setSearchQuery}
          onSetUseMyLocation={() => setUseMyLocation(true)}
        />
      )}

      {/* ─── Floating / Fixed Position Components ───────────────────────── */}

      {/* LanguageSwitcher — fixed bottom-right, above the accessibility toolbar */}
      <div className="fixed bottom-20 right-6 z-50">
        <LanguageSwitcher mode="compact" />
      </div>

      {/* AccessibilityToolbar — fixed bottom-right (self-contained) */}
      <AccessibilityToolbar />

      {/* Auth Prompt Modal for Guests */}
      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action={authPromptAction}
        onSignIn={() => {
          setShowAuthPrompt(false);
          navigate('login');
        }}
        onSignUp={() => {
          setShowAuthPrompt(false);
          navigate('register');
        }}
      />
    </div>
  );
}
