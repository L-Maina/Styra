import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  User, 
  Business, 
  Service, 
  Booking, 
  Notification, 
  Conversation,
  DashboardStats,
  UserRole,
  UserMode
} from '@/types';
import { normalizeRole } from '@/lib/rbac';

// ============================================
// AUTH STORE - Dual Role Support
// ============================================

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Dual role methods
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  // Mode switching
  switchMode: (mode: UserMode) => void;
  activateProviderMode: () => void;
  canSwitchToProvider: () => boolean;
  isProvider: () => boolean;
  isClient: () => boolean;
  setDefaultMode: (mode: UserMode) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      
      login: (user, token) => {
        const normalizedRoles = (user.roles || [user.role]).map(normalizeRole);
        const normalizedUser: User = {
          ...user,
          role: normalizeRole(user.role),
          roles: normalizedRoles,
          activeMode: user.activeMode || getDefaultMode({ ...user, roles: normalizedRoles }),
        };
        return set({ user: normalizedUser, token, isAuthenticated: true, isLoading: false });
      },
      
      logout: () => set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
      
      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } : null
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      // Switch between CLIENT and PROVIDER modes (NOT ADMIN - admin is locked)
      switchMode: (mode) => set((state) => {
        if (!state.user) return state;
        
        const user = state.user;
        
        // ADMIN CANNOT SWITCH MODES - admin is always in ADMIN mode
        if (user.roles.includes('ADMIN')) {
          console.warn('Admin cannot switch modes - admin is always in ADMIN mode');
          return state;
        }
        
        // Check if user can switch to this mode
        if (mode === 'PROVIDER' && !user.roles.includes('BUSINESS_OWNER')) {
          console.warn('User cannot switch to PROVIDER mode - not a business owner');
          return state;
        }
        
        // Only allow switching between CLIENT and PROVIDER
        if (mode === 'ADMIN') {
          console.warn('Cannot switch to ADMIN mode - use admin login');
          return state;
        }
        
        return {
          user: { ...user, activeMode: mode }
        };
      }),
      
      // Activate provider mode (called after successful onboarding)
      activateProviderMode: () => set((state) => {
        if (!state.user) return state;
        
        const user = state.user;
        const currentRoles = user.roles || [];
        
        // Add BUSINESS_OWNER role if not already present
        const newRoles = currentRoles.includes('BUSINESS_OWNER') 
          ? currentRoles 
          : [...currentRoles, 'BUSINESS_OWNER' as UserRole];
        
        return {
          user: {
            ...user,
            roles: newRoles,
            role: 'BUSINESS_OWNER', // Update primary role
            activeMode: 'PROVIDER',
            businessVerificationStatus: 'PENDING',
          }
        };
      }),
      
      // Check if user can switch to provider mode
      canSwitchToProvider: () => {
        const state = get();
        if (!state.user) return false;
        return state.user.roles.includes('BUSINESS_OWNER');
      },
      
      // Check if user is currently in provider mode
      isProvider: () => {
        const state = get();
        return state.user?.activeMode === 'PROVIDER';
      },
      
      // Check if user is currently in client mode
      isClient: () => {
        const state = get();
        return state.user?.activeMode === 'CLIENT';
      },
      
      // Set default mode for login
      setDefaultMode: (mode) => set((state) => {
        if (!state.user) return state;
        return {
          user: { ...state.user, defaultMode: mode }
        };
      }),
    }),
    {
      name: 'styra-auth',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

// Helper function to determine default mode based on roles
// Roles are expected to already be normalized to uppercase by the caller.
function getDefaultMode(user: Partial<User> & { roles?: UserRole[] }): UserMode {
  const roles = (user.roles || []).map(normalizeRole);
  const role = user.role ? normalizeRole(user.role) : (roles[0] || 'CUSTOMER');

  // Admin always stays in ADMIN mode
  if (roles.includes('ADMIN') || role === 'ADMIN') return 'ADMIN';
  // Business owner defaults to PROVIDER mode
  if (roles.includes('BUSINESS_OWNER') || role === 'BUSINESS_OWNER') return 'PROVIDER';
  // Default to CLIENT mode
  return 'CLIENT';
}

// ============================================
// BUSINESS STORE
// ============================================

interface BusinessState {
  businesses: Business[];
  selectedBusiness: Business | null;
  featuredBusinesses: Business[];
  nearbyBusinesses: Business[];
  filters: {
    search: string;
    category: string;
    city: string;
    minRating: number;
    sortBy: string;
  };
  isLoading: boolean;
  setBusinesses: (businesses: Business[]) => void;
  setSelectedBusiness: (business: Business | null) => void;
  setFeaturedBusinesses: (businesses: Business[]) => void;
  setNearbyBusinesses: (businesses: Business[]) => void;
  setFilters: (filters: Partial<BusinessState['filters']>) => void;
  setLoading: (loading: boolean) => void;
  addBusiness: (business: Business) => void;
  updateBusiness: (id: string, data: Partial<Business>) => void;
}

export const useBusinessStore = create<BusinessState>()((set) => ({
  businesses: [],
  selectedBusiness: null,
  featuredBusinesses: [],
  nearbyBusinesses: [],
  filters: {
    search: '',
    category: '',
    city: '',
    minRating: 0,
    sortBy: 'rating',
  },
  isLoading: false,
  setBusinesses: (businesses) => set({ businesses }),
  setSelectedBusiness: (business) => set({ selectedBusiness: business }),
  setFeaturedBusinesses: (businesses) => set({ featuredBusinesses: businesses }),
  setNearbyBusinesses: (businesses) => set({ nearbyBusinesses: businesses }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setLoading: (loading) => set({ isLoading: loading }),
  addBusiness: (business) => set((state) => ({ businesses: [...state.businesses, business] })),
  updateBusiness: (id, data) => set((state) => ({
    businesses: state.businesses.map((b) => b.id === id ? { ...b, ...data } : b),
    selectedBusiness: state.selectedBusiness?.id === id 
      ? { ...state.selectedBusiness, ...data } 
      : state.selectedBusiness
  })),
}));

// ============================================
// BOOKING STORE
// ============================================

interface BookingState {
  bookings: Booking[];
  selectedBooking: Booking | null;
  selectedService: Service | null;
  selectedDate: string;
  selectedTime: string;
  selectedStaff: string | null;
  isLoading: boolean;
  setBookings: (bookings: Booking[]) => void;
  setSelectedBooking: (booking: Booking | null) => void;
  setSelectedService: (service: Service | null) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  setSelectedStaff: (staffId: string | null) => void;
  setLoading: (loading: boolean) => void;
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, data: Partial<Booking>) => void;
  clearBookingSelection: () => void;
}

export const useBookingStore = create<BookingState>()((set) => ({
  bookings: [],
  selectedBooking: null,
  selectedService: null,
  selectedDate: new Date().toISOString().split('T')[0],
  selectedTime: '',
  selectedStaff: null,
  isLoading: false,
  setBookings: (bookings) => set({ bookings }),
  setSelectedBooking: (booking) => set({ selectedBooking: booking }),
  setSelectedService: (service) => set({ selectedService: service }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setSelectedStaff: (staffId) => set({ selectedStaff: staffId }),
  setLoading: (loading) => set({ isLoading: loading }),
  addBooking: (booking) => set((state) => ({ bookings: [...state.bookings, booking] })),
  updateBooking: (id, data) => set((state) => ({
    bookings: state.bookings.map((b) => b.id === id ? { ...b, ...data } : b)
  })),
  clearBookingSelection: () => set({
    selectedService: null,
    selectedDate: new Date().toISOString().split('T')[0],
    selectedTime: '',
    selectedStaff: null,
  }),
}));

// ============================================
// NOTIFICATION STORE
// ============================================

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length
  }),
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + (notification.isRead ? 0 : 1)
  })),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => 
      n.id === id ? { ...n, isRead: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    unreadCount: 0
  })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// ============================================
// CHAT STORE
// ============================================

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  isLoading: boolean;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  addMessage: (conversationId: string, message: any) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  conversations: [],
  activeConversation: null,
  isLoading: false,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (conversation) => set({ activeConversation: conversation }),
  addMessage: (conversationId, message) => set((state) => ({
    conversations: state.conversations.map((c) => 
      c.id === conversationId 
        ? { 
            ...c, 
            lastMessage: message.content, 
            lastMessageAt: new Date(),
            messages: c.messages ? [...c.messages, message] : [message]
          } 
        : c
    ),
    activeConversation: state.activeConversation?.id === conversationId
      ? {
          ...state.activeConversation,
          lastMessage: message.content,
          lastMessageAt: new Date(),
          messages: state.activeConversation.messages 
            ? [...state.activeConversation.messages, message] 
            : [message]
        }
      : state.activeConversation
  })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// ============================================
// DASHBOARD STORE
// ============================================

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
  setStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  stats: null,
  isLoading: false,
  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// ============================================
// UI STORE
// ============================================

interface UIState {
  isSidebarOpen: boolean;
  isSearchOpen: boolean;
  isFilterOpen: boolean;
  currentPage: string;
  toggleSidebar: () => void;
  toggleSearch: () => void;
  toggleFilter: () => void;
  setCurrentPage: (page: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isSidebarOpen: false,
  isSearchOpen: false,
  isFilterOpen: false,
  currentPage: 'home',
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  toggleFilter: () => set((state) => ({ isFilterOpen: !state.isFilterOpen })),
  setCurrentPage: (page) => set({ currentPage: page }),
}));

