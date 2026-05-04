// Styra Types

export type UserRole = 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';

/**
 * Role constants — use these everywhere instead of raw strings.
 * All values are UPPERCASE to match the database convention.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  CUSTOMER: 'CUSTOMER',
} as const;

/** All valid role values for validation */
export const VALID_ROLES: readonly string[] = Object.values(ROLES);

// User can have multiple roles and an active mode
export type UserMode = 'CLIENT' | 'PROVIDER' | 'ADMIN';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type SubscriptionPlan = 'FREE' | 'PREMIUM' | 'FEATURED';

export type MediaType = 'IMAGE' | 'VIDEO';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type PaymentMethod = 'STRIPE' | 'PAYPAL' | 'MPESA';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type NotificationType = 
  | 'BOOKING_CONFIRMED' 
  | 'BOOKING_CANCELLED' 
  | 'BOOKING_REMINDER' 
  | 'PAYMENT_SUCCESS' 
  | 'PAYMENT_FAILED' 
  | 'NEW_MESSAGE' 
  | 'NEW_REVIEW' 
  | 'SYSTEM_ALERT' 
  | 'VERIFICATION_UPDATE';

// User
export interface User {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  avatar?: string;
  role: UserRole; // Primary role for backwards compatibility
  roles: UserRole[]; // Array of all roles the user has
  activeMode: UserMode; // Current active mode (CLIENT, PROVIDER, or ADMIN)
  defaultMode?: UserMode; // User's preferred default mode on login
  emailVerified?: Date;
  phoneVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Business owner verification
  businessVerificationStatus?: VerificationStatus;
  idType?: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';
  idNumber?: string;
  idDocumentUrl?: string;
  idVerifiedAt?: Date;
  // Business details (for onboarding)
  businessName?: string;
  businessDescription?: string;
  businessAddress?: string;
  businessCity?: string;
  businessCountry?: string;
  businessWebsite?: string;
  // Client-specific data
  clientData?: {
    totalBookings: number;
    totalSpent: number;
    reviewsGiven: number;
    favoritesCount: number;
  };
  // Provider-specific data
  providerData?: {
    totalEarnings: number;
    totalBookings: number;
    averageRating: number;
    totalReviews: number;
    isVerified: boolean;
  };
}

// Business
export interface Business {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  serviceRadius: number;
  verificationStatus: VerificationStatus;
  subscriptionPlan: SubscriptionPlan;
  rating: number;
  reviewCount: number;
  totalEarnings: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner?: User;
  services?: Service[];
  staff?: Staff[];
  portfolio?: PortfolioItem[];
  reviews?: Review[];
}

// Service
export interface Service {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  category: string;
  duration: number;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  business?: Business;
}

// Staff
export interface Staff {
  id: string;
  businessId: string;
  name: string;
  avatar?: string;
  role: string;
  bio?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Portfolio Item
export interface PortfolioItem {
  id: string;
  businessId: string;
  mediaType: MediaType;
  fileUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  tags?: string[];
  isFeatured: boolean;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

// Booking
export interface Booking {
  id: string;
  customerId: string;
  businessId: string;
  serviceId: string;
  staffId?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes?: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  customer?: User;
  business?: Business;
  service?: Service;
  staff?: Staff;
  payment?: Payment;
  review?: Review;
}

// Payment
export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Review
export interface Review {
  id: string;
  customerId: string;
  businessId: string;
  bookingId: string;
  rating: number;
  comment?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  customer?: User;
  business?: Business;
}

// Favorite
export interface Favorite {
  id: string;
  userId: string;
  businessId: string;
  createdAt: Date;
  business?: Business;
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

// Chat
export interface Conversation {
  id: string;
  businessId: string;
  customerId: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  business?: Business;
  customer?: User;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  sender?: User;
  receiver?: User;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter Types
export interface BusinessFilters {
  search?: string;
  category?: string;
  city?: string;
  minRating?: number;
  maxPrice?: number;
  minPrice?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  verificationStatus?: VerificationStatus;
  sortBy?: 'rating' | 'price' | 'distance' | 'reviews';
  sortOrder?: 'asc' | 'desc';
}

export interface BookingFilters {
  status?: BookingStatus;
  dateFrom?: string;
  dateTo?: string;
  businessId?: string;
  customerId?: string;
}

// Service Categories
export const SERVICE_CATEGORIES = [
  'Haircuts & Styling',
  'Beard Grooming',
  'Hair Coloring',
  'Nail Services',
  'Skin Care',
  'Makeup',
  'Spa & Wellness',
  'Massage',
  'Barber Services',
  'Hair Extensions',
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

// Dashboard Stats
export interface DashboardStats {
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  totalServices: number;
  pendingBookings: number;
  completedBookings: number;
  averageRating: number;
  totalReviews: number;
}

export interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalBookings: number;
  totalRevenue: number;
  pendingVerifications: number;
  activeSubscriptions: number;
}
