'use client';

import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthStore, useCurrencyStore } from '@/store';
import { GlassButton, GlassBadge, GlassInput } from '@/components/ui/custom/glass-components';
import {
  Search,
  Map,
  Store,
  Menu,
  X,
  Bell,
  MessageSquare,
  LogOut,
  Settings,
  LayoutDashboard,
  Heart,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  DollarSign,
  Star,
  AlertCircle,
  User,
  Shield,
  Globe,
  Save,
  Briefcase,
  Users,
  ChevronRight,
  ChevronLeft,
  SwitchCamera,
  Building2,
  FileText,
  TrendingUp,
  HelpCircle,
  Home,
  Compass,
  CalendarDays,
  UserCircle,
  MapPin,
  ArrowLeft,
} from 'lucide-react';
import { ThemeToggleDropdown } from '@/components/theme/ThemeToggle';
import { BrandLogo } from '@/components/ui/brand-logo';
import { api } from '@/lib/api-client';
import type { Notification, Conversation } from '@/types';

// Currency Context - now uses Zustand store for persistence
interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  formatPrice: (price: number) => string;
}

export const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'KES',
  setCurrency: () => {},
  formatPrice: (price) => `KSh${price}`,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currency, setCurrency, formatPrice, detectLocation, detectedLocation, fetchRates } = useCurrencyStore();

  // Detect user location on mount if not already detected
  useEffect(() => {
    if (!detectedLocation) {
      detectLocation();
    }
    // Fetch exchange rates
    fetchRates();
  }, [detectedLocation, detectLocation, fetchRates]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

interface NavbarProps {
  currentPage?: string;
  onNavigate?: (page: string, tab?: string) => void;
  isGuest?: boolean;
  // Real data from API (optional - falls back to empty when not provided)
  notifications?: Notification[];
  conversations?: Conversation[];
}

// Format a date to relative time string (e.g. "5 min ago", "2h ago")
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// Bottom navigation items for mobile
const bottomNavItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'marketplace', label: 'Explore', icon: Compass },
  { id: 'map', label: 'Near Me', icon: MapPin },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
  { id: 'profile', label: 'Profile', icon: UserCircle },
];

// Get page title for mobile header and page indicator
const getPageTitle = (currentPage: string): string => {
  switch (currentPage) {
    case 'home':
      return 'Styra';
    case 'marketplace':
      return 'Explore';
    case 'map':
      return 'Map';
    case 'bookings':
    case 'customer-dashboard':
      return 'My Bookings';
    case 'profile':
      return 'Profile';
    case 'chat':
      return 'Messages';
    case 'business-dashboard':
      return 'Dashboard';
    case 'admin-dashboard':
      return 'Admin';
    case 'calendar':
      return 'Calendar';
    case 'disputes':
      return 'Disputes';
    case 'favorites':
      return 'Favorites';
    case 'about':
      return 'About Us';
    case 'terms':
      return 'Terms of Service';
    case 'privacy':
      return 'Privacy Policy';
    case 'support':
      return 'Help Center';
    case 'safety':
      return 'Safety';
    case 'insurance-claims':
      return 'Insurance Claims';
    case 'blog':
      return 'Blog';
    case 'careers':
      return 'Careers';
    case 'press':
      return 'Press';
    case 'api-docs':
      return 'Developer API';
    case 'cookies':
      return 'Cookie Policy';
    case 'advertise':
      return 'Advertise';
    case 'onboarding':
      return 'Become a Provider';
    case 'login':
      return 'Sign In';
    case 'register':
      return 'Get Started';
    default:
      return currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, ' ');
  }
};

// Pages that have their own navigation (navbar, bottom nav, sidebar) — no header back button needed
const topLevelPages = new Set([
  'home', 'marketplace', 'map', 'customer-dashboard', 'business-dashboard',
  'admin-dashboard', 'chat', 'calendar', 'business', 'booking', 'payment',
  'login', 'register', 'forgot-password',
]);

// Check if the back button should show on this page
const showBackButton = (page: string) => page !== 'home' && !topLevelPages.has(page);

// Check if the page indicator (title) should show in the navbar
const showPageIndicator = (page: string) => page !== 'home';

