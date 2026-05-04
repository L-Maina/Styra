'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Settings,
  ExternalLink,
  Clock,
  Calendar,
  MessageSquare,
  CreditCard,
  Star,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import { getPusherClient } from '@/lib/pusher-client';
import api from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead?: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationBadgeProps {
  className?: string;
  onViewAll?: () => void;
  onOpenPreferences?: () => void;
  onNavigate?: (page: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────

const typeIcons: Record<string, React.ElementType> = {
  booking_confirmed: Calendar,
  booking_cancelled: Calendar,
  BOOKING_CONFIRMED: Calendar,
  BOOKING_CANCELLED: Calendar,
  BOOKING_REMINDER: Calendar,
  payment_received: CreditCard,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CreditCard,
  new_review: Star,
  NEW_REVIEW: Star,
  message_received: MessageSquare,
  NEW_MESSAGE: MessageSquare,
  verification_update: ShieldCheck,
  VERIFICATION_UPDATE: ShieldCheck,
  promotional: Tag,
  SYSTEM_ALERT: ShieldCheck,
};

const typeColors: Record<string, string> = {
  booking_confirmed: 'text-green-600 bg-green-500/10',
  booking_cancelled: 'text-red-600 bg-red-500/10',
  BOOKING_CONFIRMED: 'text-green-600 bg-green-500/10',
  BOOKING_CANCELLED: 'text-red-600 bg-red-500/10',
  BOOKING_REMINDER: 'text-blue-600 bg-blue-500/10',
  payment_received: 'text-emerald-600 bg-emerald-500/10',
  PAYMENT_SUCCESS: 'text-emerald-600 bg-emerald-500/10',
  PAYMENT_FAILED: 'text-red-600 bg-red-500/10',
  new_review: 'text-yellow-600 bg-yellow-500/10',
  NEW_REVIEW: 'text-yellow-600 bg-yellow-500/10',
  message_received: 'text-sky-600 bg-sky-500/10',
  NEW_MESSAGE: 'text-sky-600 bg-sky-500/10',
  verification_update: 'text-purple-600 bg-purple-500/10',
  VERIFICATION_UPDATE: 'text-purple-600 bg-purple-500/10',
  promotional: 'text-pink-600 bg-pink-500/10',
  SYSTEM_ALERT: 'text-orange-600 bg-orange-500/10',
};

/**
 * Map notification type + link to an appropriate app page name.
 * Takes user role into account so admins go to admin-dashboard
 * and business owners go to business-dashboard/onboarding.
 */
function resolvePageFromLink(link?: string, type?: string, userRole?: string): string | null {
  const isAdmin = (userRole || '').toUpperCase() === 'ADMIN';
  const isBusinessOwner = (userRole || '').toUpperCase() === 'BUSINESS_OWNER';

  // ── Link-based routing (takes priority) ──
  if (link) {
    if (link.startsWith('/admin')) return 'admin-dashboard';
    if (link.startsWith('/chat')) return 'chat';
    if (link.startsWith('/onboarding')) return 'onboarding';
    // /business/ links: admin → admin-dashboard, business owner → business-dashboard
    if (link.startsWith('/business/')) {
      return isAdmin ? 'admin-dashboard' : (isBusinessOwner ? 'business-dashboard' : 'home');
    }
    if (link.startsWith('/booking')) {
      return isAdmin ? 'admin-dashboard' : (isBusinessOwner ? 'business-dashboard' : 'customer-dashboard');
    }
    if (link.startsWith('/wallet')) {
      return isBusinessOwner ? 'business-dashboard' : 'customer-dashboard';
    }
  }

  // ── Type-based fallback ──
  if (!type) return null;
  const t = type.toUpperCase();
  if (t.includes('BOOKING')) {
    return isAdmin ? 'admin-dashboard' : (isBusinessOwner ? 'business-dashboard' : 'customer-dashboard');
  }
  if (t.includes('PAYMENT')) {
    return isAdmin ? 'admin-dashboard' : (isBusinessOwner ? 'business-dashboard' : 'customer-dashboard');
  }
  if (t.includes('VERIFICATION')) {
    return isAdmin ? 'admin-dashboard' : 'onboarding';
  }
  if (t.includes('REVIEW')) {
    return isAdmin ? 'admin-dashboard' : (isBusinessOwner ? 'business-dashboard' : 'home');
  }
  if (t.includes('MESSAGE')) return 'chat';
  if (t.includes('SYSTEM')) {
    return isAdmin ? 'admin-dashboard' : (isBusinessOwner ? 'business-dashboard' : 'home');
  }
  return null;
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

// ── Component ──────────────────────────────────────────────────────────

export function NotificationBadge({
  className,
  onViewAll,
  onOpenPreferences,
  onNavigate,
}: NotificationBadgeProps) {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const userId = user?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNewPulse, setIsNewPulse] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refresh auth state from server ────────────────────────────────
  // When a VERIFICATION_UPDATE notification arrives, the user's role or
  // verification status may have changed on the server. We need to
  // re-fetch /api/auth/me so the Zustand store stays in sync.

  const refreshAuthState = useCallback(async () => {
    try {
      const result = await api.getProfile();
      if (result.success && result.data) {
        const serverUser = result.data as Record<string, unknown>;
        updateUser({
          role: (serverUser.role as string) || undefined,
          roles: (serverUser.roles as string[]) || undefined,
          businessVerificationStatus: serverUser.businessVerificationStatus as string | undefined,
          activeMode: (serverUser.activeMode as string) || undefined,
        } as any);
      }
    } catch {
      // Non-critical
    }
  }, [updateUser]);

  // ── Fetch notifications ─────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/notifications?limit=10', {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const items = json.data;
          setNotifications(items);
          setUnreadCount(items.filter((n: NotificationItem) => !n.isRead).length);
        }
      }
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  /* eslint-disable react-hooks/set-state-in-effect -- Data-fetching effect: loads notifications from API on mount and auth change */
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Periodically refresh auth state (every 60s) ────────────────────
  // This ensures role/verification changes made by admin are eventually
  // reflected even if the Pusher notification is missed.

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(refreshAuthState, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshAuthState]);

  // ── Pusher subscription for real-time updates ───────────────────────

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `user-${userId}`;
    const channel = pusher.subscribe(channelName);

    const handleNotification = (data: { title?: string; message?: string; type?: string; link?: string }) => {
      setIsNewPulse(true);
      setUnreadCount((prev) => prev + 1);

      // Add new notification to the top of the list
      setNotifications((prev) => [
        {
          id: `realtime-${Date.now()}`,
          title: data.title || 'New Notification',
          message: data.message || '',
          type: data.type,
          isRead: false,
          createdAt: new Date().toISOString(),
          link: data.link,
        },
        ...prev.slice(0, 9), // Keep max 10
      ]);

      // Show browser notification when tab is hidden
      if (typeof document !== 'undefined' && document.hidden) {
        try {
          const notif = new Notification(data.title || 'New Notification', {
            body: data.message || '',
            icon: '/favicon.ico',
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
          setTimeout(() => notif.close(), 5000);
        } catch {
          // Notification API not available
        }
      }

      // Auto-stop pulse
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = setTimeout(() => setIsNewPulse(false), 3000);

      // ── Refresh auth state for verification/role change notifications ──
      const type = (data.type || '').toUpperCase();
      if (type === 'VERIFICATION_UPDATE' || type.includes('VERIFICATION')) {
        refreshAuthState();
      }
    };

    channel.bind('new-notification', handleNotification);
    channel.bind('booking-update', handleNotification);
    channel.bind('payment-update', handleNotification);

    return () => {
      channel.unbind('new-notification', handleNotification);
      channel.unbind('booking-update', handleNotification);
      channel.unbind('payment-update', handleNotification);
      pusher.unsubscribe(channelName);
    };
  }, [isAuthenticated, userId, refreshAuthState]);

  // ── Close dropdown when clicking outside ────────────────────────────

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  // ── Mark all as read (uses api client for CSRF) ───────────────────

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  // ── Mark single notification as read and navigate ──────────────────

  const handleNotificationClick = async (notification: NotificationItem) => {
    // Mark as read in the backend (uses api client for CSRF)
    if (!notification.isRead) {
      try {
        // Only call API for real (non-realtime-placeholder) notifications
        if (!notification.id.startsWith('realtime-')) {
          await api.markNotificationRead(notification.id);
        }
        // Optimistically update local state
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Don't block navigation on failure
      }
    }

    // Close the dropdown
    setIsOpen(false);

    // Navigate to the appropriate page
    const page = resolvePageFromLink(notification.link, notification.type, user?.role);
    if (page && onNavigate) {
      onNavigate(page);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-xl transition-all duration-200',
          'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50',
          'text-muted-foreground hover:text-foreground'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-destructive text-white text-xs font-medium flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Animated pulse ring when new notification arrives */}
        {isNewPulse && (
          <span className="absolute inset-0 rounded-xl animate-ping bg-primary/20 pointer-events-none" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-80 sm:w-96',
            'rounded-xl border border-border bg-card shadow-xl',
            'z-50 overflow-hidden',
            'animate-in fade-in slide-in-from-top-2 duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="h-5 px-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAllRead();
                }}
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map((notification) => {
                  const Icon = typeIcons[notification.type || ''] || Bell;
                  const colorClasses =
                    typeColors[notification.type || ''] || 'text-muted-foreground bg-muted';
                  const isClickable = !!(notification.link || notification.type);

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        isClickable && 'cursor-pointer hover:bg-muted/50',
                        !notification.isRead && 'bg-primary/5'
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full',
                          colorClasses
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              'text-sm truncate',
                              !notification.isRead
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <span className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>

                      {/* Navigate indicator */}
                      {isClickable && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border px-2 py-2 flex items-center gap-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onViewAll?.();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View All
            </button>
            {onOpenPreferences && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenPreferences();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Settings className="h-3 w-3" />
                Preferences
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBadge;