// ============================================
// MAP STORE
// ============================================

type LocationPermissionStatus = 'prompt' | 'granted' | 'denied';

interface MapState {
  userLocation: { lat: number; lng: number } | null;
  center: { lat: number; lng: number };
  selectedLocation: { lat: number; lng: number } | null;
  zoom: number;
  bounds: [[number, number], [number, number]] | null;
  permissionStatus: LocationPermissionStatus;
  isLocating: boolean;
  setUserLocation: (location: { lat: number; lng: number } | null) => void;
  setCenter: (center: { lat: number; lng: number }) => void;
  setSelectedLocation: (location: { lat: number; lng: number } | null) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: [[number, number], [number, number]] | null) => void;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setIsLocating: (isLocating: boolean) => void;
  reset: () => void;
}

const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 }; // Nairobi, Kenya
const DEFAULT_ZOOM = 12;

export const useMapStore = create<MapState>()((set) => ({
  userLocation: null,
  center: DEFAULT_CENTER,
  selectedLocation: null,
  zoom: DEFAULT_ZOOM,
  bounds: null,
  permissionStatus: 'prompt',
  isLocating: false,
  setUserLocation: (location) => set({ userLocation: location, center: location || DEFAULT_CENTER }),
  setCenter: (center) => set({ center }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setZoom: (zoom) => set({ zoom }),
  setBounds: (bounds) => set({ bounds }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setIsLocating: (isLocating) => set({ isLocating }),
  reset: () => set({
    userLocation: null,
    center: DEFAULT_CENTER,
    selectedLocation: null,
    zoom: DEFAULT_ZOOM,
    bounds: null,
    permissionStatus: 'prompt',
    isLocating: false,
  }),
}));

// ============================================
// COMPREHENSIVE WORLD CURRENCY & COUNTRY DATA
// Supports ALL 195+ countries with currencies and dial codes
// ============================================

// Complete currency metadata for ALL worldwide currencies
export const currencyMeta: Record<string, { symbol: string; locale: string; name: string }> = {
  // Major World Currencies
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '€', locale: 'de-DE', name: 'Euro' },
  GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound Sterling' },
  JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  CNY: { symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
  CHF: { symbol: 'CHF', locale: 'de-CH', name: 'Swiss Franc' },
  AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
  NZD: { symbol: '$', locale: 'en-NZ', name: 'New Zealand Dollar' },
  
  // African Currencies
  KES: { symbol: 'KSh', locale: 'en-KE', name: 'Kenyan Shilling' },
  NGN: { symbol: '₦', locale: 'en-NG', name: 'Nigerian Naira' },
  GHS: { symbol: '₵', locale: 'en-GH', name: 'Ghanaian Cedi' },
  ZAR: { symbol: 'R', locale: 'en-ZA', name: 'South African Rand' },
  UGX: { symbol: 'USh', locale: 'en-UG', name: 'Ugandan Shilling' },
  TZS: { symbol: 'TSh', locale: 'sw-TZ', name: 'Tanzanian Shilling' },
  RWF: { symbol: 'FRw', locale: 'rw-RW', name: 'Rwandan Franc' },
  ETB: { symbol: 'Br', locale: 'am-ET', name: 'Ethiopian Birr' },
  EGP: { symbol: 'E£', locale: 'ar-EG', name: 'Egyptian Pound' },
  MAD: { symbol: 'د.م.', locale: 'ar-MA', name: 'Moroccan Dirham' },
  TND: { symbol: 'د.ت', locale: 'ar-TN', name: 'Tunisian Dinar' },
  DZD: { symbol: 'د.ج', locale: 'ar-DZ', name: 'Algerian Dinar' },
  LYD: { symbol: 'ل.د', locale: 'ar-LY', name: 'Libyan Dinar' },
  SDG: { symbol: 'ج.س.', locale: 'ar-SD', name: 'Sudanese Pound' },
  ZWL: { symbol: 'Z$', locale: 'en-ZW', name: 'Zimbabwean Dollar' },
  ZMW: { symbol: 'ZK', locale: 'en-ZM', name: 'Zambian Kwacha' },
  MWK: { symbol: 'MK', locale: 'en-MW', name: 'Malawian Kwacha' },
  MZN: { symbol: 'MT', locale: 'pt-MZ', name: 'Mozambican Metical' },
  BWP: { symbol: 'P', locale: 'en-BW', name: 'Botswana Pula' },
  NAD: { symbol: 'N$', locale: 'en-NA', name: 'Namibian Dollar' },
  SZL: { symbol: 'E', locale: 'en-SZ', name: 'Swazi Lilangeni' },
  LSL: { symbol: 'L', locale: 'en-LS', name: 'Lesotho Loti' },
  MGA: { symbol: 'Ar', locale: 'mg-MG', name: 'Malagasy Ariary' },
  SCR: { symbol: '₨', locale: 'en-SC', name: 'Seychellois Rupee' },
  MUR: { symbol: '₨', locale: 'en-MU', name: 'Mauritian Rupee' },
  MRU: { symbol: 'UM', locale: 'ar-MR', name: 'Mauritanian Ouguiya' },
  SLL: { symbol: 'Le', locale: 'en-SL', name: 'Sierra Leonean Leone' },
  GMD: { symbol: 'D', locale: 'en-GM', name: 'Gambian Dalasi' },
  GNF: { symbol: 'FG', locale: 'fr-GN', name: 'Guinean Franc' },
  BIF: { symbol: 'FBu', locale: 'fr-BI', name: 'Burundian Franc' },
  DJF: { symbol: 'Fdj', locale: 'fr-DJ', name: 'Djiboutian Franc' },
  SOS: { symbol: 'Sh.so.', locale: 'so-SO', name: 'Somali Shilling' },
  ERN: { symbol: 'Nfk', locale: 'ti-ER', name: 'Eritrean Nakfa' },
  CDF: { symbol: 'FC', locale: 'fr-CD', name: 'Congolese Franc' },
  AOQ: { symbol: 'Kz', locale: 'pt-AO', name: 'Angolan Kwanza' },
  CVE: { symbol: '$', locale: 'pt-CV', name: 'Cape Verdean Escudo' },
  STN: { symbol: 'Db', locale: 'pt-ST', name: 'São Tomé and Príncipe Dobra' },
  XOF: { symbol: 'CFA', locale: 'fr-SN', name: 'West African CFA Franc' },
  XAF: { symbol: 'FCFA', locale: 'fr-CM', name: 'Central African CFA Franc' },
  
  // Asian Currencies
  INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  PKR: { symbol: '₨', locale: 'ur-PK', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', locale: 'bn-BD', name: 'Bangladeshi Taka' },
  LKR: { symbol: '₨', locale: 'si-LK', name: 'Sri Lankan Rupee' },
  NPR: { symbol: '₨', locale: 'ne-NP', name: 'Nepalese Rupee' },
  BTN: { symbol: 'Nu.', locale: 'dz-BT', name: 'Bhutanese Ngultrum' },
  MMK: { symbol: 'K', locale: 'my-MM', name: 'Myanmar Kyat' },
  THB: { symbol: '฿', locale: 'th-TH', name: 'Thai Baht' },
  VND: { symbol: '₫', locale: 'vi-VN', name: 'Vietnamese Dong' },
  IDR: { symbol: 'Rp', locale: 'id-ID', name: 'Indonesian Rupiah' },
  MYR: { symbol: 'RM', locale: 'ms-MY', name: 'Malaysian Ringgit' },
  SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  PHP: { symbol: '₱', locale: 'en-PH', name: 'Philippine Peso' },
  HKD: { symbol: 'HK$', locale: 'zh-HK', name: 'Hong Kong Dollar' },
  TWD: { symbol: 'NT$', locale: 'zh-TW', name: 'New Taiwan Dollar' },
  KRW: { symbol: '₩', locale: 'ko-KR', name: 'South Korean Won' },
  KPW: { symbol: '₩', locale: 'ko-KP', name: 'North Korean Won' },
  MOP: { symbol: 'MOP$', locale: 'zh-MO', name: 'Macanese Pataca' },
  BND: { symbol: 'B$', locale: 'ms-BN', name: 'Brunei Dollar' },
  KHR: { symbol: '៛', locale: 'km-KH', name: 'Cambodian Riel' },
  LAK: { symbol: '₭', locale: 'lo-LA', name: 'Lao Kip' },
  AFN: { symbol: '؋', locale: 'fa-AF', name: 'Afghan Afghani' },
  MVR: { symbol: 'Rf', locale: 'dv-MV', name: 'Maldivian Rufiyaa' },
  TL: { symbol: '$', locale: 'pt-TL', name: 'Timor-Leste Dollar' },
  
  // Middle Eastern Currencies
  AED: { symbol: 'د.إ', locale: 'ar-AE', name: 'UAE Dirham' },
  SAR: { symbol: 'ر.س', locale: 'ar-SA', name: 'Saudi Riyal' },
  QAR: { symbol: 'ر.ق', locale: 'ar-QA', name: 'Qatari Rial' },
  KWD: { symbol: 'د.ك', locale: 'ar-KW', name: 'Kuwaiti Dinar' },
  BHD: { symbol: '.د.ب', locale: 'ar-BH', name: 'Bahraini Dinar' },
  OMR: { symbol: 'ر.ع.', locale: 'ar-OM', name: 'Omani Rial' },
  ILS: { symbol: '₪', locale: 'he-IL', name: 'Israeli New Shekel' },
  TRY: { symbol: '₺', locale: 'tr-TR', name: 'Turkish Lira' },
  IRR: { symbol: '﷼', locale: 'fa-IR', name: 'Iranian Rial' },
  IQD: { symbol: 'ع.د', locale: 'ar-IQ', name: 'Iraqi Dinar' },
  SYP: { symbol: '£', locale: 'ar-SY', name: 'Syrian Pound' },
  LBP: { symbol: 'ل.ل', locale: 'ar-LB', name: 'Lebanese Pound' },
  JOD: { symbol: 'د.ا', locale: 'ar-JO', name: 'Jordanian Dinar' },
  YER: { symbol: '﷼', locale: 'ar-YE', name: 'Yemeni Rial' },
  
  // European Currencies
  RUB: { symbol: '₽', locale: 'ru-RU', name: 'Russian Ruble' },
  PLN: { symbol: 'zł', locale: 'pl-PL', name: 'Polish Złoty' },
  CZK: { symbol: 'Kč', locale: 'cs-CZ', name: 'Czech Koruna' },
  HUF: { symbol: 'Ft', locale: 'hu-HU', name: 'Hungarian Forint' },
  RON: { symbol: 'lei', locale: 'ro-RO', name: 'Romanian Leu' },
  BGN: { symbol: 'лв', locale: 'bg-BG', name: 'Bulgarian Lev' },
  HRK: { symbol: 'kn', locale: 'hr-HR', name: 'Croatian Kuna' },
  SEK: { symbol: 'kr', locale: 'sv-SE', name: 'Swedish Krona' },
  NOK: { symbol: 'kr', locale: 'nb-NO', name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', locale: 'da-DK', name: 'Danish Krone' },
  ISK: { symbol: 'kr', locale: 'is-IS', name: 'Icelandic Króna' },
  UAH: { symbol: '₴', locale: 'uk-UA', name: 'Ukrainian Hryvnia' },
  BYN: { symbol: 'Br', locale: 'be-BY', name: 'Belarusian Ruble' },
  MDL: { symbol: 'L', locale: 'ro-MD', name: 'Moldovan Leu' },
  MKD: { symbol: 'ден', locale: 'mk-MK', name: 'Macedonian Denar' },
  RSD: { symbol: 'дин.', locale: 'sr-RS', name: 'Serbian Dinar' },
  ALL: { symbol: 'L', locale: 'sq-AL', name: 'Albanian Lek' },
  BAM: { symbol: 'КМ', locale: 'bs-BA', name: 'Bosnia-Herzegovina Convertible Mark' },
  GEL: { symbol: '₾', locale: 'ka-GE', name: 'Georgian Lari' },
  AMD: { symbol: '֏', locale: 'hy-AM', name: 'Armenian Dram' },
  AZN: { symbol: '₼', locale: 'az-AZ', name: 'Azerbaijani Manat' },
  KZT: { symbol: '₸', locale: 'kk-KZ', name: 'Kazakhstani Tenge' },
  KGS: { symbol: 'с', locale: 'ky-KG', name: 'Kyrgyzstani Som' },
  UZS: { symbol: 'soʻm', locale: 'uz-UZ', name: 'Uzbekistani Som' },
  TJS: { symbol: 'ЅМ', locale: 'tg-TJ', name: 'Tajikistani Somoni' },
  TMT: { symbol: 'm', locale: 'tk-TM', name: 'Turkmenistan Manat' },
  
  // North & South American Currencies
  BRL: { symbol: 'R$', locale: 'pt-BR', name: 'Brazilian Real' },
  ARS: { symbol: '$', locale: 'es-AR', name: 'Argentine Peso' },
  CLP: { symbol: '$', locale: 'es-CL', name: 'Chilean Peso' },
  COP: { symbol: '$', locale: 'es-CO', name: 'Colombian Peso' },
  PEN: { symbol: 'S/', locale: 'es-PE', name: 'Peruvian Sol' },
  MXN: { symbol: '$', locale: 'es-MX', name: 'Mexican Peso' },
  VEF: { symbol: 'Bs.', locale: 'es-VE', name: 'Venezuelan Bolívar' },
  BOB: { symbol: 'Bs.', locale: 'es-BO', name: 'Bolivian Boliviano' },
  PYG: { symbol: '₲', locale: 'es-PY', name: 'Paraguayan Guaraní' },
  UYU: { symbol: '$U', locale: 'es-UY', name: 'Uruguayan Peso' },
  GYD: { symbol: '$', locale: 'en-GY', name: 'Guyanese Dollar' },
  SRD: { symbol: '$', locale: 'nl-SR', name: 'Surinamese Dollar' },
  BZD: { symbol: '$', locale: 'en-BZ', name: 'Belize Dollar' },
  GTQ: { symbol: 'Q', locale: 'es-GT', name: 'Guatemalan Quetzal' },
  HNL: { symbol: 'L', locale: 'es-HN', name: 'Honduran Lempira' },
  NIO: { symbol: 'C$', locale: 'es-NI', name: 'Nicaraguan Córdoba' },
  CRC: { symbol: '₡', locale: 'es-CR', name: 'Costa Rican Colón' },
  PAB: { symbol: 'B/.', locale: 'es-PA', name: 'Panamanian Balboa' },
  JMD: { symbol: 'J$', locale: 'en-JM', name: 'Jamaican Dollar' },
  HTG: { symbol: 'G', locale: 'ht-HT', name: 'Haitian Gourde' },
  DOP: { symbol: 'RD$', locale: 'es-DO', name: 'Dominican Peso' },
  CUP: { symbol: '$MN', locale: 'es-CU', name: 'Cuban Peso' },
  CUC: { symbol: '$', locale: 'es-CU', name: 'Cuban Convertible Peso' },
  BBD: { symbol: '$', locale: 'en-BB', name: 'Barbadian Dollar' },
  XCD: { symbol: '$', locale: 'en-GD', name: 'East Caribbean Dollar' },
  TTD: { symbol: 'TT$', locale: 'en-TT', name: 'Trinidad and Tobago Dollar' },
  BMD: { symbol: '$', locale: 'en-BM', name: 'Bermudian Dollar' },
  KYD: { symbol: '$', locale: 'en-KY', name: 'Cayman Islands Dollar' },
  BSD: { symbol: '$', locale: 'en-BS', name: 'Bahamian Dollar' },
  
  // Pacific & Oceania Currencies
  FJD: { symbol: 'FJ$', locale: 'en-FJ', name: 'Fijian Dollar' },
  WST: { symbol: 'T', locale: 'en-WS', name: 'Samoan Tālā' },
  TOP: { symbol: 'T$', locale: 'en-TO', name: 'Tongan Paʻanga' },
  VUV: { symbol: 'Vt', locale: 'en-VU', name: 'Vanuatu Vatu' },
  SBD: { symbol: 'SI$', locale: 'en-SB', name: 'Solomon Islands Dollar' },
  PGK: { symbol: 'K', locale: 'en-PG', name: 'Papua New Guinean Kina' },
  XPF: { symbol: '₣', locale: 'fr-NC', name: 'CFP Franc' },
};

// Complete country to currency mapping - ALL countries worldwide
export const countryToCurrency: Record<string, string> = {
  // Africa - All 54 countries
  DZ: 'DZD', AO: 'AOQ', BJ: 'XOF', BW: 'BWP', BF: 'XOF', BI: 'BIF', CV: 'CVE', CM: 'XAF',
  CF: 'XAF', TD: 'XAF', KM: 'KMF', CG: 'XAF', CD: 'CDF', CI: 'XOF', DJ: 'DJF', EG: 'EGP',
  GQ: 'XAF', ER: 'ERN', SZ: 'SZL', ET: 'ETB', GA: 'XAF', GM: 'GMD', GH: 'GHS', GN: 'GNF',
  GW: 'XOF', KE: 'KES', LS: 'LSL', LR: 'LRD', LY: 'LYD', MG: 'MGA', MW: 'MWK', ML: 'XOF',
  MR: 'MRU', MU: 'MUR', MA: 'MAD', MZ: 'MZN', NA: 'NAD', NE: 'XOF', NG: 'NGN', RW: 'RWF',
  ST: 'STN', SN: 'XOF', SC: 'SCR', SL: 'SLL', SO: 'SOS', ZA: 'ZAR', SS: 'SSP', SD: 'SDG',
  TZ: 'TZS', TG: 'XOF', TN: 'TND', UG: 'UGX', ZM: 'ZMW', ZW: 'ZWL',
  
  // Asia - All 48+ countries
  AF: 'AFN', BH: 'BHD', BD: 'BDT', BT: 'BTN', BN: 'BND', KH: 'KHR', CN: 'CNY', IN: 'INR',
  ID: 'IDR', IR: 'IRR', IQ: 'IQD', IL: 'ILS', JP: 'JPY', JO: 'JOD', KZ: 'KZT', KP: 'KPW',
  KR: 'KRW', KW: 'KWD', KG: 'KGS', LA: 'LAK', LB: 'LBP', MY: 'MYR', MV: 'MVR', MN: 'MNT',
  MM: 'MMK', NP: 'NPR', OM: 'OMR', PK: 'PKR', PH: 'PHP', QA: 'QAR', RU: 'RUB', SA: 'SAR',
  SG: 'SGD', LK: 'LKR', SY: 'SYP', TW: 'TWD', TJ: 'TJS', TH: 'THB', TL: 'USD', TR: 'TRY',
  TM: 'TMT', AE: 'AED', UZ: 'UZS', VN: 'VND', YE: 'YER', PS: 'ILS', HK: 'HKD', MO: 'MOP',
  
  // Europe - All 44+ countries
  AL: 'ALL', AD: 'EUR', AM: 'AMD', AT: 'EUR', AZ: 'AZN', BY: 'BYN', BE: 'EUR', BA: 'BAM',
  BG: 'BGN', HR: 'EUR', CY: 'EUR', CZ: 'CZK', DK: 'DKK', EE: 'EUR', FI: 'EUR', FR: 'EUR',
  GE: 'GEL', DE: 'EUR', GR: 'EUR', HU: 'HUF', IS: 'ISK', IE: 'EUR', IT: 'EUR', LV: 'EUR',
  LI: 'CHF', LT: 'EUR', LU: 'EUR', MT: 'EUR', MD: 'MDL', MC: 'EUR', ME: 'EUR', NL: 'EUR',
  MK: 'MKD', NO: 'NOK', PL: 'PLN', PT: 'EUR', RO: 'RON', SM: 'EUR', RS: 'RSD', SK: 'EUR',
  SI: 'EUR', ES: 'EUR', SE: 'SEK', CH: 'CHF', UA: 'UAH', GB: 'GBP', VA: 'EUR',
  
  // North America - All 23 countries
  AG: 'XCD', BS: 'BSD', BB: 'BBD', BZ: 'BZD', CA: 'CAD', CR: 'CRC', CU: 'CUP', DM: 'XCD',
  DO: 'DOP', SV: 'USD', GD: 'XCD', GT: 'GTQ', HT: 'HTG', HN: 'HNL', JM: 'JMD', MX: 'MXN',
  NI: 'NIO', PA: 'PAB', KN: 'XCD', LC: 'XCD', VC: 'XCD', TT: 'TTD', US: 'USD',
  
  // South America - All 12 countries
  AR: 'ARS', BO: 'BOB', BR: 'BRL', CL: 'CLP', CO: 'COP', EC: 'USD', GY: 'GYD', PY: 'PYG',
  PE: 'PEN', SR: 'SRD', UY: 'UYU', VE: 'VES',
  
  // Oceania - All 14+ countries
  AU: 'AUD', FJ: 'FJD', KI: 'AUD', MH: 'USD', FM: 'USD', NR: 'AUD', NZ: 'NZD', PW: 'USD',
  PG: 'PGK', WS: 'WST', SB: 'SBD', TO: 'TOP', TV: 'AUD', VU: 'VUV',
  
  // Territories and Special Regions
  AS: 'USD', AI: 'XCD', AW: 'AWG', BM: 'BMD', KY: 'KYD', CK: 'NZD', FO: 'DKK', GL: 'DKK',
  GP: 'EUR', GU: 'USD', IM: 'GBP', JE: 'GBP', MP: 'USD', MS: 'XCD', NC: 'XPF', NF: 'AUD',
  NU: 'NZD', PR: 'USD', RE: 'EUR', SH: 'SHP', PM: 'EUR', SX: 'ANG', TC: 'USD', TK: 'NZD',
  VG: 'USD', VI: 'USD', WF: 'XPF', AX: 'EUR', GF: 'EUR', PF: 'XPF', GI: 'GIP', GS: 'GBP',
  YT: 'EUR', AC: 'SHP', TA: 'GBP', EH: 'MAD', XK: 'EUR', AB: 'RUB', SJ: 'NOK', BQ: 'USD',
  BL: 'EUR', MF: 'EUR', CW: 'ANG',
};

// Complete country to dial code mapping - ALL countries worldwide
export const countryToDialCode: Record<string, string> = {
  // Africa - All 54 countries
  DZ: '+213', AO: '+244', BJ: '+229', BW: '+267', BF: '+226', BI: '+257', CV: '+238',
  CM: '+237', CF: '+236', TD: '+235', KM: '+269', CG: '+242', CD: '+243', CI: '+225',
  DJ: '+253', EG: '+20', GQ: '+240', ER: '+291', SZ: '+268', ET: '+251', GA: '+241',
  GM: '+220', GH: '+233', GN: '+224', GW: '+245', KE: '+254', LS: '+266', LR: '+231',
  LY: '+218', MG: '+261', MW: '+265', ML: '+223', MR: '+222', MU: '+230', MA: '+212',
  MZ: '+258', NA: '+264', NE: '+227', NG: '+234', RW: '+250', ST: '+239', SN: '+221',
  SC: '+248', SL: '+232', SO: '+252', ZA: '+27', SS: '+211', SD: '+249', TZ: '+255',
  TG: '+228', TN: '+216', UG: '+256', ZM: '+260', ZW: '+263',
  
  // Asia - All 48+ countries
  AF: '+93', BH: '+973', BD: '+880', BT: '+975', BN: '+673', KH: '+855', CN: '+86',
  IN: '+91', ID: '+62', IR: '+98', IQ: '+964', IL: '+972', JP: '+81', JO: '+962',
  KZ: '+7', KP: '+850', KR: '+82', KW: '+965', KG: '+996', LA: '+856', LB: '+961',
  MY: '+60', MV: '+960', MN: '+976', MM: '+95', NP: '+977', OM: '+968', PK: '+92',
  PH: '+63', QA: '+974', RU: '+7', SA: '+966', SG: '+65', LK: '+94', SY: '+963',
  TW: '+886', TJ: '+992', TH: '+66', TL: '+670', TR: '+90', TM: '+993', AE: '+971',
  UZ: '+998', VN: '+84', YE: '+967', PS: '+970', HK: '+852', MO: '+853',
  
  // Europe - All 44+ countries
  AL: '+355', AD: '+376', AM: '+374', AT: '+43', AZ: '+994', BY: '+375', BE: '+32',
  BA: '+387', BG: '+359', HR: '+385', CY: '+357', CZ: '+420', DK: '+45', EE: '+372',
  FI: '+358', FR: '+33', GE: '+995', DE: '+49', GR: '+30', HU: '+36', IS: '+354',
  IE: '+353', IT: '+39', LV: '+371', LI: '+423', LT: '+370', LU: '+352', MT: '+356',
  MD: '+373', MC: '+377', ME: '+382', NL: '+31', MK: '+389', NO: '+47', PL: '+48',
  PT: '+351', RO: '+40', SM: '+378', RS: '+381', SK: '+421', SI: '+386', ES: '+34',
  SE: '+46', CH: '+41', UA: '+380', GB: '+44', VA: '+379',
  
  // North America - All 23 countries
  AG: '+1-268', BS: '+1-242', BB: '+1-246', BZ: '+501', CA: '+1', CR: '+506', CU: '+53',
  DM: '+1-767', DO: '+1-809', SV: '+503', GD: '+1-473', GT: '+502', HT: '+509',
  HN: '+504', JM: '+1-876', MX: '+52', NI: '+505', PA: '+507', KN: '+1-869',
  LC: '+1-758', VC: '+1-784', TT: '+1-868', US: '+1',
  
  // South America - All 12 countries
  AR: '+54', BO: '+591', BR: '+55', CL: '+56', CO: '+57', EC: '+593', GY: '+592',
  PY: '+595', PE: '+51', SR: '+597', UY: '+598', VE: '+58',
  
  // Oceania - All 14+ countries
  AU: '+61', FJ: '+679', KI: '+686', MH: '+692', FM: '+691', NR: '+674', NZ: '+64',
  PW: '+680', PG: '+675', WS: '+685', SB: '+677', TO: '+676', TV: '+688', VU: '+678',
  
  // Territories and Special Regions
  AS: '+1-684', AI: '+1-264', AW: '+297', BM: '+1-441', KY: '+1-345', CK: '+682',
  FO: '+298', GL: '+299', GP: '+590', GU: '+1-671', IM: '+44-1624', JE: '+44-1534',
  MP: '+1-670', MS: '+1-664', NC: '+687', NF: '+672', NU: '+683', PR: '+1-787',
  RE: '+262', SH: '+290', PM: '+508', SX: '+1-721', TC: '+1-649', TK: '+690',
  VG: '+1-284', VI: '+1-340', WF: '+681', AX: '+358-18', GF: '+594', PF: '+689',
  GI: '+350', GS: '+500', YT: '+262', AC: '+247', TA: '+290', EH: '+212', XK: '+383',
  AB: '+7', SJ: '+47', BQ: '+599', BL: '+590', MF: '+590', CW: '+599',
};

// Complete country name mapping
export const countryNames: Record<string, string> = {
  // Africa
  DZ: 'Algeria', AO: 'Angola', BJ: 'Benin', BW: 'Botswana', BF: 'Burkina Faso',
  BI: 'Burundi', CV: 'Cabo Verde', CM: 'Cameroon', CF: 'Central African Republic',
  TD: 'Chad', KM: 'Comoros', CG: 'Congo', CD: 'DR Congo', CI: 'Côte d\'Ivoire',
  DJ: 'Djibouti', EG: 'Egypt', GQ: 'Equatorial Guinea', ER: 'Eritrea', SZ: 'Eswatini',
  ET: 'Ethiopia', GA: 'Gabon', GM: 'Gambia', GH: 'Ghana', GN: 'Guinea', GW: 'Guinea-Bissau',
  KE: 'Kenya', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', MG: 'Madagascar', MW: 'Malawi',
  ML: 'Mali', MR: 'Mauritania', MU: 'Mauritius', MA: 'Morocco', MZ: 'Mozambique',
  NA: 'Namibia', NE: 'Niger', NG: 'Nigeria', RW: 'Rwanda', ST: 'São Tomé and Príncipe',
  SN: 'Senegal', SC: 'Seychelles', SL: 'Sierra Leone', SO: 'Somalia', ZA: 'South Africa',
  SS: 'South Sudan', SD: 'Sudan', TZ: 'Tanzania', TG: 'Togo', TN: 'Tunisia',
  UG: 'Uganda', ZM: 'Zambia', ZW: 'Zimbabwe',
  
  // Asia
  AF: 'Afghanistan', BH: 'Bahrain', BD: 'Bangladesh', BT: 'Bhutan', BN: 'Brunei',
  KH: 'Cambodia', CN: 'China', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq',
  IL: 'Israel', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan', KP: 'North Korea',
  KR: 'South Korea', KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos', LB: 'Lebanon',
  MY: 'Malaysia', MV: 'Maldives', MN: 'Mongolia', MM: 'Myanmar', NP: 'Nepal',
  OM: 'Oman', PK: 'Pakistan', PH: 'Philippines', QA: 'Qatar', RU: 'Russia',
  SA: 'Saudi Arabia', SG: 'Singapore', LK: 'Sri Lanka', SY: 'Syria', TW: 'Taiwan',
  TJ: 'Tajikistan', TH: 'Thailand', TL: 'Timor-Leste', TR: 'Turkey', TM: 'Turkmenistan',
  AE: 'United Arab Emirates', UZ: 'Uzbekistan', VN: 'Vietnam', YE: 'Yemen',
  PS: 'Palestine', HK: 'Hong Kong', MO: 'Macau',
  
  // Europe
  AL: 'Albania', AD: 'Andorra', AM: 'Armenia', AT: 'Austria', AZ: 'Azerbaijan',
  BY: 'Belarus', BE: 'Belgium', BA: 'Bosnia and Herzegovina', BG: 'Bulgaria',
  HR: 'Croatia', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark', EE: 'Estonia',
  FI: 'Finland', FR: 'France', GE: 'Georgia', DE: 'Germany', GR: 'Greece',
  HU: 'Hungary', IS: 'Iceland', IE: 'Ireland', IT: 'Italy', LV: 'Latvia',
  LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', MD: 'Moldova',
  MC: 'Monaco', ME: 'Montenegro', NL: 'Netherlands', MK: 'North Macedonia',
  NO: 'Norway', PL: 'Poland', PT: 'Portugal', RO: 'Romania', SM: 'San Marino',
  RS: 'Serbia', SK: 'Slovakia', SI: 'Slovenia', ES: 'Spain', SE: 'Sweden',
  CH: 'Switzerland', UA: 'Ukraine', GB: 'United Kingdom', VA: 'Vatican City',
  
  // North America
  AG: 'Antigua and Barbuda', BS: 'Bahamas', BB: 'Barbados', BZ: 'Belize',
  CA: 'Canada', CR: 'Costa Rica', CU: 'Cuba', DM: 'Dominica', DO: 'Dominican Republic',
  SV: 'El Salvador', GD: 'Grenada', GT: 'Guatemala', HT: 'Haiti', HN: 'Honduras',
  JM: 'Jamaica', MX: 'Mexico', NI: 'Nicaragua', PA: 'Panama', KN: 'Saint Kitts and Nevis',
  LC: 'Saint Lucia', VC: 'Saint Vincent and the Grenadines', TT: 'Trinidad and Tobago',
  US: 'United States',
  
  // South America
  AR: 'Argentina', BO: 'Bolivia', BR: 'Brazil', CL: 'Chile', CO: 'Colombia',
  EC: 'Ecuador', GY: 'Guyana', PY: 'Paraguay', PE: 'Peru', SR: 'Suriname',
  UY: 'Uruguay', VE: 'Venezuela',
  
  // Oceania
  AU: 'Australia', FJ: 'Fiji', KI: 'Kiribati', MH: 'Marshall Islands',
  FM: 'Micronesia', NR: 'Nauru', NZ: 'New Zealand', PW: 'Palau', PG: 'Papua New Guinea',
  WS: 'Samoa', SB: 'Solomon Islands', TO: 'Tonga', TV: 'Tuvalu', VU: 'Vanuatu',
  
  // Territories
  AS: 'American Samoa', AI: 'Anguilla', AW: 'Aruba', BM: 'Bermuda', KY: 'Cayman Islands',
  CK: 'Cook Islands', FO: 'Faroe Islands', GL: 'Greenland', GP: 'Guadeloupe',
  GU: 'Guam', IM: 'Isle of Man', JE: 'Jersey', MP: 'Northern Mariana Islands',
  MS: 'Montserrat', NC: 'New Caledonia', NF: 'Norfolk Island', NU: 'Niue',
  PR: 'Puerto Rico', RE: 'Réunion', SH: 'Saint Helena', PM: 'Saint Pierre and Miquelon',
  SX: 'Sint Maarten', TC: 'Turks and Caicos Islands', TK: 'Tokelau', VG: 'British Virgin Islands',
  VI: 'US Virgin Islands', WF: 'Wallis and Futuna', AX: 'Åland Islands', GF: 'French Guiana',
  PF: 'French Polynesia', GI: 'Gibraltar', GS: 'South Georgia', YT: 'Mayotte',
  AC: 'Ascension', TA: 'Tristan da Cunha', EH: 'Western Sahara', XK: 'Kosovo',
  AB: 'Abkhazia', SJ: 'Svalbard and Jan Mayen', BQ: 'Caribbean Netherlands',
  BL: 'Saint Barthélemy', MF: 'Saint Martin', CW: 'Curaçao',
};

// Complete timezone to country mapping for auto-detection
export const timezoneToCountry: Record<string, string> = {
  // Africa
  'Africa/Abidjan': 'CI', 'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET',
  'Africa/Algiers': 'DZ', 'Africa/Asmara': 'ER', 'Africa/Bamako': 'ML',
  'Africa/Bangui': 'CF', 'Africa/Banjul': 'GM', 'Africa/Bissau': 'GW',
  'Africa/Blantyre': 'MW', 'Africa/Brazzaville': 'CG', 'Africa/Bujumbura': 'BI',
  'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA', 'Africa/Ceuta': 'MA',
  'Africa/Conakry': 'GN', 'Africa/Dakar': 'SN', 'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Djibouti': 'DJ', 'Africa/Douala': 'CM', 'Africa/El_Aaiun': 'EH',
  'Africa/Freetown': 'SL', 'Africa/Gaborone': 'BW', 'Africa/Harare': 'ZW',
  'Africa/Johannesburg': 'ZA', 'Africa/Juba': 'SS', 'Africa/Kampala': 'UG',
  'Africa/Khartoum': 'SD', 'Africa/Kigali': 'RW', 'Africa/Kinshasa': 'CD',
  'Africa/Lagos': 'NG', 'Africa/Libreville': 'GA', 'Africa/Lome': 'TG',
  'Africa/Luanda': 'AO', 'Africa/Lubumbashi': 'CD', 'Africa/Lusaka': 'ZM',
  'Africa/Malabo': 'GQ', 'Africa/Maputo': 'MZ', 'Africa/Maseru': 'LS',
  'Africa/Mbabane': 'SZ', 'Africa/Mogadishu': 'SO', 'Africa/Monrovia': 'LR',
  'Africa/Nairobi': 'KE', 'Africa/Ndjamena': 'TD', 'Africa/Niamey': 'NE',
  'Africa/Nouakchott': 'MR', 'Africa/Ouagadougou': 'BF', 'Africa/Porto-Novo': 'BJ',
  'Africa/Sao_Tome': 'ST', 'Africa/Tripoli': 'LY', 'Africa/Tunis': 'TN',
  'Africa/Windhoek': 'NA',
  
  // America
  'America/Adak': 'US', 'America/Anchorage': 'US', 'America/Anguilla': 'AI',
  'America/Antigua': 'AG', 'America/Araguaina': 'BR', 'America/Argentina/Buenos_Aires': 'AR',
  'America/Argentina/Catamarca': 'AR', 'America/Argentina/Cordoba': 'AR',
  'America/Argentina/Jujuy': 'AR', 'America/Argentina/La_Rioja': 'AR',
  'America/Argentina/Mendoza': 'AR', 'America/Argentina/Rio_Gallegos': 'AR',
  'America/Argentina/Salta': 'AR', 'America/Argentina/San_Juan': 'AR',
  'America/Argentina/San_Luis': 'AR', 'America/Argentina/Tucuman': 'AR',
  'America/Argentina/Ushuaia': 'AR', 'America/Aruba': 'AW', 'America/Asuncion': 'PY',
  'America/Atikokan': 'CA', 'America/Bahia': 'BR', 'America/Bahia_Banderas': 'MX',
  'America/Barbados': 'BB', 'America/Belem': 'BR', 'America/Belize': 'BZ',
  'America/Blanc-Sablon': 'CA', 'America/Boa_Vista': 'BR', 'America/Bogota': 'CO',
  'America/Boise': 'US', 'America/Cambridge_Bay': 'CA', 'America/Campo_Grande': 'BR',
  'America/Cancun': 'MX', 'America/Caracas': 'VE', 'America/Cayenne': 'GF',
  'America/Cayman': 'KY', 'America/Chicago': 'US', 'America/Chihuahua': 'MX',
  'America/Costa_Rica': 'CR', 'America/Creston': 'CA', 'America/Cuiaba': 'BR',
  'America/Curacao': 'CW', 'America/Danmarkshavn': 'GL', 'America/Dawson': 'CA',
  'America/Dawson_Creek': 'CA', 'America/Denver': 'US', 'America/Detroit': 'US',
  'America/Dominica': 'DM', 'America/Edmonton': 'CA', 'America/Eirunepe': 'BR',
  'America/El_Salvador': 'SV', 'America/Fort_Nelson': 'CA', 'America/Fortaleza': 'BR',
  'America/Glace_Bay': 'CA', 'America/Godthab': 'GL', 'America/Goose_Bay': 'CA',
  'America/Grand_Turk': 'TC', 'America/Grenada': 'GD', 'America/Guadeloupe': 'GP',
  'America/Guatemala': 'GT', 'America/Guayaquil': 'EC', 'America/Guyana': 'GY',
  'America/Halifax': 'CA', 'America/Havana': 'CU', 'America/Hermosillo': 'MX',
  'America/Indiana/Indianapolis': 'US', 'America/Indiana/Knox': 'US',
  'America/Indiana/Marengo': 'US', 'America/Indiana/Petersburg': 'US',
  'America/Indiana/Tell_City': 'US', 'America/Indiana/Vevay': 'US',
  'America/Indiana/Vincennes': 'US', 'America/Indiana/Winamac': 'US',
  'America/Inuvik': 'CA', 'America/Iqaluit': 'CA', 'America/Jamaica': 'JM',
  'America/Juneau': 'US', 'America/Kentucky/Louisville': 'US',
  'America/Kentucky/Monticello': 'US', 'America/Kralendijk': 'BQ',
  'America/La_Paz': 'BO', 'America/Lima': 'PE', 'America/Los_Angeles': 'US',
  'America/Lower_Princes': 'SX', 'America/Maceio': 'BR', 'America/Managua': 'NI',
  'America/Manaus': 'BR', 'America/Marigot': 'MF', 'America/Martinique': 'MQ',
  'America/Matamoros': 'MX', 'America/Mazatlan': 'MX', 'America/Menominee': 'US',
  'America/Merida': 'MX', 'America/Metlakatla': 'US', 'America/Mexico_City': 'MX',
  'America/Miquelon': 'PM', 'America/Moncton': 'CA', 'America/Monterrey': 'MX',
  'America/Montevideo': 'UY', 'America/Montserrat': 'MS', 'America/Nassau': 'BS',
  'America/New_York': 'US', 'America/Nipigon': 'CA', 'America/Nome': 'US',
  'America/Noronha': 'BR', 'America/North_Dakota/Beulah': 'US',
  'America/North_Dakota/Center': 'US', 'America/North_Dakota/New_Salem': 'US',
  'America/Nuuk': 'GL', 'America/Ojinaga': 'MX', 'America/Panama': 'PA',
  'America/Pangnirtung': 'CA', 'America/Paramaribo': 'SR', 'America/Phoenix': 'US',
  'America/Port-au-Prince': 'HT', 'America/Port_of_Spain': 'TT',
  'America/Porto_Velho': 'BR', 'America/Puerto_Rico': 'PR',
  'America/Punta_Arenas': 'CL', 'America/Rainy_River': 'CA', 'America/Rankin_Inlet': 'CA',
  'America/Recife': 'BR', 'America/Regina': 'CA', 'America/Resolute': 'CA',
  'America/Rio_Branco': 'BR', 'America/Santarem': 'BR', 'America/Santiago': 'CL',
  'America/Santo_Domingo': 'DO', 'America/Sao_Paulo': 'BR', 'America/Scoresbysund': 'GL',
  'America/Sitka': 'US', 'America/St_Barthelemy': 'BL', 'America/St_Johns': 'CA',
  'America/St_Kitts': 'KN', 'America/St_Lucia': 'LC', 'America/St_Thomas': 'VI',
  'America/St_Vincent': 'VC', 'America/Swift_Current': 'CA', 'America/Tegucigalpa': 'HN',
  'America/Thule': 'GL', 'America/Thunder_Bay': 'CA', 'America/Tijuana': 'MX',
  'America/Toronto': 'CA', 'America/Tortola': 'VG', 'America/Vancouver': 'CA',
  'America/Whitehorse': 'CA', 'America/Winnipeg': 'CA', 'America/Yakutat': 'US',
  'America/Yellowknife': 'CA',
  
  // Asia
  'Asia/Aden': 'YE', 'Asia/Almaty': 'KZ', 'Asia/Amman': 'JO', 'Asia/Anadyr': 'RU',
  'Asia/Aqtau': 'KZ', 'Asia/Aqtobe': 'KZ', 'Asia/Ashgabat': 'TM', 'Asia/Atyrau': 'KZ',
  'Asia/Baghdad': 'IQ', 'Asia/Bahrain': 'BH', 'Asia/Baku': 'AZ', 'Asia/Bangkok': 'TH',
  'Asia/Barnaul': 'RU', 'Asia/Beirut': 'LB', 'Asia/Bishkek': 'KG', 'Asia/Brunei': 'BN',
  'Asia/Chita': 'RU', 'Asia/Choibalsan': 'MN', 'Asia/Colombo': 'LK', 'Asia/Damascus': 'SY',
  'Asia/Dhaka': 'BD', 'Asia/Dili': 'TL', 'Asia/Dubai': 'AE', 'Asia/Dushanbe': 'TJ',
  'Asia/Famagusta': 'CY', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Hong_Kong': 'HK', 'Asia/Hovd': 'MN', 'Asia/Irkutsk': 'RU', 'Asia/Jakarta': 'ID',
  'Asia/Jayapura': 'ID', 'Asia/Jerusalem': 'IL', 'Asia/Kabul': 'AF', 'Asia/Kamchatka': 'RU',
  'Asia/Karachi': 'PK', 'Asia/Kathmandu': 'NP', 'Asia/Khandyga': 'RU',
  'Asia/Kolkata': 'IN', 'Asia/Krasnoyarsk': 'RU', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY', 'Asia/Kuwait': 'KW', 'Asia/Macau': 'MO', 'Asia/Magadan': 'RU',
  'Asia/Makassar': 'ID', 'Asia/Manila': 'PH', 'Asia/Muscat': 'OM', 'Asia/Nicosia': 'CY',
  'Asia/Novokuznetsk': 'RU', 'Asia/Novosibirsk': 'RU', 'Asia/Omsk': 'RU',
  'Asia/Oral': 'KZ', 'Asia/Pontianak': 'ID', 'Asia/Pyongyang': 'KP',
  'Asia/Qatar': 'QA', 'Asia/Qostanay': 'KZ', 'Asia/Qyzylorda': 'KZ',
  'Asia/Riyadh': 'SA', 'Asia/Sakhalin': 'RU', 'Asia/Samarkand': 'UZ',
  'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Singapore': 'SG',
  'Asia/Srednekolymsk': 'RU', 'Asia/Taipei': 'TW', 'Asia/Tashkent': 'UZ',
  'Asia/Tbilisi': 'GE', 'Asia/Tehran': 'IR', 'Asia/Thimphu': 'BT', 'Asia/Tokyo': 'JP',
  'Asia/Tomsk': 'RU', 'Asia/Ulaanbaatar': 'MN', 'Asia/Urumqi': 'CN',
  'Asia/Ust-Nera': 'RU', 'Asia/Vladivostok': 'RU', 'Asia/Yakutsk': 'RU',
  'Asia/Yangon': 'MM', 'Asia/Yekaterinburg': 'RU', 'Asia/Yerevan': 'AM',
  
  // Europe
  'Europe/Amsterdam': 'NL', 'Europe/Andorra': 'AD', 'Europe/Astrakhan': 'RU',
  'Europe/Athens': 'GR', 'Europe/Belgrade': 'RS', 'Europe/Berlin': 'DE',
  'Europe/Bratislava': 'SK', 'Europe/Brussels': 'BE', 'Europe/Bucharest': 'RO',
  'Europe/Budapest': 'HU', 'Europe/Busingen': 'DE', 'Europe/Chisinau': 'MD',
  'Europe/Copenhagen': 'DK', 'Europe/Dublin': 'IE', 'Europe/Gibraltar': 'GI',
  'Europe/Guernsey': 'GG', 'Europe/Helsinki': 'FI', 'Europe/Isle_of_Man': 'IM',
  'Europe/Istanbul': 'TR', 'Europe/Jersey': 'JE', 'Europe/Kaliningrad': 'RU',
  'Europe/Kiev': 'UA', 'Europe/Kirov': 'RU', 'Europe/Lisbon': 'PT',
  'Europe/Ljubljana': 'SI', 'Europe/London': 'GB', 'Europe/Luxembourg': 'LU',
  'Europe/Madrid': 'ES', 'Europe/Malta': 'MT', 'Europe/Mariehamn': 'AX',
  'Europe/Minsk': 'BY', 'Europe/Monaco': 'MC', 'Europe/Moscow': 'RU',
  'Europe/Oslo': 'NO', 'Europe/Paris': 'FR', 'Europe/Podgorica': 'ME',
  'Europe/Prague': 'CZ', 'Europe/Riga': 'LV', 'Europe/Rome': 'IT',
  'Europe/Samara': 'RU', 'Europe/San_Marino': 'SM', 'Europe/Sarajevo': 'BA',
  'Europe/Saratov': 'RU', 'Europe/Simferopol': 'UA', 'Europe/Skopje': 'MK',
  'Europe/Sofia': 'BG', 'Europe/Stockholm': 'SE', 'Europe/Tallinn': 'EE',
  'Europe/Tirane': 'AL', 'Europe/Tiraspol': 'MD', 'Europe/Ulyanovsk': 'RU',
  'Europe/Uzhgorod': 'UA', 'Europe/Vaduz': 'LI', 'Europe/Vatican': 'VA',
  'Europe/Vienna': 'AT', 'Europe/Vilnius': 'LT', 'Europe/Volgograd': 'RU',
  'Europe/Warsaw': 'PL', 'Europe/Zagreb': 'HR', 'Europe/Zaporozhye': 'UA',
  'Europe/Zurich': 'CH',
  
  // Oceania/Pacific
  'Pacific/Apia': 'WS', 'Pacific/Auckland': 'NZ', 'Pacific/Bougainville': 'PG',
  'Pacific/Chatham': 'NZ', 'Pacific/Chuuk': 'FM', 'Pacific/Easter': 'CL',
  'Pacific/Efate': 'VU', 'Pacific/Enderbury': 'KI', 'Pacific/Fakaofo': 'TK',
  'Pacific/Fiji': 'FJ', 'Pacific/Funafuti': 'TV', 'Pacific/Galapagos': 'EC',
  'Pacific/Gambier': 'PF', 'Pacific/Guadalcanal': 'SB', 'Pacific/Guam': 'GU',
  'Pacific/Honolulu': 'US', 'Pacific/Kiritimati': 'KI', 'Pacific/Kosrae': 'FM',
  'Pacific/Kwajalein': 'MH', 'Pacific/Majuro': 'MH', 'Pacific/Marquesas': 'PF',
  'Pacific/Midway': 'US', 'Pacific/Nauru': 'NR', 'Pacific/Niue': 'NU',
  'Pacific/Norfolk': 'NF', 'Pacific/Noumea': 'NC', 'Pacific/Pago_Pago': 'AS',
  'Pacific/Palau': 'PW', 'Pacific/Pitcairn': 'PN', 'Pacific/Pohnpei': 'FM',
  'Pacific/Port_Moresby': 'PG', 'Pacific/Rarotonga': 'CK', 'Pacific/Saipan': 'MP',
  'Pacific/Tahiti': 'PF', 'Pacific/Tarawa': 'KI', 'Pacific/Tongatapu': 'TO',
  'Pacific/Wake': 'UM', 'Pacific/Wallis': 'WF',
  
  // Australia
  'Australia/Adelaide': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Broken_Hill': 'AU',
  'Australia/Currie': 'AU', 'Australia/Darwin': 'AU', 'Australia/Eucla': 'AU',
  'Australia/Hobart': 'AU', 'Australia/Lindeman': 'AU', 'Australia/Lord_Howe': 'AU',
  'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU', 'Australia/Sydney': 'AU',
  
  // Atlantic
  'Atlantic/Azores': 'PT', 'Atlantic/Bermuda': 'BM', 'Atlantic/Canary': 'ES',
  'Atlantic/Cape_Verde': 'CV', 'Atlantic/Faroe': 'FO', 'Atlantic/Madeira': 'PT',
  'Atlantic/Reykjavik': 'IS', 'Atlantic/South_Georgia': 'GS',
  'Atlantic/St_Helena': 'SH', 'Atlantic/Stanley': 'FK',
  
  // Indian Ocean
  'Indian/Antananarivo': 'MG', 'Indian/Chagos': 'IO', 'Indian/Christmas': 'CX',
  'Indian/Cocos': 'CC', 'Indian/Comoro': 'KM', 'Indian/Kerguelen': 'TF',
  'Indian/Mahe': 'SC', 'Indian/Maldives': 'MV', 'Indian/Mauritius': 'MU',
  'Indian/Mayotte': 'YT', 'Indian/Reunion': 'RE',
  
  // Antarctica
  'Antarctica/Casey': 'AQ', 'Antarctica/Davis': 'AQ', 'Antarctica/DumontDUrville': 'AQ',
  'Antarctica/Macquarie': 'AU', 'Antarctica/Mawson': 'AQ', 'Antarctica/McMurdo': 'AQ',
  'Antarctica/Palmer': 'AQ', 'Antarctica/Rothera': 'AQ', 'Antarctica/Syowa': 'AQ',
  'Antarctica/Troll': 'AQ', 'Antarctica/Vostok': 'AQ',
};

// Default exchange rates (comprehensive fallback for all currencies)
const defaultRates: Record<string, number> = {
  // Major currencies
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.50, CNY: 7.24, CHF: 0.88,
  AUD: 1.53, CAD: 1.36, NZD: 1.64,
  
  // African currencies
  KES: 153.50, NGN: 1550, GHS: 12.50, ZAR: 18.50, UGX: 3800, TZS: 2500,
  RWF: 1300, ETB: 55, EGP: 30.90, MAD: 10, TND: 3.1, DZD: 135, LYD: 4.8,
  SDG: 600, ZWL: 3500, ZMW: 24, MWK: 1700, MZN: 63.5, BWP: 13.5, NAD: 18.5,
  SZL: 18.5, LSL: 18.5, MGA: 4500, SCR: 14.5, MUR: 46, MRU: 40, SLL: 22000,
  GMD: 68, GNF: 8500, BIF: 2850, DJF: 178, SOS: 570, ERN: 15, CDF: 2800,
  AOQ: 850, CVE: 102, STN: 24, XOF: 605, XAF: 605,
  
  // Asian currencies
  INR: 83.12, PKR: 278, BDT: 110, LKR: 325, NPR: 133, BTN: 83.12, MMK: 2100,
  THB: 35.50, VND: 24500, IDR: 15800, MYR: 4.72, SGD: 1.34, PHP: 56,
  HKD: 7.82, TWD: 31.50, KRW: 1330, KPW: 900, MOP: 8, BND: 1.34, KHR: 4100,
  LAK: 21000, AFN: 85, MVR: 15.4, TL: 1.00,
  
  // Middle Eastern currencies
  AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.38,
  ILS: 3.65, TRY: 32, IRR: 42000, IQD: 1310, SYP: 13000, LBP: 89500,
  JOD: 0.71, YER: 250,
  
  // European currencies
  RUB: 92, PLN: 4, CZK: 23, HUF: 355, RON: 4.6, BGN: 1.8, HRK: 7,
  SEK: 10.5, NOK: 10.5, DKK: 6.9, ISK: 138, UAH: 37, BYN: 3.3, MDL: 17.5,
  MKD: 58, RSD: 110, ALL: 95, BAM: 1.8, GEL: 2.7, AMD: 385, AZN: 1.7,
  KZT: 450, KGS: 89, UZS: 12500, TJS: 11, TMT: 3.5,
  
  // North & South American currencies
  BRL: 4.97, ARS: 900, CLP: 920, COP: 4000, PEN: 3.72, MXN: 17, VEF: 36,
  BOB: 6.9, PYG: 7500, UYU: 39, GYD: 210, SRD: 35, BZD: 2, GTQ: 7.8,
  HNL: 24.5, NIO: 36.5, CRC: 530, PAB: 1, JMD: 155, HTG: 130, DOP: 58,
  CUP: 24, CUC: 1, BBD: 2, XCD: 2.7, TTD: 6.8, BMD: 1, KYD: 0.83, BSD: 1,
  
  // Pacific & Oceania currencies
  FJD: 2.3, WST: 2.7, TOP: 2.4, VUV: 118, SBD: 8.3, PGK: 3.8, XPF: 110,
};

// ============================================
// CURRENCY STORE - With Live Exchange Rates & Auto-Detection
// Supports ALL worldwide currencies with automatic location detection
// ============================================

interface CurrencyState {
  currency: string;
  countryCode: string;
  dialCode: string;
  rates: Record<string, number>;
  lastUpdated: number | null;
  isLoading: boolean;
  detectedLocation: boolean;
  setCurrency: (currency: string) => void;
  setCountry: (countryCode: string) => void;
  formatPrice: (price: number) => string;
  fetchRates: () => Promise<void>;
  detectLocation: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: 'KES',
      countryCode: 'KE',
      dialCode: '+254',
      rates: defaultRates,
      lastUpdated: null,
      isLoading: false,
      detectedLocation: false,
      
      setCurrency: (currency) => set({ currency }),
      setCountry: (countryCode) => {
        const currency = countryToCurrency[countryCode] || 'KES';
        const dialCode = countryToDialCode[countryCode] || '+254';
        set({ countryCode, currency, dialCode });
      },
      
      detectLocation: async () => {
        const { detectedLocation } = get();
        if (detectedLocation) return; // Already detected
        
        set({ isLoading: true });
        
        try {
          // First try timezone detection (fast, no permission needed)
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          let countryCode = timezoneToCountry[timezone] || 'KE';
          
          // Try geolocation API for more precise detection
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: false,
                  timeout: 5000,
                  maximumAge: 86400000, // Cache for 24 hours
                });
              });
              
              const { latitude, longitude } = position.coords;
              
              // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key)
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=3`,
                {
                  headers: {
                    'Accept-Language': 'en',
                  },
                }
              );
              
              if (response.ok) {
                const data = await response.json();
                const detectedCountry = data.address?.country_code?.toUpperCase();
                if (detectedCountry && countryToCurrency[detectedCountry]) {
                  countryCode = detectedCountry;
                }
              }
            } catch {
              // Geolocation failed or denied, use timezone result
              console.log('Geolocation not available, using timezone detection');
            }
          }
          
          // Fallback to IP-based detection using a free service
          if (countryCode === 'US') {
            try {
              const ipResponse = await fetch('https://ipapi.co/json/', {
                signal: AbortSignal.timeout(3000),
              });
              if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                const ipCountry = ipData.country_code;
                if (ipCountry && countryToCurrency[ipCountry]) {
                  countryCode = ipCountry;
                }
              }
            } catch {
              // IP detection failed, continue with current result
            }
          }
          
          const currency = countryToCurrency[countryCode] || 'KES';
          const dialCode = countryToDialCode[countryCode] || '+254';
          
          set({ 
            countryCode, 
            currency, 
            dialCode, 
            detectedLocation: true,
            isLoading: false 
          });
        } catch {
          // Default to US
          set({ 
            countryCode: 'KE', 
            currency: 'KES', 
            dialCode: '+254',  
            detectedLocation: true,
            isLoading: false 
          });
        }
      },
      
      fetchRates: async () => {
        const { lastUpdated } = get();
        const now = Date.now();
        if (lastUpdated && now - lastUpdated < 3600000) {
          return;
        }
        
        set({ isLoading: true });
        
        try {
          const response = await fetch(
            'https://api.exchangerate-api.com/v4/latest/USD'
          );
          
          if (!response.ok) throw new Error('Failed to fetch rates');
          
          const data = await response.json();
          const newRates: Record<string, number> = { USD: 1 };
          
          Object.keys(currencyMeta).forEach((currency) => {
            if (data.rates && data.rates[currency]) {
              newRates[currency] = data.rates[currency];
            }
          });
          
          set({ 
            rates: newRates, 
            lastUpdated: now,
            isLoading: false 
          });
        } catch (error) {
          console.warn('Failed to fetch live exchange rates, using defaults:', error);
          set({ 
            rates: defaultRates, 
            lastUpdated: now,
            isLoading: false 
          });
        }
      },
      
      formatPrice: (price) => {
        const { currency, rates } = get();
        const meta = currencyMeta[currency] || currencyMeta.USD;
        const rate = rates[currency] || 1;
        const convertedPrice = price * rate;
        
        const noDecimalCurrencies = ['JPY', 'KES', 'NGN', 'UGX', 'TZS', 'RWF', 'VND', 
          'IDR', 'KRW', 'XOF', 'XAF', 'BIF', 'DJF', 'GNF', 'KMF', 'CDF', 'MGA', 'PYG',
          'ISK', 'VUV', 'XPF', 'LAK', 'MMK', 'COP', 'CLP'];
        const maxDecimals = noDecimalCurrencies.includes(currency) ? 0 : 2;
        
        return `${meta.symbol}${convertedPrice.toLocaleString(meta.locale, { 
          minimumFractionDigits: 0, 
          maximumFractionDigits: maxDecimals 
        })}`;
      },
    }),
    {
      name: 'styra-currency',
      partialize: (state) => ({ 
        currency: state.currency,
        countryCode: state.countryCode,
        dialCode: state.dialCode,
        rates: state.rates,
        lastUpdated: state.lastUpdated,
        detectedLocation: state.detectedLocation,
      }),
    }
  )
);

// Helper functions for getting country/currency information
export function getCountryInfo(countryCode: string) {
  return {
    name: countryNames[countryCode] || countryCode,
    currency: countryToCurrency[countryCode] || 'KES',
    dialCode: countryToDialCode[countryCode] || '+254',
    currencyInfo: currencyMeta[countryToCurrency[countryCode] || 'USD'],
  };
}

export function getAllCountries() {
  return Object.keys(countryNames).map((code) => ({
    code,
    name: countryNames[code],
    currency: countryToCurrency[code],
    dialCode: countryToDialCode[code],
    currencySymbol: currencyMeta[countryToCurrency[code]]?.symbol || '$',
    currencyName: currencyMeta[countryToCurrency[code]]?.name || 'US Dollar',
  }));
}

export function getCountriesByCurrency(currency: string) {
  return Object.entries(countryToCurrency)
    .filter(([_, curr]) => curr === currency)
    .map(([code, _]) => ({
      code,
      name: countryNames[code],
      dialCode: countryToDialCode[code],
    }));
}

// ============================================
// BUSINESS DATA STORE (for real-time sync)
// ============================================

// Define Service and Staff types inline for the store
interface LocalService {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  category: string;
  duration: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalStaff {
  id: string;
  businessId: string;
  name: string;
  role: string;
  bio?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface BusinessDataState {
  businesses: Record<string, {
    id: string;
    name: string;
    description: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    country: string;
    website: string;
    latitude: number | null;
    longitude: number | null;
    isActive: boolean;
    hours: {
      weekday: string;
      saturday: string;
      sunday: string;
    };
    services: LocalService[];
    staff: LocalStaff[];
    rating: number;
    reviewCount: number;
    updatedAt: Date;
  }>;
  updateBusiness: (id: string, data: Partial<BusinessDataState['businesses'][string]>) => void;
  getBusiness: (id: string) => BusinessDataState['businesses'][string] | undefined;
  toggleBusinessActive: (id: string) => void;
}

// TODO: Seed from API instead of hardcoding business data
const initialBusinesses: BusinessDataState['businesses'] = {};

export const useBusinessDataStore = create<BusinessDataState>()(
  persist(
    (set, get) => ({
      businesses: initialBusinesses,
      updateBusiness: (id, data) => set((state) => ({
        businesses: {
          ...state.businesses,
          [id]: {
            ...state.businesses[id],
            ...data,
            updatedAt: new Date(),
          } as BusinessDataState['businesses'][string],
        },
      })),
      getBusiness: (id) => get().businesses[id],
      toggleBusinessActive: (id) => set((state) => ({
        businesses: {
          ...state.businesses,
          [id]: {
            ...state.businesses[id],
            isActive: !state.businesses[id]?.isActive,
            updatedAt: new Date(),
          } as BusinessDataState['businesses'][string],
        },
      })),
    }),
    {
      name: 'styra-business-data',
    }
  )
);

// ============================================
// ADMIN STORE (for business applications)
// ============================================

interface BusinessApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  // ID Verification
  idType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';
  idNumber: string;
  idDocumentUrl?: string;
  // Business Details
  businessName: string;
  businessDescription?: string;
  businessAddress?: string;
  businessCity?: string;
  businessCountry?: string;
  businessWebsite?: string;
  businessPhone?: string;
  businessEmail?: string;
  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

interface AdminState {
  applications: BusinessApplication[];
  isLoading: boolean;
  // Actions
  addApplication: (application: BusinessApplication) => void;
  updateApplication: (id: string, data: Partial<BusinessApplication>) => void;
  approveApplication: (id: string, adminId: string) => void;
  rejectApplication: (id: string, adminId: string, reason: string) => void;
  getPendingApplications: () => BusinessApplication[];
  getApplicationByUserId: (userId: string) => BusinessApplication | undefined;
  setLoading: (loading: boolean) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      applications: [],
      isLoading: false,
      
      addApplication: (application) => set((state) => ({
        applications: [...state.applications, application]
      })),
      
      updateApplication: (id, data) => set((state) => ({
        applications: state.applications.map((app) =>
          app.id === id ? { ...app, ...data } : app
        )
      })),
      
      approveApplication: (id, adminId) => set((state) => ({
        applications: state.applications.map((app) =>
          app.id === id
            ? { ...app, status: 'APPROVED', reviewedAt: new Date(), reviewedBy: adminId }
            : app
        )
      })),
      
      rejectApplication: (id, adminId, reason) => set((state) => ({
        applications: state.applications.map((app) =>
          app.id === id
            ? { ...app, status: 'REJECTED', reviewedAt: new Date(), reviewedBy: adminId, rejectionReason: reason }
            : app
        )
      })),
      
      getPendingApplications: () => get().applications.filter((app) => app.status === 'PENDING'),
      
      getApplicationByUserId: (userId) => get().applications.find((app) => app.userId === userId),
      
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'styra-admin',
    }
  )
);

// ============================================
// RE-EXPORT MONETIZATION STORES
// ============================================

export {
  useCommissionStore,
  useTransactionStore,
  usePayoutStore,
  usePremiumListingsStore,
  useDiscountCodesStore,
  useRevenueStore,
  useMonetizationStore,
} from './monetization';
