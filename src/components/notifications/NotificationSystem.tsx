'use client';

import * as React from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  X,
  Trash2,
  Settings,
  Calendar,
  Star,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Tag,
  Filter,
  Mail,
  Smartphone,
  ChevronDown,
  MoreVertical,
  Clock,
  ExternalLink,
  AlertCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, GlassButton, GlassBadge, FadeIn } from '@/components/ui/custom/glass-components';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES AND INTERFACES
// ============================================

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'new_review'
  | 'payment_received'
  | 'message_received'
  | 'verification_update'
  | 'promotional';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  booking_confirmed: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  booking_cancelled: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  new_review: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  payment_received: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  message_received: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  verification_update: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  promotional: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ============================================
// NOTIFICATION TYPE CONFIG
// ============================================

export const notificationTypeConfig: Record<
  NotificationType,
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  booking_confirmed: {
    icon: Calendar,
    label: 'Booking Confirmed',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
  },
  booking_cancelled: {
    icon: Calendar,
    label: 'Booking Cancelled',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
  },
  new_review: {
    icon: Star,
    label: 'New Review',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
  },
  payment_received: {
    icon: CreditCard,
    label: 'Payment Received',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
  },
  message_received: {
    icon: MessageSquare,
    label: 'New Message',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
  },
  verification_update: {
    icon: ShieldCheck,
    label: 'Verification Update',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
  },
  promotional: {
    icon: Tag,
    label: 'Promotional',
    color: 'text-pink-600',
    bgColor: 'bg-pink-500/10',
  },
};

export const priorityColors: Record<NotificationPriority, string> = {
  low: 'bg-gray-500/20 text-gray-600',
  medium: 'bg-blue-500/20 text-blue-600',
  high: 'bg-orange-500/20 text-orange-600',
  urgent: 'bg-red-500/20 text-red-600',
};

// ============================================
// ZUSTAND STORE FOR NOTIFICATIONS
// ============================================

interface NotificationState {
  notifications: Notification[];
  preferences: NotificationPreferences;
  toasts: ToastNotification[];
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (type: NotificationType, channel: 'inApp' | 'email' | 'sms', value: boolean) => void;
  
  // Toast actions
  showToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;
  
  // Getters
  getUnreadCount: () => number;
  getNotificationsByType: (type: NotificationType) => Notification[];
  getNotificationsByReadStatus: (read: boolean) => Notification[];
}

export const defaultPreferences: NotificationPreferences = {
  booking_confirmed: { inApp: true, email: true, sms: false },
  booking_cancelled: { inApp: true, email: true, sms: true },
  new_review: { inApp: true, email: true, sms: false },
  payment_received: { inApp: true, email: true, sms: false },
  message_received: { inApp: true, email: false, sms: false },
  verification_update: { inApp: true, email: true, sms: true },
  promotional: { inApp: true, email: false, sms: false },
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  preferences: defaultPreferences,
  toasts: [],

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAsUnread: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: false } : n
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  deleteNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  updatePreferences: (type, channel, value) => {
    set((state) => ({
      preferences: {
        ...state.preferences,
        [type]: {
          ...state.preferences[type],
          [channel]: value,
        },
      },
    }));
  },

  showToast: (toast) => {
    const newToast: ToastNotification = {
      ...toast,
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto dismiss after duration
    const duration = toast.duration ?? 5000;
    setTimeout(() => {
      get().dismissToast(newToast.id);
    }, duration);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },

  getNotificationsByType: (type) => {
    return get().notifications.filter((n) => n.type === type);
  },

  getNotificationsByReadStatus: (read) => {
    return get().notifications.filter((n) => n.read === read);
  },
}));

// ============================================
// CUSTOM HOOK: useNotifications
// ============================================

export const useNotifications = () => {
  const store = useNotificationStore();
  
  return {
    notifications: store.notifications,
    preferences: store.preferences,
    toasts: store.toasts,
    unreadCount: store.getUnreadCount(),
    addNotification: store.addNotification,
    markAsRead: store.markAsRead,
    markAsUnread: store.markAsUnread,
    markAllAsRead: store.markAllAsRead,
    deleteNotification: store.deleteNotification,
    clearAll: store.clearAll,
    updatePreferences: store.updatePreferences,
    showToast: store.showToast,
    dismissToast: store.dismissToast,
    getNotificationsByType: store.getNotificationsByType,
    getNotificationsByReadStatus: store.getNotificationsByReadStatus,
  };
};

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const toastIcons: Record<ToastType, React.ElementType> = {
  success: Check,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
};

