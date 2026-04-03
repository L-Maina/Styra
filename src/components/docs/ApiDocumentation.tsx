'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  BookOpen,
  Shield,
  Lock,
  Building2,
  Calendar,
  CreditCard,
  Scissors,
  MessageSquare,
  Bell,
  Wallet,
  Settings,
  Webhook,
  Copy,
  Check,
  Filter,
  Menu,
  X,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiDocumentationProps {
  onBack: () => void;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthLevel = 'Public' | 'Auth' | 'Business Owner' | 'Admin';

interface QueryParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface StatusCode {
  code: number;
  description: string;
}

interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  auth: AuthLevel;
  description: string;
  requestBody?: string;
  queryParameters?: QueryParam[];
  responseExample: string;
  statusCodes: StatusCode[];
}

interface ApiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  endpoints: ApiEndpoint[];
}

// ─── Method Colors ────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  POST: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  PUT: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  PATCH: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  DELETE: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
};

const AUTH_COLORS: Record<AuthLevel, string> = {
  Public: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Auth: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Business Owner': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Admin: 'bg-red-500/20 text-red-300 border-red-500/30',
};

// ─── API Data ─────────────────────────────────────────────────────────────────

const API_CATEGORIES: ApiCategory[] = [
  // ── Authentication ────────────────────────────────────────────────────────
  {
    id: 'authentication',
    name: 'Authentication',
    icon: <Lock className="h-4 w-4" />,
    description: 'User authentication, registration, and session management',
    endpoints: [
      {
        id: 'auth-login',
        method: 'POST',
        path: '/api/auth/login',
        auth: 'Public',
        description: 'Authenticate a user with email and password. Returns a session cookie and CSRF token on success. Rate limited to 5 attempts per 15 minutes.',
        requestBody: JSON.stringify(
          {
            email: 'user@example.com',
            password: 'SecurePass123',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'usr_a1b2c3d4e5',
              email: 'user@example.com',
              name: 'John Doe',
              role: 'CUSTOMER',
              activeMode: 'CLIENT',
              emailVerified: true,
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Login successful' },
          { code: 401, description: 'Invalid email or password' },
          { code: 423, description: 'Account temporarily locked (10+ failed attempts)' },
          { code: 429, description: 'Rate limit exceeded' },
        ],
      },
      {
        id: 'auth-register',
        method: 'POST',
        path: '/api/auth/register',
        auth: 'Public',
        description: 'Create a new user account. Sends email verification token. Rate limited to 3 attempts per hour. No session created until email is verified.',
        requestBody: JSON.stringify(
          {
            name: 'John Doe',
            email: 'user@example.com',
            password: 'SecurePass123',
            phone: '+254712345678',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'usr_f6g7h8i9j0',
              email: 'user@example.com',
              name: 'John Doe',
              role: 'CUSTOMER',
              verificationToken: 'vt_abc123xyz',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Account created, verification email sent' },
          { code: 400, description: 'Invalid registration data or weak password' },
          { code: 409, description: 'Email or phone already registered' },
          { code: 429, description: 'Rate limit exceeded' },
        ],
      },
      {
        id: 'auth-verify-otp',
        method: 'POST',
        path: '/api/auth/verify-otp',
        auth: 'Public',
        description: 'Verify a one-time password sent to the user phone number. Rate limited to 5 attempts per 15 minutes.',
        requestBody: JSON.stringify(
          {
            phone: '+254712345678',
            otp: '123456',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'OTP verified successfully' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'OTP verified' },
          { code: 400, description: 'Invalid or expired OTP' },
          { code: 429, description: 'Rate limit exceeded' },
        ],
      },
      {
        id: 'auth-verify-email',
        method: 'POST',
        path: '/api/auth/verify-email',
        auth: 'Public',
        description: 'Verify user email with the token sent during registration. Creates a session and CSRF token on success.',
        requestBody: JSON.stringify(
          {
            token: 'vt_abc123xyz',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'usr_f6g7h8i9j0',
              email: 'user@example.com',
              name: 'John Doe',
              role: 'CUSTOMER',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Email verified, session created' },
          { code: 400, description: 'Invalid or expired token' },
        ],
      },
      {
        id: 'auth-forgot-password',
        method: 'POST',
        path: '/api/auth/forgot-password',
        auth: 'Public',
        description: 'Request a password reset link. Rate limited to 3 requests per hour.',
        requestBody: JSON.stringify(
          {
            email: 'user@example.com',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'Password reset link sent to your email' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Reset link sent' },
          { code: 400, description: 'Valid email required' },
          { code: 429, description: 'Rate limit exceeded' },
        ],
      },
      {
        id: 'auth-reset-password',
        method: 'POST',
        path: '/api/auth/reset-password',
        auth: 'Public',
        description: 'Reset password using the token from the reset email. Rate limited to 5 attempts per hour.',
        requestBody: JSON.stringify(
          {
            token: 'reset_token_xyz',
            password: 'NewSecurePass456',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'Password reset successfully' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Password reset successful' },
          { code: 400, description: 'Invalid or expired token' },
          { code: 429, description: 'Rate limit exceeded' },
        ],
      },
      {
        id: 'auth-logout',
        method: 'POST',
        path: '/api/auth/logout',
        auth: 'Auth',
        description: 'Clear the current session and invalidate the auth cookie.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'Logged out successfully' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Logged out successfully' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
    ],
  },

  // ── Businesses ────────────────────────────────────────────────────────────
  {
    id: 'businesses',
    name: 'Businesses',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Search, create, and manage grooming businesses',
    endpoints: [
      {
        id: 'businesses-list',
        method: 'GET',
        path: '/api/businesses',
        auth: 'Public',
        description: 'List and search approved businesses with filtering, sorting, and pagination. Only returns active, approved businesses.',
        queryParameters: [
          { name: 'query', type: 'string', required: false, description: 'Search by name or description' },
          { name: 'category', type: 'string', required: false, description: 'Filter by service category' },
          { name: 'city', type: 'string', required: false, description: 'Filter by city' },
          { name: 'minRating', type: 'number', required: false, description: 'Minimum rating filter (e.g. 4.0)' },
          { name: 'sortBy', type: 'string', required: false, description: 'rating | price | distance | createdAt | name' },
          { name: 'sortOrder', type: 'string', required: false, description: 'asc | desc' },
          { name: 'lat', type: 'number', required: false, description: 'Latitude for distance filtering' },
          { name: 'lng', type: 'number', required: false, description: 'Longitude for distance filtering' },
          { name: 'radius', type: 'number', required: false, description: 'Radius in km for distance filter' },
          { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page (default: 20, max: 100)' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'biz_k1l2m3n4',
                name: 'Elite Cuts Studio',
                slug: 'elite-cuts-studio',
                description: 'Premium grooming services',
                city: 'Nairobi',
                rating: 4.8,
                reviewCount: 124,
                latitude: -1.2921,
                longitude: 36.8219,
                services: [
                  { id: 'svc_a1', name: 'Classic Haircut', price: 500, duration: 30, category: 'Hair' },
                ],
              },
            ],
            pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of businesses' },
          { code: 400, description: 'Invalid query parameters' },
        ],
      },
      {
        id: 'businesses-detail',
        method: 'GET',
        path: '/api/businesses/[id]',
        auth: 'Public',
        description: 'Get detailed information about a specific business including all active services and staff.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'biz_k1l2m3n4',
              name: 'Elite Cuts Studio',
              slug: 'elite-cuts-studio',
              description: 'Premium grooming services in Nairobi',
              phone: '+254712345678',
              email: 'info@elitecuts.co.ke',
              website: 'https://elitecuts.co.ke',
              address: '123 Kenyatta Ave',
              city: 'Nairobi',
              country: 'Kenya',
              rating: 4.8,
              reviewCount: 124,
              latitude: -1.2921,
              longitude: 36.8219,
              serviceRadius: 10,
              services: [],
              staff: [],
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Business details' },
          { code: 404, description: 'Business not found' },
        ],
      },
      {
        id: 'businesses-create',
        method: 'POST',
        path: '/api/businesses',
        auth: 'Business Owner',
        description: 'Create a new business. Requires BUSINESS_OWNER role. Only one business per user (409 if already registered).',
        requestBody: JSON.stringify(
          {
            name: 'Elite Cuts Studio',
            description: 'Premium grooming services',
            phone: '+254712345678',
            email: 'info@elitecuts.co.ke',
            website: 'https://elitecuts.co.ke',
            address: '123 Kenyatta Ave',
            city: 'Nairobi',
            country: 'Kenya',
            latitude: -1.2921,
            longitude: 36.8219,
            serviceRadius: 10,
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'biz_new123',
              name: 'Elite Cuts Studio',
              verificationStatus: 'PENDING',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Business created' },
          { code: 400, description: 'Invalid data' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Requires BUSINESS_OWNER role' },
          { code: 409, description: 'Business already registered for this user' },
        ],
      },
      {
        id: 'businesses-update',
        method: 'PATCH',
        path: '/api/businesses/[id]',
        auth: 'Business Owner',
        description: 'Update business details. Only the business owner or admin can update.',
        requestBody: JSON.stringify(
          {
            name: 'Elite Cuts Studio - Updated',
            description: 'Updated description',
            phone: '+254712345679',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'biz_k1l2m3n4', name: 'Elite Cuts Studio - Updated' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Business updated' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not the owner' },
          { code: 404, description: 'Business not found' },
        ],
      },
      {
        id: 'businesses-delete',
        method: 'DELETE',
        path: '/api/businesses/[id]',
        auth: 'Business Owner',
        description: 'Delete a business. Only the business owner or admin can delete.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'Business deleted successfully' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Business deleted' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not the owner' },
          { code: 404, description: 'Business not found' },
        ],
      },
    ],
  },

  // ── Bookings ───────────────────────────────────────────────────────────────
  {
    id: 'bookings',
    name: 'Bookings',
    icon: <Calendar className="h-4 w-4" />,
    description: 'Create, manage, and track service bookings',
    endpoints: [
      {
        id: 'bookings-list',
        method: 'GET',
        path: '/api/bookings',
        auth: 'Auth',
        description: 'List bookings for the authenticated user. Customers see their own bookings; business owners see bookings for their business; admins see all.',
        queryParameters: [
          { name: 'status', type: 'string', required: false, description: 'PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW' },
          { name: 'businessId', type: 'string', required: false, description: 'Filter by business' },
          { name: 'fromDate', type: 'string', required: false, description: 'Start date filter (YYYY-MM-DD)' },
          { name: 'toDate', type: 'string', required: false, description: 'End date filter (YYYY-MM-DD)' },
          { name: 'search', type: 'string', required: false, description: 'Search by business or service name' },
          { name: 'sortBy', type: 'string', required: false, description: 'date | price | status' },
          { name: 'sortOrder', type: 'string', required: false, description: 'asc | desc' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'bkg_abc123',
                status: 'CONFIRMED',
                date: '2025-01-15',
                startTime: '10:00',
                endTime: '10:30',
                totalAmount: 500,
                business: { id: 'biz_1', name: 'Elite Cuts' },
                service: { id: 'svc_1', name: 'Classic Haircut', price: 500, duration: 30 },
                staff: { id: 'stf_1', name: 'Mike' },
              },
            ],
            pagination: { page: 1, limit: 20, total: 12, totalPages: 1 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of bookings' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
      {
        id: 'bookings-create',
        method: 'POST',
        path: '/api/bookings',
        auth: 'Auth',
        description: 'Create a new booking. Uses DB transaction to prevent double-booking. Requires email verification. The service must belong to the specified business and staff (if provided) must belong to the business.',
        requestBody: JSON.stringify(
          {
            businessId: 'biz_k1l2m3n4',
            serviceId: 'svc_a1b2c3',
            staffId: 'stf_d4e5f6',
            date: '2025-01-20',
            startTime: '14:00',
            endTime: '14:30',
            notes: 'First time visit',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'bkg_new789',
              status: 'PENDING',
              date: '2025-01-20',
              startTime: '14:00',
              endTime: '14:30',
              totalAmount: 500,
              business: { id: 'biz_k1l2m3n4', name: 'Elite Cuts Studio' },
              service: { id: 'svc_a1b2c3', name: 'Classic Haircut', price: 500 },
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Booking created' },
          { code: 400, description: 'Invalid data or business/service mismatch' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Email not verified' },
          { code: 404, description: 'Service not found' },
          { code: 409, description: 'Time slot unavailable' },
        ],
      },
      {
        id: 'bookings-detail',
        method: 'GET',
        path: '/api/bookings/[id]',
        auth: 'Auth',
        description: 'Get detailed booking information including customer, business, service, staff, and payment details. Only accessible by the booking customer or business owner.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'bkg_abc123',
              status: 'CONFIRMED',
              date: '2025-01-15',
              startTime: '10:00',
              endTime: '10:30',
              totalAmount: 500,
              notes: 'Trim sides short',
              customer: { id: 'usr_1', name: 'Jane', email: 'jane@example.com' },
              business: { id: 'biz_1', name: 'Elite Cuts', address: '123 Kenyatta Ave' },
              service: { id: 'svc_1', name: 'Classic Haircut', price: 500, duration: 30 },
              staff: { id: 'stf_1', name: 'Mike', avatar: '/avatars/mike.jpg' },
              payment: { id: 'pay_1', amount: 500, currency: 'USD', status: 'COMPLETED' },
              review: null,
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Booking details' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'No permission to view this booking' },
          { code: 404, description: 'Booking not found' },
        ],
      },
      {
        id: 'bookings-update',
        method: 'PATCH',
        path: '/api/bookings/[id]',
        auth: 'Auth',
        description: 'Update booking status. Status transitions are validated: PENDING→CONFIRMED/CANCELLED, CONFIRMED→IN_PROGRESS/CANCELLED, IN_PROGRESS→COMPLETED/CANCELLED. Terminal states (COMPLETED, CANCELLED, NO_SHOW) cannot be changed.',
        requestBody: JSON.stringify(
          {
            status: 'CONFIRMED',
            notes: 'Confirmed via phone call',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'bkg_abc123', status: 'CONFIRMED' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Booking updated' },
          { code: 400, description: 'Invalid status transition' },
          { code: 401, description: 'Not authenticated' },
          { code: 404, description: 'Booking not found' },
        ],
      },
      {
        id: 'bookings-verify',
        method: 'POST',
        path: '/api/bookings/[id]/verify',
        auth: 'Auth',
        description: 'Mark a booking as verified by the business owner (e.g., customer checked in).',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'bkg_abc123', status: 'IN_PROGRESS' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Booking verified' },
          { code: 401, description: 'Not authenticated' },
          { code: 404, description: 'Booking not found' },
        ],
      },
      {
        id: 'bookings-complete',
        method: 'POST',
        path: '/api/bookings/[id]/complete',
        auth: 'Auth',
        description: 'Mark a booking as completed. This triggers the payment release from escrow and initiates the payout process.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'bkg_abc123', status: 'COMPLETED' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Booking completed' },
          { code: 401, description: 'Not authenticated' },
          { code: 404, description: 'Booking not found' },
        ],
      },
      {
        id: 'bookings-cancel',
        method: 'DELETE',
        path: '/api/bookings/[id]',
        auth: 'Auth',
        description: 'Cancel a booking. Cannot cancel completed bookings. Requires at least 24 hours notice (admins exempt). If a completed payment exists, it is marked for refund.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'Booking cancelled successfully', booking: { id: 'bkg_abc123', status: 'CANCELLED' } },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Booking cancelled' },
          { code: 400, description: 'Cannot cancel (completed or <24h notice)' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'No permission to cancel' },
          { code: 404, description: 'Booking not found' },
        ],
      },
    ],
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  {
    id: 'payments',
    name: 'Payments',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Payment processing with Stripe, PayPal, and M-Pesa',
    endpoints: [
      {
        id: 'payments-list',
        method: 'GET',
        path: '/api/payments',
        auth: 'Auth',
        description: 'List payments for the authenticated user. Admins can see all payments. Returns up to 50 most recent payments.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'pay_xyz789',
                amount: 500,
                currency: 'USD',
                paymentMethod: 'STRIPE',
                status: 'COMPLETED',
                createdAt: '2025-01-15T10:30:00Z',
                booking: {
                  business: { name: 'Elite Cuts Studio' },
                  service: { name: 'Classic Haircut' },
                },
              },
            ],
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of payments' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
      {
        id: 'payments-create',
        method: 'POST',
        path: '/api/payments',
        auth: 'Auth',
        description: 'Create a payment intent for a booking. Supports STRIPE, PAYPAL, and MPESA methods. Uses DB transaction for atomicity. Payment amount is validated against booking total. In dev mode, auto-completes for testing.',
        requestBody: JSON.stringify(
          {
            bookingId: 'bkg_abc123',
            currency: 'USD',
            paymentMethod: 'STRIPE',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              clientSecret: 'pi_3abc_secret_def',
              paymentId: 'pay_xyz789',
              stripePublishableKey: 'pk_live_...',
              devMode: 'false',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Payment intent created' },
          { code: 400, description: 'Stripe error or invalid data' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Email not verified' },
          { code: 404, description: 'Booking not found' },
          { code: 409, description: 'Payment already exists for this booking' },
        ],
      },
      {
        id: 'payments-confirm',
        method: 'POST',
        path: '/api/payments/capture-paypal',
        auth: 'Auth',
        description: 'Capture a PayPal payment after user approval. Confirms the order and updates payment status.',
        requestBody: JSON.stringify(
          {
            paymentId: 'pay_xyz789',
            orderId: 'PAYPAL_ORDER_ID',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'pay_xyz789', status: 'COMPLETED' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Payment confirmed' },
          { code: 401, description: 'Not authenticated' },
          { code: 404, description: 'Payment not found' },
        ],
      },
      {
        id: 'payments-detail',
        method: 'GET',
        path: '/api/payments/[id]',
        auth: 'Auth',
        description: 'Get detailed payment information including booking and transaction details.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'pay_xyz789',
              amount: 500,
              currency: 'USD',
              paymentMethod: 'STRIPE',
              status: 'COMPLETED',
              transactionId: 'pi_3abc...',
              createdAt: '2025-01-15T10:30:00Z',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Payment details' },
          { code: 401, description: 'Not authenticated' },
          { code: 404, description: 'Payment not found' },
        ],
      },
    ],
  },

  // ── Services ──────────────────────────────────────────────────────────────
  {
    id: 'services',
    name: 'Services',
    icon: <Scissors className="h-4 w-4" />,
    description: 'Manage service offerings for businesses',
    endpoints: [
      {
        id: 'services-list',
        method: 'GET',
        path: '/api/services',
        auth: 'Public',
        description: 'List services for a specific business with filtering and pagination. Requires businessId query parameter.',
        queryParameters: [
          { name: 'businessId', type: 'string', required: true, description: 'Business ID to list services for' },
          { name: 'category', type: 'string', required: false, description: 'Filter by category (Hair, Nails, Beard, etc.)' },
          { name: 'search', type: 'string', required: false, description: 'Search by service name' },
          { name: 'sortBy', type: 'string', required: false, description: 'price | name | createdAt' },
          { name: 'sortOrder', type: 'string', required: false, description: 'asc | desc' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'svc_a1b2c3',
                name: 'Classic Haircut',
                description: 'Traditional cut with styling',
                price: 500,
                discountPrice: 400,
                duration: 30,
                category: 'Hair',
                isActive: true,
              },
            ],
            pagination: { page: 1, limit: 20, total: 8, totalPages: 1 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of services' },
          { code: 400, description: 'Business ID required' },
        ],
      },
      {
        id: 'services-create',
        method: 'POST',
        path: '/api/services',
        auth: 'Auth',
        description: 'Create a new service for your business. Automatically linked to the authenticated business owner\'s business.',
        requestBody: JSON.stringify(
          {
            name: 'Classic Haircut',
            description: 'Traditional cut with styling',
            price: 500,
            discountPrice: 400,
            duration: 30,
            category: 'Hair',
            isActive: true,
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'svc_new123',
              name: 'Classic Haircut',
              businessId: 'biz_k1l2m3n4',
              price: 500,
              duration: 30,
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Service created' },
          { code: 400, description: 'Invalid data' },
          { code: 401, description: 'Not authenticated' },
          { code: 404, description: 'No registered business found' },
        ],
      },
      {
        id: 'services-update',
        method: 'PATCH',
        path: '/api/services/[id]',
        auth: 'Auth',
        description: 'Update a service. Only the business owner can update their services.',
        requestBody: JSON.stringify(
          {
            name: 'Classic Haircut Plus',
            price: 600,
            duration: 45,
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'svc_a1b2c3', name: 'Classic Haircut Plus', price: 600 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Service updated' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not the service owner' },
          { code: 404, description: 'Service not found' },
        ],
      },
      {
        id: 'services-delete',
        method: 'DELETE',
        path: '/api/services/[id]',
        auth: 'Auth',
        description: 'Soft delete a service by setting isActive to false. Only the business owner can delete their services.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'Service deleted successfully' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Service deleted' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not the service owner' },
          { code: 404, description: 'Service not found' },
        ],
      },
    ],
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  {
    id: 'chat',
    name: 'Chat',
    icon: <MessageSquare className="h-4 w-4" />,
    description: 'Real-time messaging between customers and businesses',
    endpoints: [
      {
        id: 'conversations-list',
        method: 'GET',
        path: '/api/conversations',
        auth: 'Auth',
        description: 'List conversations for the authenticated user with batched unread counts. Customers see conversations they started; business owners see conversations for their business.',
        queryParameters: [
          { name: 'search', type: 'string', required: false, description: 'Search by participant name' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'conv_abc',
                business: { id: 'biz_1', name: 'Elite Cuts' },
                customer: { id: 'usr_1', name: 'Jane', avatar: '/jane.jpg' },
                unreadCount: 3,
                messages: [{ content: 'Hi, I have a question...', createdAt: '2025-01-15T10:00:00Z' }],
              },
            ],
            pagination: { page: 1, limit: 20, total: 5, totalPages: 1 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of conversations' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
      {
        id: 'conversations-create',
        method: 'POST',
        path: '/api/conversations',
        auth: 'Auth',
        description: 'Start a new conversation with a business. If a conversation already exists between the user and business, returns the existing one.',
        requestBody: JSON.stringify(
          {
            businessId: 'biz_k1l2m3n4',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'conv_new123',
              businessId: 'biz_k1l2m3n4',
              customerId: 'usr_abc',
              createdAt: '2025-01-15T10:00:00Z',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Conversation created' },
          { code: 200, description: 'Existing conversation returned' },
          { code: 401, description: 'Not authenticated' },
          { code: 400, description: 'Invalid data' },
        ],
      },
      {
        id: 'messages-list',
        method: 'GET',
        path: '/api/conversations/[id]/messages',
        auth: 'Auth',
        description: 'Get messages in a conversation. Only participants can view messages.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'msg_1',
                content: 'Hi, what time are you open today?',
                senderId: 'usr_abc',
                isRead: true,
                createdAt: '2025-01-15T10:00:00Z',
              },
              {
                id: 'msg_2',
                content: 'We are open from 9 AM to 8 PM!',
                senderId: 'biz_owner_id',
                isRead: true,
                createdAt: '2025-01-15T10:05:00Z',
              },
            ],
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Messages retrieved' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not a participant' },
          { code: 404, description: 'Conversation not found' },
        ],
      },
      {
        id: 'messages-send',
        method: 'POST',
        path: '/api/conversations/[id]/messages',
        auth: 'Auth',
        description: 'Send a message in a conversation. Only participants can send messages.',
        requestBody: JSON.stringify(
          {
            content: 'Thanks for the info!',
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              id: 'msg_new789',
              content: 'Thanks for the info!',
              senderId: 'usr_abc',
              isRead: false,
              createdAt: '2025-01-15T10:10:00Z',
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Message sent' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not a participant' },
          { code: 404, description: 'Conversation not found' },
        ],
      },
    ],
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  {
    id: 'notifications',
    name: 'Notifications',
    icon: <Bell className="h-4 w-4" />,
    description: 'User notification management and preferences',
    endpoints: [
      {
        id: 'notifications-list',
        method: 'GET',
        path: '/api/notifications',
        auth: 'Auth',
        description: 'List notifications for the authenticated user. Supports filtering by read status and notification type.',
        queryParameters: [
          { name: 'unread', type: 'boolean', required: false, description: 'true to show only unread notifications' },
          { name: 'type', type: 'string', required: false, description: 'BOOKING_CONFIRMED | PAYMENT_SUCCESS | BOOKING_CANCELLED | SYSTEM_ALERT' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'notif_abc',
                title: 'Booking Confirmed',
                message: 'Your booking for Classic Haircut has been confirmed',
                type: 'BOOKING_CONFIRMED',
                isRead: false,
                createdAt: '2025-01-15T10:30:00Z',
              },
            ],
            pagination: { page: 1, limit: 20, total: 15, totalPages: 1 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of notifications' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
      {
        id: 'notifications-mark-read',
        method: 'PATCH',
        path: '/api/notifications/[id]',
        auth: 'Auth',
        description: 'Mark a specific notification as read. Only the notification owner can mark it.',
        requestBody: JSON.stringify(
          {
            isRead: true,
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'notif_abc', isRead: true },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Notification marked as read' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not the notification owner' },
          { code: 404, description: 'Notification not found' },
        ],
      },
      {
        id: 'notifications-read-all',
        method: 'PATCH',
        path: '/api/notifications',
        auth: 'Auth',
        description: 'Mark all notifications as read for the authenticated user.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: { message: 'All notifications marked as read' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'All notifications marked as read' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
    ],
  },

  // ── Payouts ───────────────────────────────────────────────────────────────
  {
    id: 'payouts',
    name: 'Payouts',
    icon: <Wallet className="h-4 w-4" />,
    description: 'Business payout management and processing',
    endpoints: [
      {
        id: 'payouts-list',
        method: 'GET',
        path: '/api/payouts',
        auth: 'Auth',
        description: 'List payouts. Business owners see payouts for their businesses; admins see all payouts with optional filtering.',
        queryParameters: [
          { name: 'status', type: 'string', required: false, description: 'PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED | ON_HOLD' },
          { name: 'businessId', type: 'string', required: false, description: 'Filter by business (admin only)' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page (max 100)' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'payout_abc',
                amount: 4250,
                currency: 'USD',
                status: 'COMPLETED',
                createdAt: '2025-01-15T12:00:00Z',
                business: { id: 'biz_1', name: 'Elite Cuts' },
              },
            ],
            pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of payouts' },
          { code: 401, description: 'Not authenticated' },
        ],
      },
      {
        id: 'payouts-trigger',
        method: 'POST',
        path: '/api/payouts/trigger',
        auth: 'Auth',
        description: 'Trigger a manual payout for the authenticated business owner. Validates minimum withdrawal amount from platform settings.',
        requestBody: JSON.stringify(
          {
            businessId: 'biz_k1l2m3n4',
            amount: 5000,
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: { id: 'payout_new', amount: 5000, status: 'PENDING' },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Payout triggered' },
          { code: 400, description: 'Amount below minimum withdrawal' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Not the business owner' },
        ],
      },
      {
        id: 'payouts-summary',
        method: 'GET',
        path: '/api/payouts/summary',
        auth: 'Admin',
        description: 'Get platform-wide payout summary including totals by status, pending amounts, and recent payout activity. Admin access required.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              totalPaidOut: 125000,
              pendingPayouts: 8500,
              processingAmount: 3200,
              failedPayouts: 150,
              businessCount: 12,
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Payout summary' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
      {
        id: 'payouts-bulk-trigger',
        method: 'POST',
        path: '/api/payouts/bulk-trigger',
        auth: 'Admin',
        description: 'Trigger payouts for multiple businesses at once. Admin access required. Each payout is processed individually with error tracking.',
        requestBody: JSON.stringify(
          {
            businessIds: ['biz_1', 'biz_2', 'biz_3'],
          },
          null,
          2
        ),
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              triggered: 3,
              failed: 0,
              results: [
                { businessId: 'biz_1', payoutId: 'payout_1', status: 'PENDING' },
                { businessId: 'biz_2', payoutId: 'payout_2', status: 'PENDING' },
                { businessId: 'biz_3', payoutId: 'payout_3', status: 'PENDING' },
              ],
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 201, description: 'Bulk payouts triggered' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    id: 'admin',
    name: 'Admin',
    icon: <Settings className="h-4 w-4" />,
    description: 'Platform administration and analytics',
    endpoints: [
      {
        id: 'admin-overview',
        method: 'GET',
        path: '/api/admin/overview',
        auth: 'Admin',
        description: 'Get comprehensive platform overview with stats, pending items, revenue charts, and recent payments. All queries run in parallel for performance.',
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              overview: {
                totalUsers: 1250,
                totalBusinesses: 45,
                totalBookings: 3200,
                totalRevenue: 450000,
                totalCommissions: 67500,
                revenueGrowth: 12.5,
              },
              monthly: {
                revenue: 38000,
                commissions: 5700,
                bookings: 280,
              },
              pending: {
                applications: 3,
                reports: 1,
                disputes: 2,
                tickets: 5,
                claims: 1,
              },
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Platform overview' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
      {
        id: 'admin-users',
        method: 'GET',
        path: '/api/admin/users',
        auth: 'Admin',
        description: 'List and manage platform users with search, filtering by role/status, and pagination. Admin access required.',
        queryParameters: [
          { name: 'search', type: 'string', required: false, description: 'Search by name or email' },
          { name: 'role', type: 'string', required: false, description: 'Filter by role' },
          { name: 'status', type: 'string', required: false, description: 'active | banned | all' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'usr_1',
                name: 'John Doe',
                email: 'john@example.com',
                role: 'CUSTOMER',
                isActive: true,
                createdAt: '2025-01-01T00:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 20, total: 1250, totalPages: 63 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of users' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
      {
        id: 'admin-businesses',
        method: 'GET',
        path: '/api/admin/businesses',
        auth: 'Admin',
        description: 'List all businesses on the platform with verification status filtering. Used for approving/rejecting business applications.',
        queryParameters: [
          { name: 'status', type: 'string', required: false, description: 'PENDING | APPROVED | REJECTED' },
          { name: 'search', type: 'string', required: false, description: 'Search by name' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'biz_1',
                name: 'Elite Cuts',
                verificationStatus: 'PENDING',
                owner: { name: 'Mike', email: 'mike@elitecuts.co.ke' },
                createdAt: '2025-01-10T00:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 20, total: 48, totalPages: 3 },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of businesses' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
      {
        id: 'admin-revenue',
        method: 'GET',
        path: '/api/revenue',
        auth: 'Admin',
        description: 'Get revenue analytics including total revenue, monthly breakdowns, top businesses, category distribution, and transaction trends. Admin access required.',
        queryParameters: [
          { name: 'type', type: 'string', required: false, description: 'Revenue data type to retrieve' },
          { name: 'period', type: 'string', required: false, description: '7d | 30d | 90d | 1y' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: {
              totalRevenue: 450000,
              platformFee: 67500,
              monthlyRevenue: [
                { month: 'Aug', revenue: 35000 },
                { month: 'Sep', revenue: 42000 },
                { month: 'Jan', revenue: 38000 },
              ],
              topBusinesses: [
                { name: 'Elite Cuts', revenue: 85000, bookings: 420 },
              ],
            },
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Revenue analytics' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
      {
        id: 'admin-disputes',
        method: 'GET',
        path: '/api/admin/disputes',
        auth: 'Admin',
        description: 'List and manage disputes with filtering by status. Used for resolving customer-business conflicts.',
        queryParameters: [
          { name: 'status', type: 'string', required: false, description: 'OPEN | UNDER_REVIEW | RESOLVED | CLOSED' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
        ],
        responseExample: JSON.stringify(
          {
            success: true,
            data: [
              {
                id: 'disp_1',
                reason: 'Service not as described',
                status: 'OPEN',
                booking: { id: 'bkg_1', business: { name: 'Elite Cuts' } },
                customer: { name: 'Jane Doe' },
                createdAt: '2025-01-14T00:00:00Z',
              },
            ],
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'List of disputes' },
          { code: 401, description: 'Not authenticated' },
          { code: 403, description: 'Admin access required' },
        ],
      },
    ],
  },

  // ── Webhooks ──────────────────────────────────────────────────────────────
  {
    id: 'webhooks',
    name: 'Webhooks',
    icon: <Webhook className="h-4 w-4" />,
    description: 'Payment provider webhook endpoints',
    endpoints: [
      {
        id: 'webhook-stripe',
        method: 'POST',
        path: '/api/webhooks/stripe',
        auth: 'Public',
        description: 'Stripe webhook handler. Verifies HMAC-SHA256 signature, checks event age (max 5 minutes), ensures idempotency. Handles payment_intent.succeeded, payment_intent.payment_failed, checkout.session.completed, charge.refunded, and charge.dispute.created events.',
        responseExample: JSON.stringify(
          {
            received: true,
            processed: 'payment_intent.succeeded',
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Webhook processed' },
          { code: 400, description: 'Missing Stripe signature' },
          { code: 401, description: 'Invalid signature or replay attack detected' },
          { code: 500, description: 'Processing failed (Stripe will retry)' },
        ],
      },
      {
        id: 'webhook-paypal',
        method: 'POST',
        path: '/api/webhooks/paypal',
        auth: 'Public',
        description: 'PayPal webhook handler. Verifies webhook signature using timing-safe comparison. No fallback secrets configured. Handles payment completion and refund events.',
        responseExample: JSON.stringify(
          {
            received: true,
            processed: 'PAYMENT.CAPTURE.COMPLETED',
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Webhook processed' },
          { code: 401, description: 'Invalid signature' },
          { code: 500, description: 'Processing failed' },
        ],
      },
      {
        id: 'webhook-mpesa',
        method: 'POST',
        path: '/api/webhooks/mpesa',
        auth: 'Public',
        description: 'M-Pesa (Safaricom) webhook handler. Verifies HMAC signature via x-mpesa-signature header using timing-safe comparison. Handles C2B payment confirmation and B2C result events.',
        responseExample: JSON.stringify(
          {
            received: true,
            processed: 'c2b-confirmation',
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Webhook processed' },
          { code: 401, description: 'Invalid signature' },
          { code: 500, description: 'Processing failed' },
        ],
      },
      {
        id: 'webhook-paystack',
        method: 'POST',
        path: '/api/webhooks/paystack',
        auth: 'Public',
        description: 'Paystack webhook handler. Verifies signature using the Paystack secret key. Handles charge.success, transfer.success, and transfer.failed events.',
        responseExample: JSON.stringify(
          {
            received: true,
            processed: 'charge.success',
          },
          null,
          2
        ),
        statusCodes: [
          { code: 200, description: 'Webhook processed' },
          { code: 401, description: 'Invalid signature' },
          { code: 500, description: 'Processing failed' },
        ],
      },
    ],
  },
];

// ─── Code Block Component ────────────────────────────────────────────────────

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="rounded-lg border border-slate-700/50 overflow-hidden bg-slate-900/80">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50 bg-slate-800/60">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-slate-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

// ─── Status Code Colors ──────────────────────────────────────────────────────

function getStatusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-emerald-400 bg-emerald-500/10';
  if (code >= 300 && code < 400) return 'text-blue-400 bg-blue-500/10';
  if (code >= 400 && code < 500) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

// ─── Endpoint Card ───────────────────────────────────────────────────────────

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const methodColor = METHOD_COLORS[endpoint.method];
  const authColor = AUTH_COLORS[endpoint.auth];

  const accordionItems: React.ReactNode[] = [];

  if (endpoint.requestBody) {
    accordionItems.push(
      <AccordionItem key="request" value="request">
        <AccordionTrigger className="text-sm text-slate-300 hover:text-white py-3">
          Request Body
        </AccordionTrigger>
        <AccordionContent>
          <CodeBlock code={endpoint.requestBody} title="JSON" />
        </AccordionContent>
      </AccordionItem>
    );
  }

  if (endpoint.queryParameters && endpoint.queryParameters.length > 0) {
    accordionItems.push(
      <AccordionItem key="query" value="query">
        <AccordionTrigger className="text-sm text-slate-300 hover:text-white py-3">
          Query Parameters
        </AccordionTrigger>
        <AccordionContent>
          <div className="rounded-lg border border-slate-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Required</th>
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.queryParameters.map((param) => (
                  <tr key={param.name} className="border-b border-slate-700/30 last:border-0">
                    <td className="px-4 py-2.5">
                      <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-purple-300">{param.name}</code>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{param.type}</td>
                    <td className="px-4 py-2.5">
                      {param.required ? (
                        <span className="text-xs text-red-400 font-medium">Required</span>
                      ) : (
                        <span className="text-xs text-slate-500">Optional</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  accordionItems.push(
    <AccordionItem key="response" value="response">
      <AccordionTrigger className="text-sm text-slate-300 hover:text-white py-3">
        Response Example
      </AccordionTrigger>
      <AccordionContent>
        <CodeBlock code={endpoint.responseExample} title="JSON Response" />
      </AccordionContent>
    </AccordionItem>
  );

  accordionItems.push(
    <AccordionItem key="status" value="status">
      <AccordionTrigger className="text-sm text-slate-300 hover:text-white py-3">
        Status Codes
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1.5">
          {endpoint.statusCodes.map((sc) => (
            <div key={sc.code} className="flex items-center gap-3 text-sm">
              <span className={`inline-flex items-center justify-center w-14 h-6 rounded-md text-xs font-mono font-bold ${getStatusCodeColor(sc.code)}`}>
                {sc.code}
              </span>
              <span className="text-slate-400">{sc.description}</span>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <Card className="border-slate-700/50 bg-slate-900/40 backdrop-blur-sm hover:border-slate-600/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold font-mono ${methodColor.bg} ${methodColor.text} border ${methodColor.border}`}
            >
              {endpoint.method}
            </span>
            <code className="text-sm text-slate-200 font-mono break-all">{endpoint.path}</code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${authColor}`}>
              <Shield className="h-3 w-3 mr-1" />
              {endpoint.auth}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-slate-400 leading-relaxed mb-4">{endpoint.description}</p>
        <Accordion type="multiple" defaultValue={[]} className="w-full">
          {accordionItems}
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ─── Sidebar Category ────────────────────────────────────────────────────────

function SidebarCategory({
  category,
  isActive,
  endpointCount,
  onClick,
}: {
  category: ApiCategory;
  isActive: boolean;
  endpointCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
        isActive
          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
      }`}
    >
      <span className={isActive ? 'text-purple-400' : 'text-slate-500'}>{category.icon}</span>
      <span className="flex-1 truncate font-medium">{category.name}</span>
      <span className={`text-xs tabular-nums ${isActive ? 'text-purple-400/70' : 'text-slate-600'}`}>
        {endpointCount}
      </span>
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ApiDocumentation({ onBack }: ApiDocumentationProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(API_CATEGORIES[0].id);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [methodFilter, setMethodFilter] = useState<HttpMethod | 'ALL'>('ALL');

  // Filter endpoints based on search query and method filter
  const filteredCategories = useMemo(() => {
    return API_CATEGORIES.map((category) => {
      const filteredEndpoints = category.endpoints.filter((ep) => {
        const matchesSearch =
          searchQuery === '' ||
          ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.method.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesMethod = methodFilter === 'ALL' || ep.method === methodFilter;

        return matchesSearch && matchesMethod;
      });

      return { ...category, endpoints: filteredEndpoints };
    }).filter((cat) => cat.endpoints.length > 0);
  }, [searchQuery, methodFilter]);

  const activeCategoryData = useMemo(
    () => filteredCategories.find((c) => c.id === activeCategory) || filteredCategories[0],
    [filteredCategories, activeCategory]
  );

  const totalEndpoints = useMemo(
    () => filteredCategories.reduce((sum, cat) => sum + cat.endpoints.length, 0),
    [filteredCategories]
  );

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      setActiveCategory(categoryId);
      setMobileSidebarOpen(false);
    },
    []
  );

  // Fallback if active category was filtered out
  React.useEffect(() => {
    if (activeCategoryData === undefined && filteredCategories.length > 0) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [activeCategoryData, filteredCategories]);

  const METHOD_FILTERS: { value: HttpMethod | 'ALL'; label: string; color: string }[] = [
    { value: 'ALL', label: 'All', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    { value: 'GET', label: 'GET', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { value: 'POST', label: 'POST', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { value: 'PUT', label: 'PUT', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { value: 'PATCH', label: 'PATCH', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { value: 'DELETE', label: 'DELETE', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Decorative background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-slate-400 hover:text-white -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6 bg-slate-700" />
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-400" />
                  <h1 className="text-lg sm:text-xl font-bold text-white">API Documentation</h1>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Styra Platform REST API Reference
                </p>
              </div>
            </div>

            {/* Search bar (desktop) */}
            <div className="hidden md:flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search endpoints..."
                  className="w-64 h-9 pl-9 bg-slate-900/60 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:ring-purple-500/30 focus:border-purple-500/40"
                />
              </div>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                {totalEndpoints} endpoints
              </Badge>
            </div>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-slate-400 hover:text-white"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {/* Mobile search */}
          <div className="md:hidden mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search endpoints..."
                className="w-full h-9 pl-9 bg-slate-900/60 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:ring-purple-500/30"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                {totalEndpoints} endpoints
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:block w-64 lg:w-72 shrink-0 border-r border-slate-800/60">
          <div className="sticky top-[73px] h-[calc(100vh-73px)]">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-3">
                  Categories
                </p>
                {API_CATEGORIES.map((category) => {
                  const filteredCount = filteredCategories.find((fc) => fc.id === category.id)?.endpoints.length || 0;
                  return (
                    <SidebarCategory
                      key={category.id}
                      category={category}
                      isActive={activeCategory === category.id}
                      endpointCount={filteredCount}
                      onClick={() => handleCategoryClick(category.id)}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </aside>

        {/* Sidebar - Mobile overlay */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="absolute top-[73px] left-0 w-72 h-[calc(100vh-73px)] bg-slate-950 border-r border-slate-800/60 shadow-2xl">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-3">
                    Categories
                  </p>
                  {API_CATEGORIES.map((category) => {
                    const filteredCount = filteredCategories.find((fc) => fc.id === category.id)?.endpoints.length || 0;
                    return (
                      <SidebarCategory
                        key={category.id}
                        category={category}
                        isActive={activeCategory === category.id}
                        endpointCount={filteredCount}
                        onClick={() => handleCategoryClick(category.id)}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {activeCategoryData ? (
            <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
              {/* Category header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-400">
                    {activeCategoryData.icon}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">{activeCategoryData.name}</h2>
                    <p className="text-sm text-slate-500">{activeCategoryData.description}</p>
                  </div>
                </div>
              </div>

              {/* Method filter */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <Filter className="h-4 w-4 text-slate-500" />
                {METHOD_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setMethodFilter(filter.value)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                      methodFilter === filter.value
                        ? filter.color
                        : 'bg-slate-900/40 text-slate-500 border-slate-700/30 hover:text-slate-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <Separator className="mb-6 bg-slate-800/60" />

              {/* Endpoints list */}
              {activeCategoryData.endpoints.length > 0 ? (
                <div className="space-y-4">
                  {activeCategoryData.endpoints.map((endpoint) => (
                    <EndpointCard key={endpoint.id} endpoint={endpoint} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Search className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-400 mb-2">No endpoints found</h3>
                  <p className="text-sm text-slate-500">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              )}

              {/* Footer info */}
              <div className="mt-12 pt-6 border-t border-slate-800/60">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <span>Base URL: <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-purple-300">https://api.styra.app</code></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>API version: <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">v1</code></span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  All endpoints return JSON. Authenticated requests require a session cookie (set on login). 
                  CSRF token required for POST/PUT/PATCH/DELETE requests. Rate limits apply to all endpoints.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-500">No category selected</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
