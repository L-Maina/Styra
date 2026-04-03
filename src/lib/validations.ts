import { z } from 'zod';

// Auth validations
export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(254, 'Email must be less than 254 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(254, 'Email must be less than 254 characters'),
  password: z.string().min(1, 'Password is required').max(128, 'Password must be less than 128 characters'),
});

export const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(254, 'Email must be less than 254 characters'),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
});

// Business validations
export const createBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(5000, 'Description must be less than 5000 characters').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').max(20, 'Phone must be less than 20 characters').optional(),
  email: z.string().email('Invalid email address').max(254, 'Email must be less than 254 characters').optional(),
  website: z.string().url('Invalid website URL').optional(),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  country: z.string().min(2, 'Country must be at least 2 characters'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  serviceRadius: z.number().min(1).max(100).default(10),
});

export const updateBusinessSchema = createBusinessSchema.partial();

// Service validations
export const createServiceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(5000, 'Description must be less than 5000 characters').optional(),
  category: z.string().min(1, 'Category is required'),
  duration: z.number().min(5, 'Duration must be at least 5 minutes').max(480, 'Duration cannot exceed 8 hours'),
  price: z.number().min(0, 'Price must be non-negative'),
  discountPrice: z.number().min(0).optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

// TimeSlot validations
export const createTimeSlotSchema = z.object({
  serviceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time format'),
});

// Booking validations
export const createBookingSchema = z.object({
  businessId: z.string(),
  serviceId: z.string(),
  staffId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time format'),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
}).refine(data => {
  if (data.date) {
    const bookingDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate >= today;
  }
  return true;
}, { message: 'Booking date cannot be in the past', path: ['date'] });

export const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
});

// Payment validations
export const createPaymentSchema = z.object({
  bookingId: z.string(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('KES'),
  paymentMethod: z.enum(['STRIPE', 'PAYPAL', 'MPESA']),
});

// Payment Intent validation (amount comes from booking total, not client)
export const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1),
  paymentMethod: z.enum(['STRIPE', 'PAYPAL', 'MPESA']),
  currency: z.string().default('KES'),
});

// Admin manual payment update validation
export const updatePaymentSchema = z.object({
  newStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']),
  adminNotes: z.string().max(1000).optional(),
});

// Review validations
export const createReviewSchema = z.object({
  businessId: z.string(),
  bookingId: z.string(),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(2000, 'Comment must be less than 2000 characters').optional(),
});

// Staff validations
export const createStaffSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  role: z.string().min(1, 'Role is required').max(100, 'Role must be less than 100 characters'),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters').optional(),
  role: z.string().min(1, 'Role is required').max(100, 'Role must be less than 100 characters').optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

// Portfolio validations
export const createPortfolioSchema = z.object({
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  fileUrl: z.string().url('Invalid file URL'),
  thumbnailUrl: z.string().url().optional(),
  caption: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
});

// Chat validations
export const sendMessageSchema = z.object({
  conversationId: z.string(),
  receiverId: z.string(),
  content: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
});

export const createConversationSchema = z.object({
  businessId: z.string(),
});

// Notification validations
export const markNotificationReadSchema = z.object({
  notificationId: z.string(),
});

// Admin validations
export const updateBusinessStatusSchema = z.object({
  verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
  reason: z.string().max(2000, 'Reason must be less than 2000 characters').optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Search schema
export const searchBusinessSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  minRating: z.number().min(0).max(5).optional(),
  maxPrice: z.number().min(0).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius: z.number().min(1).max(100).optional(),
  ...paginationSchema.shape,
});

// ID validation
export const idSchema = z.object({
  id: z.string(),
});