export const Navbar: React.FC<NavbarProps> = ({ currentPage = 'home', onNavigate, isGuest, notifications: propNotifications, conversations: propConversations }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');

  // Refs for click-outside detection
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  
  // Get currency from store
  const { currency: currentCurrency, setCurrency } = useCurrency();
  
  // Get auth state
  const { user, isAuthenticated, logout, switchMode, activateProviderMode, isProvider, isClient } = useAuthStore();
  
  // Current active mode
  const currentMode = user?.activeMode || 'CLIENT';
  
  // Check if user has dual roles (excluding admin - admin is separate)
  const isAdmin = user?.roles?.includes('ADMIN');
  const hasDualRoles = !isAdmin && user?.roles?.includes('BUSINESS_OWNER') && user?.roles?.includes('CUSTOMER');
  const isOnlyCustomer = !isAdmin && user?.roles?.includes('CUSTOMER') && !user?.roles?.includes('BUSINESS_OWNER');
  const isOnlyProvider = !isAdmin && user?.roles?.includes('BUSINESS_OWNER') && !user?.roles?.includes('CUSTOMER');
  
  // Use real data from props (falls back to empty arrays)
  const [notifications, setNotifications] = useState(propNotifications || []);
  const [localConversations] = useState(propConversations || []);

  // Sync notifications when prop changes
  React.useEffect(() => {
    if (propNotifications) {
      setNotifications(propNotifications);
    }
  }, [propNotifications]);

  // Click-outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (isProfileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
      if (isNotificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (isMessagesOpen && messagesRef.current && !messagesRef.current.contains(target)) {
        setIsMessagesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen, isNotificationsOpen, isMessagesOpen]);
  
  // Settings state
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    bookingReminders: true,
    marketingEmails: false,
    showProfile: true,
    showPhone: false,
    showEmail: false,
    language: 'en',
    currency: currentCurrency,
    name: '',
    email: '',
    phone: '',
  });

  const navItems = [
    { id: 'home', label: 'Home', icon: Store },
    { id: 'map', label: 'Explore Map', icon: Map },
    { id: 'marketplace', label: 'Marketplace', icon: Search },
  ];

  const hasUnreadNotifications = (notifications || []).some(n => !n.isRead);
  const hasUnreadMessages = (localConversations || []).some(c => (c as any).unreadCount > 0);

  const handleNavigate = (page: string, tab?: string) => {
    onNavigate?.(page, tab);
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsMessagesOpen(false);
    setIsSettingsOpen(false);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
      case 'BOOKING_REMINDER':
        return Calendar;
      case 'PAYMENT_SUCCESS':
        return DollarSign;
      case 'NEW_REVIEW':
        return Star;
      default:
        return AlertCircle;
    }
  };

  const handleSaveSettings = async () => {
    setCurrency(settings.currency);
    // Persist name and phone to backend
    try {
      const nameChanged = settings.name && settings.name !== user?.name;
      const phoneChanged = settings.phone && settings.phone !== user?.phone;
      if (nameChanged || phoneChanged) {
        const updates: { name?: string; phone?: string } = {};
        if (nameChanged) updates.name = settings.name;
        if (phoneChanged) updates.phone = settings.phone;
        await api.updateProfile(updates);
      }
      setSaveMessage('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Currency updated. Failed to save profile changes to server.');
    }
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsMessagesOpen(false);
    setSettings(prev => ({
      ...prev,
      currency: currentCurrency,
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    }));
  };

  // Handle bottom nav click
  const handleBottomNavClick = (itemId: string) => {
    if (itemId === 'profile') {
      if (isAuthenticated) {
        setIsProfileOpen(true);
      } else {
        handleNavigate('login');
      }
    } else if (itemId === 'bookings') {
      if (!isAuthenticated) {
        handleNavigate('login');
        return;
      }
      // Admin sees admin dashboard instead of customer bookings
      if (isAdmin) {
        handleNavigate('admin-dashboard', 'overview');
      } else if (currentMode === 'PROVIDER' || isOnlyProvider) {
        handleNavigate('business-dashboard');
      } else {
        handleNavigate('customer-dashboard', 'bookings');
      }
    } else {
      handleNavigate(itemId);
    }
  };

  return (
    <>
      {/* Desktop Navigation - Premium Liquid Glass */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="fixed top-0 left-0 right-0 z-40 hidden md:block glass-nav"
      >
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Back Button Area */}
            <div className="flex items-center gap-3">
              {showBackButton(currentPage) && (
                <motion.button
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleNavigate('home')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium',
                    'transition-all duration-200',
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-white/8 hover:border-white/15',
                    'border border-transparent hover:border-white/10'
                  )}
                title="Back to Home"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden xl:inline">Home</span>
                </motion.button>
              )}
              <Link 
                href="/" 
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => handleNavigate('home')}
                aria-label="Styra Home"
              >
                <BrandLogo variant="wordmark" size="navbarDesktop" hoverable />
              </Link>
              {showPageIndicator(currentPage) && (
                <div className="hidden lg:flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground/40">•</span>
                  <span className="gradient-text font-medium">{getPageTitle(currentPage)}</span>
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className="relative px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {currentPage === item.id && (
                    <motion.span
                      layoutId="nav-active-underline"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2">
              <ThemeToggleDropdown />

              {/* Role Mode Toggle */}
              {isAuthenticated && hasDualRoles && !isAdmin && (
                <div className="flex items-center">
                  <motion.div 
                    className="flex items-center bg-muted/50 rounded-full p-1"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <button
                      onClick={() => {
                        switchMode('CLIENT');
                        handleNavigate('home');
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        currentMode === 'CLIENT'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <User className="h-3.5 w-3.5" />
                      Client
                    </button>
                    <button
                      onClick={() => {
                        switchMode('PROVIDER');
                        handleNavigate('business-dashboard');
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        currentMode === 'PROVIDER'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Provider
                    </button>
                  </motion.div>
                </div>
              )}

              {/* Become a Provider Button */}
              {isAuthenticated && isOnlyCustomer && !isAdmin && (
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => handleNavigate('onboarding')}
                  leftIcon={<Building2 className="h-4 w-4" />}
                >
                  Become a Provider
                </GlassButton>
              )}
              
              {/* Admin Badge */}
              {isAuthenticated && isAdmin && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/20 text-destructive">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Admin</span>
                </div>
              )}

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <div className="relative" ref={notificationsRef}>
                    <button 
                      onClick={() => {
                        setIsNotificationsOpen(!isNotificationsOpen);
                        setIsMessagesOpen(false);
                        setIsProfileOpen(false);
                      }}
                      className={cn(
                        'relative p-2 rounded-lg transition-colors',
                        isNotificationsOpen ? 'bg-muted/70' : 'hover:bg-muted/50'
                      )}
                    >
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      {hasUnreadNotifications && (
                        <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-primary rounded-full" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isNotificationsOpen && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setIsNotificationsOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-80 sm:w-96 bg-background/95 border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden"
                          >
                            <div className="flex items-center justify-between p-4 border-b border-border/50">
                              <h3 className="font-semibold">Notifications</h3>
                              {hasUnreadNotifications && (
                                <button 
                                  onClick={markAllNotificationsAsRead}
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <CheckCheck className="h-3 w-3" />
                                  Mark all read
                                </button>
                              )}
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                              {notifications.map((notification) => {
                                const Icon = getNotificationIcon(notification.type);
                                return (
                                  <div
                                    key={notification.id}
                                    onClick={() => markNotificationAsRead(notification.id)}
                                    className={cn(
                                      'p-4 border-b border-border/30 last:border-0 cursor-pointer transition-colors',
                                      !notification.isRead ? 'bg-primary/5' : 'hover:bg-muted/30'
                                    )}
                                  >
                                    <div className="flex gap-3">
                                      <div className={cn(
                                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                                        notification.type === 'PAYMENT_SUCCESS' ? 'bg-green-500/20' :
                                        notification.type === 'NEW_REVIEW' ? 'bg-yellow-500/20' :
                                        'bg-primary/20'
                                      )}>
                                        <Icon className={cn(
                                          'h-5 w-5',
                                          notification.type === 'PAYMENT_SUCCESS' ? 'text-green-600' :
                                          notification.type === 'NEW_REVIEW' ? 'text-yellow-600' :
                                          'text-primary'
                                        )} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="font-medium text-sm truncate">{notification.title}</p>
                                          {!notification.isRead && (
                                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                          {notification.message}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {formatRelativeTime(notification.createdAt)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Messages */}
                  {!isAdmin && (
                    <div className="relative" ref={messagesRef}>
                      <button 
                        onClick={() => {
                          setIsMessagesOpen(!isMessagesOpen);
                          setIsNotificationsOpen(false);
                          setIsProfileOpen(false);
                        }}
                        className={cn(
                          'relative p-2 rounded-lg transition-colors',
                          isMessagesOpen ? 'bg-muted/70' : 'hover:bg-muted/50'
                        )}
                      >
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        {hasUnreadMessages && (
                          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-secondary rounded-full" />
                        )}
                      </button>

                      <AnimatePresence>
                        {isMessagesOpen && (
                          <>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-40"
                              onClick={() => setIsMessagesOpen(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute right-0 mt-2 w-80 sm:w-96 bg-background/95 border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden"
                            >
                              <div className="flex items-center justify-between p-4 border-b border-border/50">
                                <h3 className="font-semibold">Messages</h3>
                              </div>

                              <div className="max-h-80 overflow-y-auto">
                                {localConversations.map((conv) => {
                                  const displayName = conv.business?.name || conv.customer?.name || 'Unknown';
                                  const avatar = displayName.charAt(0).toUpperCase();
                                  const lastMsg = conv.messages?.[0]?.content || conv.lastMessage || 'No messages yet';
                                  const hasUnread = (conv as any).unreadCount > 0;
                                  const timeStr = conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : '';

                                  return (
                                    <div
                                      key={conv.id}
                                      onClick={() => handleNavigate('chat')}
                                      className="p-4 border-b border-border/30 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                                    >
                                      <div className="flex gap-3">
                                        <div className="relative">
                                          <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white font-bold">
                                            {avatar}
                                          </div>
                                          {hasUnread && (
                                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <p className="font-medium text-sm truncate">{displayName}</p>
                                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                              {timeStr}
                                            </span>
                                          </div>
                                          <p className={cn(
                                            'text-sm mt-0.5 truncate',
                                            hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                                          )}>
                                            {lastMsg}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="p-3 border-t border-border/50">
                                <button 
                                  onClick={() => handleNavigate('chat')}
                                  className="w-full text-center text-sm text-primary hover:underline"
                                >
                                  View all messages
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Profile Dropdown */}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => {
                        setIsProfileOpen(!isProfileOpen);
                        setIsNotificationsOpen(false);
                        setIsMessagesOpen(false);
                      }}
                      className={cn(
                        'flex items-center gap-2 p-1.5 rounded-lg transition-colors',
                        isProfileOpen ? 'bg-muted/70' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-medium">
                        {user?.name?.[0] || 'U'}
                      </div>
                      <span className="text-sm font-medium">
                        {user?.name || 'User'}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isProfileOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-72 bg-background/95 border border-border/50 rounded-xl p-2 shadow-xl z-50"
                          >
                            <div className="px-3 py-2 border-b border-border/50 mb-2">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                                  {user?.name?.[0] || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{user?.name}</p>
                                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                {isAdmin ? (
                                  <GlassBadge 
                                    variant="destructive" 
                                    className="text-xs"
                                  >
                                    Admin
                                  </GlassBadge>
                                ) : (
                                  <>
                                    <GlassBadge 
                                      variant={currentMode === 'PROVIDER' ? 'primary' : 'secondary'} 
                                      className="text-xs"
                                    >
                                      {currentMode === 'CLIENT' ? 'Client Mode' : 'Provider Mode'}
                                    </GlassBadge>
                                    {hasDualRoles && (
                                      <span className="text-xs text-muted-foreground">Dual Role</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Mode Switcher */}
                            {hasDualRoles && !isAdmin && (
                              <div className="px-1 py-2 border-b border-border/50 mb-2">
                                <p className="text-xs text-muted-foreground px-2 mb-2">Switch Mode</p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      switchMode('CLIENT');
                                      handleNavigate('home');
                                    }}
                                    className={cn(
                                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                                      currentMode === 'CLIENT'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                                    )}
                                  >
                                    <User className="h-3.5 w-3.5" />
                                    Client
                                  </button>
                                  <button
                                    onClick={() => {
                                      switchMode('PROVIDER');
                                      handleNavigate('business-dashboard');
                                    }}
                                    className={cn(
                                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                                      currentMode === 'PROVIDER'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                                    )}
                                  >
                                    <Building2 className="h-3.5 w-3.5" />
                                    Provider
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="space-y-1">
                              {/* Client Mode Options */}
                              {(currentMode === 'CLIENT' || isOnlyCustomer) && !isAdmin && (
                                <>
                                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">My Account</div>
                                  <MenuItem
                                    icon={TrendingUp}
                                    label="Dashboard"
                                    onClick={() => handleNavigate('customer-dashboard', 'overview')}
                                  />
                                  <MenuItem
                                    icon={Calendar}
                                    label="My Bookings"
                                    onClick={() => handleNavigate('customer-dashboard', 'bookings')}
                                  />
                                  <MenuItem
                                    icon={Heart}
                                    label="Favorites"
                                    onClick={() => handleNavigate('customer-dashboard', 'favorites')}
                                  />
                                  <MenuItem
                                    icon={MessageSquare}
                                    label="Messages"
                                    onClick={() => handleNavigate('chat')}
                                  />
                                  <MenuItem
                                    icon={AlertCircle}
                                    label="Disputes"
                                    onClick={() => handleNavigate('disputes')}
                                  />
                                  <div className="border-t border-border/50 my-1" />
                                  {!(user?.roles || []).some((r: string) => r.toUpperCase() === 'BUSINESS_OWNER') && (
                                    <MenuItem
                                      icon={Briefcase}
                                      label="Become a Provider"
                                      onClick={() => handleNavigate('onboarding')}
                                      variant="highlight"
                                    />
                                  )}
                                </>
                              )}

                              {/* Provider Mode Options */}
                              {(currentMode === 'PROVIDER' || isOnlyProvider) && !isAdmin && (
                                <>
                                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">My Business</div>
                                  <MenuItem
                                    icon={LayoutDashboard}
                                    label="Dashboard"
                                    onClick={() => handleNavigate('business-dashboard')}
                                  />
                                  <MenuItem
                                    icon={Calendar}
                                    label="Calendar"
                                    onClick={() => handleNavigate('calendar')}
                                  />
                                  <MenuItem
                                    icon={MessageSquare}
                                    label="Messages"
                                    onClick={() => handleNavigate('chat')}
                                  />
                                  <MenuItem
                                    icon={DollarSign}
                                    label="Earnings"
                                    onClick={() => handleNavigate('business-dashboard')}
                                  />
                                  <MenuItem
                                    icon={AlertCircle}
                                    label="Disputes"
                                    onClick={() => handleNavigate('disputes')}
                                  />
                                </>
                              )}

                              {/* Admin Options */}
                              {isAdmin && (
                                <>
                                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Admin</div>
                                  <MenuItem
                                    icon={LayoutDashboard}
                                    label="Dashboard"
                                    onClick={() => handleNavigate('admin-dashboard', 'overview')}
                                  />
                                  <MenuItem
                                    icon={Users}
                                    label="User Management"
                                    onClick={() => handleNavigate('admin-dashboard', 'users')}
                                  />
                                  <MenuItem
                                    icon={DollarSign}
                                    label="Revenue"
                                    onClick={() => handleNavigate('admin-dashboard', 'revenue')}
                                  />
                                  <MenuItem
                                    icon={FileText}
                                    label="Content"
                                    onClick={() => handleNavigate('admin-dashboard', 'content')}
                                  />
                                  <MenuItem
                                    icon={AlertCircle}
                                    label="Disputes"
                                    onClick={() => handleNavigate('admin-dashboard', 'disputes-reports')}
                                  />
                                </>
                              )}

                              <div className="border-t border-border/50 my-1" />
                              
                              <MenuItem
                                icon={Settings}
                                label="Platform Settings"
                                onClick={() => handleNavigate('admin-dashboard', 'settings')}
                              />
                              <MenuItem
                                icon={Globe}
                                label="View Website"
                                onClick={() => handleNavigate('home')}
                              />

                              <div className="border-t border-border/50 my-1" />

                              <MenuItem
                                icon={LogOut}
                                label="Sign Out"
                                onClick={() => {
                                  logout();
                                  setIsProfileOpen(false);
                                }}
                                variant="destructive"
                              />
                            </div>
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavigate('login')}
                  >
                    Sign In
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleNavigate('register')}
                  >
                    Get Started
                  </GlassButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Header - Premium Liquid Glass */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="fixed top-0 left-0 right-0 z-40 md:hidden safe-area-top glass-nav"
      >
        <div className="relative flex items-center justify-between h-14 px-3">
          {/* Left Side - Back Button for sub-pages only */}
          <div className="flex items-center w-10">
            {showBackButton(currentPage) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleNavigate('home')}
                className={cn(
                  'p-2 -ml-1 rounded-xl transition-all duration-200',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-white/8 active:bg-white/12'
                )}
                aria-label="Back to Home"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
            )}
          </div>

          {/* Center - Logo or Page Title */}
          <div className="flex-1 flex justify-center items-center">
            {(currentPage === 'home') ? (
              <Link 
                href="/" 
                className="flex items-center cursor-pointer"
                onClick={() => handleNavigate('home')}
                aria-label="Styra Home"
              >
                <BrandLogo variant="wordmark" size="navbarMobile" hoverable />
              </Link>
            ) : (
              <h1 className="text-base font-semibold text-foreground">
                {getPageTitle(currentPage)}
              </h1>
            )}
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center justify-end gap-0.5 w-10">
            {isAuthenticated ? (
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsMessagesOpen(false);
                  setIsProfileOpen(false);
                }}
                className={cn(
                  'relative p-2 rounded-xl transition-all duration-200',
                  'hover:bg-black/5 dark:hover:bg-white/10',
                  'active:scale-95'
                )}
              >
                <Bell className="h-5 w-5 text-foreground" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full ring-2 ring-background" />
                )}
              </button>
            ) : (
              <button
                onClick={() => handleNavigate('login')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium',
                  'bg-gradient-to-r from-primary to-secondary',
                  'text-white',
                  'active:scale-95 transition-all duration-200'
                )}
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Notifications Panel - Liquid Glass */}
        <AnimatePresence>
          {isNotificationsOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/20"
                onClick={() => setIsNotificationsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="bg-background/95 border border-border/50 mx-3 mt-1 rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                  {hasUnreadNotifications && (
                    <button 
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-primary hover:underline flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    return (
                      <div
                        key={notification.id}
                        onClick={() => markNotificationAsRead(notification.id)}
                        className={cn(
                          'p-4 border-b border-white/10 last:border-0 cursor-pointer transition-all duration-200',
                          !notification.isRead 
                            ? 'bg-primary/5 hover:bg-primary/10' 
                            : 'hover:bg-white/20 dark:hover:bg-white/5'
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                            notification.type === 'PAYMENT_SUCCESS' ? 'bg-green-500/20' :
                            notification.type === 'NEW_REVIEW' ? 'bg-yellow-500/20' :
                            'bg-primary/20'
                          )}>
                            <Icon className={cn(
                              'h-5 w-5',
                              notification.type === 'PAYMENT_SUCCESS' ? 'text-green-600' :
                              notification.type === 'NEW_REVIEW' ? 'text-yellow-600' :
                              'text-primary'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm text-foreground truncate">{notification.title}</p>
                              {!notification.isRead && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Mobile Bottom Tab Bar - Premium Liquid Glass Style */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-area-bottom"
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(148, 163, 184, 0.15)'
        }}
      >
        {/* Dark mode overlay */}
        <div className="absolute inset-0 dark:bg-slate-900/90 pointer-events-none" />
        <div className="relative flex items-center justify-around h-14 px-2">
          {bottomNavItems.map((item) => {
            const isActive = currentPage === item.id || 
              (item.id === 'bookings' && currentPage === 'customer-dashboard') ||
              (item.id === 'profile' && isProfileOpen);
            
            return (
              <button
                key={item.id}
                onClick={() => handleBottomNavClick(item.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center',
                  'w-16 h-12',
                  'transition-all duration-200',
                  'active:scale-90',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn(
                  'h-5 w-5 transition-all duration-200',
                  isActive && 'stroke-[2.5]'
                )} />
                <span className={cn(
                  'text-[10px] font-medium mt-0.5',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="bottom-nav-active-underline"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {item.id === 'bookings' && isAuthenticated && (
                  <span className="absolute top-1.5 right-3 h-1.5 w-1.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Profile Bottom Sheet - Liquid Glass Style */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/30 md:hidden"
              onClick={() => setIsProfileOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-[70] md:hidden',
                'rounded-t-3xl',
                'bg-background/95 border border-border/50 border-b-0',
                'safe-area-bottom',
                'max-h-[80vh] overflow-y-auto'
              )}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Profile Header */}
              {isAuthenticated ? (
                <>
                  <div className="px-6 py-4 border-b border-border/30">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                        {user?.name?.[0] || 'U'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{user?.name}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {isAdmin ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
                              Admin
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {currentMode === 'CLIENT' ? 'Client' : 'Provider'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-4 gap-2">
                      <QuickAction
                        icon={Calendar}
                        label="Bookings"
                        onClick={() => {
                          setIsProfileOpen(false);
                          if (isAdmin) {
                            handleNavigate('admin-dashboard', 'overview');
                          } else if (currentMode === 'PROVIDER' || isOnlyProvider) {
                            handleNavigate('business-dashboard');
                          } else {
                            handleNavigate('customer-dashboard', 'bookings');
                          }
                        }}
                      />
                      {!isAdmin && (
                        <QuickAction
                          icon={Heart}
                          label="Favorites"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('customer-dashboard', 'favorites');
                          }}
                        />
                      )}
                      <QuickAction
                        icon={MessageSquare}
                        label="Messages"
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleNavigate('chat');
                        }}
                        badge={hasUnreadMessages}
                      />
                      <QuickAction
                        icon={Settings}
                        label="Settings"
                        onClick={() => {
                          setIsProfileOpen(false);
                          openSettings();
                        }}
                      />
                    </div>
                  </div>

                  {/* Mode Switcher for dual role */}
                  {hasDualRoles && !isAdmin && (
                    <div className="px-4 py-3 border-t border-border/30">
                      <p className="text-xs text-muted-foreground mb-2 px-2">Switch Mode</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            switchMode('CLIENT');
                            setIsProfileOpen(false);
                            handleNavigate('home');
                          }}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                            currentMode === 'CLIENT'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground'
                          )}
                        >
                          <User className="h-4 w-4" />
                          Client
                        </button>
                        <button
                          onClick={() => {
                            switchMode('PROVIDER');
                            setIsProfileOpen(false);
                            handleNavigate('business-dashboard');
                          }}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                            currentMode === 'PROVIDER'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground'
                          )}
                        >
                          <Building2 className="h-4 w-4" />
                          Provider
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Menu Items */}
                  <div className="px-4 py-2 space-y-1">
                    {/* Client Options */}
                    {(currentMode === 'CLIENT' || isOnlyCustomer) && !isAdmin && (
                      <>
                        <MobileMenuItem
                          icon={TrendingUp}
                          label="Dashboard"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('customer-dashboard', 'overview');
                          }}
                        />
                        {!(user?.roles || []).some((r: string) => r.toUpperCase() === 'BUSINESS_OWNER') && (
                          <MobileMenuItem
                            icon={Briefcase}
                            label="Become a Provider"
                            onClick={() => {
                              setIsProfileOpen(false);
                              handleNavigate('onboarding');
                            }}
                            highlight
                          />
                        )}
                      </>
                    )}

                    {/* Provider Options */}
                    {(currentMode === 'PROVIDER' || isOnlyProvider) && !isAdmin && (
                      <>
                        <MobileMenuItem
                          icon={LayoutDashboard}
                          label="Business Dashboard"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('business-dashboard');
                          }}
                        />
                        <MobileMenuItem
                          icon={DollarSign}
                          label="Earnings"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('business-dashboard');
                          }}
                        />
                      </>
                    )}

                    {/* Admin Options */}
                    {isAdmin && (
                      <>
                        <MobileMenuItem
                          icon={LayoutDashboard}
                          label="Admin Dashboard"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('admin-dashboard', 'overview');
                          }}
                        />
                        <MobileMenuItem
                          icon={Users}
                          label="User Management"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('admin-dashboard', 'users');
                          }}
                        />
                        <MobileMenuItem
                          icon={DollarSign}
                          label="Revenue"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('admin-dashboard', 'revenue');
                          }}
                        />
                        <MobileMenuItem
                          icon={FileText}
                          label="Content"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('admin-dashboard', 'content');
                          }}
                        />
                        <MobileMenuItem
                          icon={Bell}
                          label="Notifications"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleNavigate('admin-dashboard', 'overview');
                          }}
                        />
                      </>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="px-4 py-3 border-t border-border/30 mt-2">
                    <button
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-destructive bg-destructive/10 font-medium"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-6 py-8 text-center">
                  <UserCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="font-semibold text-lg mb-2">Welcome to Styra</p>
                  <p className="text-sm text-muted-foreground mb-4">Sign in to access your account</p>
                  <div className="flex gap-3 justify-center">
                    <GlassButton
                      variant="ghost"
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleNavigate('login');
                      }}
                    >
                      Sign In
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleNavigate('register');
                      }}
                    >
                      Get Started
                    </GlassButton>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background/95 border border-border/50 rounded-2xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Settings</h2>
                    <p className="text-sm text-muted-foreground">Manage your account preferences</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-lg hover:bg-muted/50">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <AnimatePresence>
                {saveMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 rounded-lg bg-green-500/20 text-green-600 text-sm flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {saveMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-6">
                {/* Profile Section */}
                <div className="p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">
                      {(user?.role || '').toUpperCase() === 'BUSINESS_OWNER' ? 'Personal Information' : 'Profile Information'}
                    </h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Name</label>
                      <GlassInput
                        value={settings.name}
                        onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Email</label>
                      <GlassInput
                        type="email"
                        value={settings.email}
                        onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Phone</label>
                      <GlassInput
                        value={settings.phone}
                        onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Bell className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Notifications</h3>
                  </div>
                  <div className="space-y-3">
                    <ToggleSetting label="Email Notifications" description="Receive notifications via email" checked={settings.emailNotifications} onChange={(checked) => setSettings(prev => ({ ...prev, emailNotifications: checked }))} />
                    <ToggleSetting label="Push Notifications" description="Receive push notifications" checked={settings.pushNotifications} onChange={(checked) => setSettings(prev => ({ ...prev, pushNotifications: checked }))} />
                    <ToggleSetting label="Booking Reminders" description="Get reminders before appointments" checked={settings.bookingReminders} onChange={(checked) => setSettings(prev => ({ ...prev, bookingReminders: checked }))} />
                    <ToggleSetting label="Marketing Emails" description="Receive promotional offers" checked={settings.marketingEmails} onChange={(checked) => setSettings(prev => ({ ...prev, marketingEmails: checked }))} />
                  </div>
                </div>

                {/* Privacy Section */}
                {(user?.role || '').toUpperCase() !== 'BUSINESS_OWNER' && (
                  <div className="p-4 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Privacy</h3>
                    </div>
                    <div className="space-y-3">
                      <ToggleSetting label="Public Profile" description="Allow others to view your profile" checked={settings.showProfile} onChange={(checked) => setSettings(prev => ({ ...prev, showProfile: checked }))} />
                      <ToggleSetting label="Show Phone Number" checked={settings.showPhone} onChange={(checked) => setSettings(prev => ({ ...prev, showPhone: checked }))} />
                      <ToggleSetting label="Show Email" checked={settings.showEmail} onChange={(checked) => setSettings(prev => ({ ...prev, showEmail: checked }))} />
                    </div>
                  </div>
                )}

                {/* Language & Currency Section */}
                <div className="p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Language & Currency</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Language</label>
                      <select
                        value={settings.language}
                        onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background/50 backdrop-blur-sm"
                      >
                        <option value="en">English</option>
                        <option value="sw">Swahili</option>
                        <option value="fr">French</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Currency</label>
                      <select
                        value={settings.currency}
                        onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background/50 backdrop-blur-sm"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="KES">KES (KSh)</option>
                        <option value="NGN">NGN (₦)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border/50">
                <GlassButton variant="ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</GlassButton>
                <GlassButton variant="primary" onClick={handleSaveSettings}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Menu Item Component for Desktop
const MenuItem: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'highlight';
}> = ({ icon: Icon, label, onClick, variant = 'default' }) => (
  <button onClick={onClick} className={cn(
    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
    variant === 'destructive' 
      ? 'text-destructive hover:bg-destructive/10' 
      : variant === 'highlight'
      ? 'text-primary bg-primary/10 hover:bg-primary/20 font-medium border border-primary/20'
      : 'text-foreground hover:bg-muted/50'
  )}>
    <Icon className="h-4 w-4" />
    {label}
    {variant === 'highlight' && <ChevronRight className="h-4 w-4 ml-auto" />}
  </button>
);

// Mobile Menu Item Component
const MobileMenuItem: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}> = ({ icon: Icon, label, onClick, highlight }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
      highlight
        ? 'text-primary bg-primary/10 border border-primary/20'
        : 'text-foreground hover:bg-muted/50'
    )}
  >
    <Icon className="h-5 w-5" />
    {label}
    {highlight && <ChevronRight className="h-4 w-4 ml-auto" />}
  </button>
);

// Quick Action Component for Mobile Profile Sheet
const QuickAction: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: boolean;
}> = ({ icon: Icon, label, onClick, badge }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl hover:bg-muted/50 active:scale-95 transition-all relative"
  >
    <div className="relative">
      <Icon className="h-5 w-5 text-muted-foreground" />
      {badge && (
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
      )}
    </div>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </button>
);

// Toggle Setting Component
const ToggleSetting: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium text-sm">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <button onClick={() => onChange(!checked)} className={cn('relative w-11 h-6 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted')}>
      <motion.div animate={{ x: checked ? 20 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
    </button>
  </div>
);

export default Navbar;
