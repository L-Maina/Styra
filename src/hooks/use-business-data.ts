/* eslint-disable react-hooks/set-state-in-effect -- Data-fetching hooks use setState in effects for loading/error/data states, which is the standard pattern */
import { useState, useEffect, useCallback } from 'react';
import type { Business, Booking, Notification, Conversation, Service, Staff } from '@/types';

// ─── Generic fetch hook ───────────────────────────────────────────────

function useFetch<T>(
  fetchFn: () => Promise<T[] | null>,
  deps: unknown[] = [],
  enabled = true
) {
  const [rawData, setRawData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchFn()
      .then((result) => {
        if (!cancelled) setRawData(result || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchFn]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchFn()
      .then((result) => setRawData(result || []))
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setIsLoading(false));
  }, [fetchFn]);

  // When disabled, expose empty data to prevent stale data leakage
  const data = enabled ? rawData : [];
  const safeError = enabled ? error : null;
  const safeIsLoading = enabled ? isLoading : false;

  return { data, isLoading: safeIsLoading, error: safeError, refetch };
}

// ─── API helper ───────────────────────────────────────────────────────

const API_BASE = '/api';

async function apiGet<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T[] | null> {
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) sp.append(k, String(v));
    });
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  // AbortController with 15s timeout — prevents infinite hanging on Vercel/serverless
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Request failed (${res.status})`);
    }

    const json = await res.json();

    // The API returns { success: true, data: [...], pagination: {...} }
    // Some endpoints return { success: true, data: <single object> }
    if (json.success && json.data) {
      return Array.isArray(json.data) ? json.data : [json.data];
    }

    return [];
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Business hooks ───────────────────────────────────────────────────

export interface BusinessesParams {
  query?: string;
  category?: string;
  city?: string;
  minRating?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
}

export function useBusinesses(params?: BusinessesParams) {
  const fetchFn = useCallback(async () => {
    return apiGet<Business>('/businesses', params as Record<string, string | number | boolean | undefined>);
  }, [params]);

  return useFetch<Business>(fetchFn, [params], true);
}

export function useBusinessDetail(id?: string | null) {
  const fetchFn = useCallback(async () => {
    if (!id) return null;
    const result = await apiGet<Business>(`/businesses/${id}`);
    return result;
  }, [id]);

  return useFetch<Business>(fetchFn, [id], !!id);
}

// ─── Bookings hook (requires auth) ────────────────────────────────────

export interface BookingsParams {
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export function useBookings(params?: BookingsParams, isAuthenticated = false) {
  const fetchFn = useCallback(async () => {
    return apiGet<Booking>('/bookings', params as Record<string, string | number | boolean | undefined>);
  }, [params]);

  return useFetch<Booking>(fetchFn, [params, isAuthenticated], isAuthenticated);
}

// ─── Notifications hook (requires auth) ───────────────────────────────

export function useApiNotifications(isAuthenticated = false) {
  const fetchFn = useCallback(async () => {
    return apiGet<Notification>('/notifications');
  }, []);

  return useFetch<Notification>(fetchFn, [isAuthenticated], isAuthenticated);
}

// ─── Conversations hook (requires auth) ───────────────────────────────

export function useConversations(isAuthenticated = false) {
  const fetchFn = useCallback(async () => {
    return apiGet<Conversation>('/conversations');
  }, []);

  return useFetch<Conversation>(fetchFn, [isAuthenticated], isAuthenticated);
}

// ─── Services hook (for business owner) ──────────────────────────

export function useBusinessServices(businessId?: string | null) {
  const fetchFn = useCallback(async () => {
    if (!businessId) return null;
    return apiGet<Service>('/services', { businessId });
  }, [businessId]);

  return useFetch<Service>(fetchFn, [businessId], !!businessId);
}

// ─── Staff hook (for business owner) ──────────────────────────────

export function useBusinessStaff(businessId?: string | null) {
  const fetchFn = useCallback(async () => {
    if (!businessId) return null;
    // Staff are included in the business detail response
    const result = await apiGet<any>('/businesses', {});
    // Filter for the specific business - staff is included in business detail
    // We need a dedicated approach: fetch the business detail
    const businessResult = await apiGet<{ services: Service[]; staff: Staff[] }>(`/businesses/${businessId}`);
    return businessResult?.[0]?.staff || [];
  }, [businessId]);

  return useFetch<Staff>(fetchFn, [businessId], !!businessId);
}