const toastIconColors: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = 'top-right',
}) => {
  const { toasts, dismissToast } = useNotifications();

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2 pointer-events-none',
        positionClasses[position]
      )}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type];
          
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto w-80 rounded-xl border backdrop-blur-xl p-4 shadow-lg',
                'glass-card',
                toastStyles[toast.type]
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex-shrink-0 mt-0.5', toastIconColors[toast.type])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{toast.title}</p>
                  {toast.message && (
                    <p className="text-sm text-muted-foreground mt-1">{toast.message}</p>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// NOTIFICATION ITEM COMPONENT
// ============================================

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  compact = false,
}) => {
  const config = notificationTypeConfig[notification.type];
  const Icon = config.icon;
  const timeAgo = formatTimeAgo(notification.timestamp);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'group relative rounded-xl transition-all duration-200',
        !notification.read && 'bg-primary/5',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('flex-shrink-0 rounded-full p-2', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={cn(
              'text-sm font-medium truncate',
              !notification.read && 'text-foreground',
              notification.read && 'text-muted-foreground'
            )}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityColors[notification.priority])}>
              {notification.priority}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {notification.read ? (
                <DropdownMenuItem onClick={() => onMarkAsUnread(notification.id)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Mark as unread
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onMarkAsRead(notification.id)}>
                  <Check className="h-4 w-4 mr-2" />
                  Mark as read
                </DropdownMenuItem>
              )}
              {notification.actionUrl && (
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {notification.actionLabel || 'View details'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(notification.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// NOTIFICATION BELL COMPONENT
// ============================================

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, markAsUnread, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = React.useState(false);

  const recentNotifications = notifications.slice(0, 5);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'relative p-2 rounded-xl transition-all duration-200',
            'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50',
            'glass-card !p-2',
            className
          )}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-destructive text-white text-xs font-medium flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-96 p-0 glass-card border-0 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notifications</h3>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-96">
          {recentNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <AnimatePresence>
                {recentNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onMarkAsUnread={markAsUnread}
                    onDelete={deleteNotification}
                    compact
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border/50">
          <GlassButton
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setIsOpen(false)}
          >
            View all notifications
          </GlassButton>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ============================================
// NOTIFICATION CENTER COMPONENT
// ============================================

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const {
    notifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  
  const [filterType, setFilterType] = React.useState<NotificationType | 'all'>('all');
  const [filterRead, setFilterRead] = React.useState<'all' | 'read' | 'unread'>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Filter notifications
  const filteredNotifications = React.useMemo(() => {
    let result = [...notifications];

    if (filterType !== 'all') {
      result = result.filter((n) => n.type === filterType);
    }

    if (filterRead === 'read') {
      result = result.filter((n) => n.read);
    } else if (filterRead === 'unread') {
      result = result.filter((n) => !n.read);
    }

    return result;
  }, [notifications, filterType, filterRead]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkMarkRead = () => {
    selectedIds.forEach((id) => markAsRead(id));
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteNotification(id));
    setSelectedIds(new Set());
  };

  return (
    <div className={cn('w-full', className)}>
      <FadeIn>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notification Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage and view all your notifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={!notifications.some((n) => !n.read)}
              leftIcon={<CheckCheck className="h-4 w-4" />}
            >
              Mark all read
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={notifications.length === 0}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Clear all
            </GlassButton>
          </div>
        </div>

        {/* Filters and Controls */}
        <GlassCard className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={filterType} onValueChange={(v) => setFilterType(v as NotificationType | 'all')}>
                <SelectTrigger className="w-40 glass-card">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(notificationTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterRead} onValueChange={(v) => setFilterRead(v as 'all' | 'read' | 'unread')}>
                <SelectTrigger className="w-32 glass-card">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkRead}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Mark read
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Delete
                </GlassButton>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Notifications List */}
        <GlassCard variant="elevated" className="overflow-hidden">
          {/* Select All Header */}
          {filteredNotifications.length > 0 && (
            <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-muted/30">
              <Checkbox
                checked={selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                Select all ({filteredNotifications.length} notifications)
              </span>
            </div>
          )}

          {/* Notification Items */}
          <ScrollArea className="max-h-[600px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <BellOff className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No notifications found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                <AnimatePresence>
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <Checkbox
                        checked={selectedIds.has(notification.id)}
                        onCheckedChange={() => handleSelectOne(notification.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <NotificationItem
                          notification={notification}
                          onMarkAsRead={markAsRead}
                          onMarkAsUnread={markAsUnread}
                          onDelete={deleteNotification}
                        />
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </GlassCard>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <GlassCard className="text-center">
            <p className="text-2xl font-bold text-foreground">{notifications.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </GlassCard>
          <GlassCard className="text-center">
            <p className="text-2xl font-bold text-primary">
              {notifications.filter((n) => !n.read).length}
            </p>
            <p className="text-sm text-muted-foreground">Unread</p>
          </GlassCard>
          <GlassCard className="text-center">
            <p className="text-2xl font-bold text-orange-500">
              {notifications.filter((n) => n.priority === 'high' || n.priority === 'urgent').length}
            </p>
            <p className="text-sm text-muted-foreground">High Priority</p>
          </GlassCard>
          <GlassCard className="text-center">
            <p className="text-2xl font-bold text-green-500">
              {notifications.filter((n) => n.type === 'booking_confirmed' || n.type === 'payment_received').length}
            </p>
            <p className="text-sm text-muted-foreground">This Week</p>
          </GlassCard>
        </div>
      </FadeIn>
    </div>
  );
};

// ============================================
// NOTIFICATION PREFERENCES COMPONENT
// ============================================

interface NotificationPreferencesProps {
  className?: string;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ className }) => {
  const { preferences, updatePreferences } = useNotifications();

  const channels = [
    { key: 'inApp' as const, label: 'In-App', icon: Bell },
    { key: 'email' as const, label: 'Email', icon: Mail },
    { key: 'sms' as const, label: 'SMS', icon: Smartphone },
  ];

  return (
    <FadeIn className={cn('w-full', className)}>
      <GlassCard variant="elevated">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Notification Preferences</h2>
        </div>

        <div className="space-y-6">
          {Object.entries(notificationTypeConfig).map(([type, config]) => {
            const Icon = config.icon;
            const notificationType = type as NotificationType;
            const prefs = preferences[notificationType];

            return (
              <div
                key={type}
                className="p-4 rounded-xl bg-muted/30 border border-border/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('p-2 rounded-full', config.bgColor)}>
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <div>
                    <h3 className="font-medium">{config.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Notifications about {config.label.toLowerCase()} events
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {channels.map((channel) => {
                    const ChannelIcon = channel.icon;
                    return (
                      <label
                        key={channel.key}
                        className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Switch
                          checked={prefs[channel.key]}
                          onCheckedChange={(checked) =>
                            updatePreferences(notificationType, channel.key, checked)
                          }
                        />
                        <div className="flex items-center gap-2">
                          <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{channel.label}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Separator className="my-6" />
        <div className="flex flex-wrap gap-3">
          <GlassButton
            variant="outline"
            size="sm"
            onClick={() => {
              Object.keys(notificationTypeConfig).forEach((type) => {
                updatePreferences(type as NotificationType, 'inApp', true);
                updatePreferences(type as NotificationType, 'email', true);
                updatePreferences(type as NotificationType, 'sms', false);
              });
            }}
          >
            Enable All
          </GlassButton>
          <GlassButton
            variant="outline"
            size="sm"
            onClick={() => {
              Object.keys(notificationTypeConfig).forEach((type) => {
                updatePreferences(type as NotificationType, 'inApp', false);
                updatePreferences(type as NotificationType, 'email', false);
                updatePreferences(type as NotificationType, 'sms', false);
              });
            }}
          >
            Disable All
          </GlassButton>
          <GlassButton
            variant="outline"
            size="sm"
            onClick={() => {
              Object.keys(notificationTypeConfig).forEach((type) => {
                updatePreferences(type as NotificationType, 'inApp', true);
                updatePreferences(type as NotificationType, 'email', false);
                updatePreferences(type as NotificationType, 'sms', false);
              });
            }}
          >
            In-App Only
          </GlassButton>
        </div>
      </GlassCard>
    </FadeIn>
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  return date.toLocaleDateString();
}

// ============================================
// EXPORTS
// ============================================
// Main exports are done inline above
