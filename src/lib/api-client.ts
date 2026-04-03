// API Client for frontend to interact with backend
// Includes CSRF token on all state-changing requests (POST, PUT, PATCH, DELETE)
// Features: request timeout (10s), exponential backoff retry for GET, timeout error handling
import { toast } from 'sonner';

const API_BASE = '/api';

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// ============================================
// TIMEOUT & RETRY CONFIGURATION
// ============================================
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const SPINNER_TIMEOUT = 30000; // 30 seconds — kill infinite spinners

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
  noRetry?: boolean;
}

/**
 * Read the CSRF token from the non-httpOnly cookie.
 * The cookie is set by the middleware on page loads.
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx).
 * Non-retryable: 4xx (client errors), abort errors, CSRF errors.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false; // Don't retry aborts
  }
  if (error instanceof Error && error.message === 'CSRF token missing') {
    return false; // Don't retry CSRF errors
  }
  if (error instanceof Error && error.message === 'CSRF token invalid') {
    return false;
  }
  // Network errors and 5xx are retryable
  return true;
}

class ApiClient {
  public async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<{ data: T; success: boolean; error?: string }> {
    const { params, timeout = DEFAULT_TIMEOUT, retries, noRetry, ...fetchOptions } = options;

    // Determine retry count: default 1 for GET, 0 for state-changing methods
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const maxRetries = noRetry ? 0 : (retries ?? (STATE_CHANGING_METHODS.includes(method) ? 0 : 1));

    let url = `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      url += `?${searchParams.toString()}`;
    }

    // Auto-include CSRF token on state-changing requests
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (STATE_CHANGING_METHODS.includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Retry loop with exponential backoff
    let lastError: Error | unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Set up request timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Safety timeout: show error after SPINNER_TIMEOUT to prevent infinite loading
      const spinnerTimer = setTimeout(() => {
        toast.error('Request is taking longer than expected. Please try again.');
      }, SPINNER_TIMEOUT);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        clearTimeout(spinnerTimer);

        const data = await response.json();

        // Handle CSRF errors specifically
        if (response.status === 403 && data.code === 'CSRF_TOKEN_MISSING') {
          toast.error('Session expired. Please reload the page.');
          throw new Error('CSRF token missing');
        }
        if (response.status === 403 && data.code === 'CSRF_TOKEN_INVALID') {
          toast.error('Security validation failed. Please reload the page.');
          throw new Error('CSRF token invalid');
        }

        if (!response.ok || !data.success) {
          // Show details (if available) as the main message for better debugging
          const error = data.details || data.error || 'An error occurred';
          const toastMsg = data.error || error; // Toast shows the error field, not details
          toast.error(toastMsg);
          throw new Error(error);
        }

        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        clearTimeout(spinnerTimer);
        lastError = error;

        // Re-throw non-retryable errors immediately
        if (error instanceof Error) {
          // Check for timeout-specific error
          if (error.name === 'AbortError' && !controller.signal.aborted) {
            // This shouldn't happen, but handle it
          }
          if (error.message === 'CSRF token missing' || error.message === 'CSRF token invalid') {
            throw error;
          }
        }

        // On last attempt, throw with a clear timeout message if it was an abort
        if (attempt === maxRetries) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            toast.error('Request timed out. Please check your connection and try again.');
            throw new Error(`Request timed out after ${timeout / 1000}s. Please check your connection.`);
          }
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Network error');
        }

        // Otherwise continue to retry
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError instanceof Error ? lastError : new Error('Network error');
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  async login(email: string, password: string) {
    return this.request<{ id: string; email: string; name: string; role: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      noRetry: true,
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST', noRetry: true });
  }

  async getProfile() {
    return this.request<{ id: string; email: string; name: string; role: string }>('/auth/me');
  }

  async verifyOTP(phone: string, code: string) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
      noRetry: true,
    });
  }

  async resendOTP(phone: string) {
    return this.request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
      noRetry: true,
    });
  }

  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      noRetry: true,
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
      noRetry: true,
    });
  }

  // User endpoints
  async updateProfile(data: { name?: string; phone?: string; avatar?: string }) {
    return this.request('/users', {
      method: 'PATCH',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  async deleteAccount() {
    return this.request('/users', { method: 'DELETE', noRetry: true });
  }

  // Business endpoints
  async getBusinesses(params?: {
    query?: string;
    category?: string;
    city?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    page?: number;
    limit?: number;
  }) {
    return this.request<{
      data: unknown[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/businesses', { params });
  }

  async getBusiness(idOrSlug: string) {
    return this.request(`/businesses/${idOrSlug}`);
  }

  async createBusiness(data: Record<string, unknown>) {
    return this.request('/businesses', {
      method: 'POST',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  async updateBusiness(id: string, data: Record<string, unknown>) {
    return this.request(`/businesses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  // Service endpoints
  async getServices(businessId: string) {
    return this.request('/services', { params: { businessId } });
  }

  async createService(data: Record<string, unknown>) {
    return this.request('/services', {
      method: 'POST',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  async updateService(id: string, data: Record<string, unknown>) {
    return this.request(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  // Booking endpoints
  async getBookings(params?: { status?: string; fromDate?: string; toDate?: string }) {
    return this.request('/bookings', { params });
  }

  async getBooking(id: string) {
    return this.request(`/bookings/${id}`);
  }

  async createBooking(data: Record<string, unknown>) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  async updateBooking(id: string, data: { status: string; notes?: string }) {
    return this.request(`/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  async cancelBooking(id: string) {
    return this.request(`/bookings/${id}`, { method: 'DELETE', noRetry: true });
  }

  // Payment endpoints
  async createPayment(data: { bookingId: string; amount: number; currency?: string; paymentMethod: string }) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  /**
   * Poll a payment until it reaches a terminal state (COMPLETED, FAILED, REFUNDED)
   * or the timeout is reached.
   */
  async pollPaymentStatus(
    paymentId: string,
    options: { intervalMs?: number; maxAttempts?: number } = {}
  ): Promise<{ data: Record<string, unknown>; success: boolean }> {
    const { intervalMs = 3000, maxAttempts = 40 } = options; // 3s interval, 120s max

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      try {
        const response = await this.request<Record<string, unknown>>(`/payments/${paymentId}`);
        const paymentData = response.data;
        const status = paymentData?.status;

        if (['COMPLETED', 'FAILED', 'REFUNDED'].includes(status as string)) {
          return response;
        }

        // Continue polling for PENDING/PROCESSING states
      } catch (error) {
        // Network error during polling — continue trying
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Payment verification timed out. Please check your payment status in your dashboard.');
  }

  // Review endpoints
  async getReviews(businessId?: string) {
    return this.request('/reviews', { params: businessId ? { businessId } : undefined });
  }

  async createReview(data: { businessId: string; bookingId: string; rating: number; comment?: string }) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
      noRetry: true,
    });
  }

  // Notification endpoints
  async getNotifications(unreadOnly = false) {
    return this.request('/notifications', { params: { unread: unreadOnly } });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications', { method: 'PATCH', noRetry: true });
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}`, { method: 'PATCH', noRetry: true });
  }

  // Chat endpoints
  async getConversations() {
    return this.request('/conversations');
  }

  async createConversation(businessId: string) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ businessId }),
      noRetry: true,
    });
  }

  async getMessages(conversationId: string, page = 1) {
    return this.request(`/conversations/${conversationId}`, { params: { page } });
  }

  async sendMessage(conversationId: string, receiverId: string, content: string) {
    return this.request(`/conversations/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ conversationId, receiverId, content }),
      noRetry: true,
    });
  }

  // Admin endpoints
  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getAdminUsers(params?: { role?: string; query?: string }) {
    return this.request('/admin/users', { params });
  }

  async getAdminUser(id: string) {
    return this.request(`/admin/users/${id}`);
  }

  async updateUserRole(id: string, role: string) {
    return this.request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
      noRetry: true,
    });
  }

  async getAdminBusinesses(params?: { status?: string; query?: string }) {
    return this.request('/admin/businesses', { params });
  }

  async updateBusinessStatus(id: string, verificationStatus: string, reason?: string) {
    return this.request(`/admin/businesses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus, reason }),
      noRetry: true,
    });
  }

  // File upload
  async uploadFile(file: File, type: 'avatar' | 'portfolio' | 'logo' = 'avatar') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    // Add CSRF token to file uploads
    const headers: Record<string, string> = {};
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    // File upload with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Upload failed');
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Upload timed out. Please try again.');
        throw new Error('Upload timed out');
      }

      if (error instanceof Error) throw error;
      throw new Error('Upload failed');
    }
  }
}

export const api = new ApiClient();
export default api;
