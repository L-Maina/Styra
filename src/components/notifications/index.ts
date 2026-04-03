// Notification System Exports
export {
  // Components
  NotificationBell,
  NotificationCenter,
  ToastContainer,
  NotificationItem,
  
  // Hooks
  useNotifications,
  useNotificationStore,
  
  // Types
  type Notification,
  type NotificationType,
  type NotificationPriority,
  type ToastNotification,
  type ToastType,
  
  // Utils
  notificationTypeConfig,
  priorityColors,
  defaultPreferences,
} from './NotificationSystem';

// Re-export NotificationPreferences component with an alias to avoid conflict with the interface
export { NotificationPreferences as NotificationPreferencesComponent } from './NotificationSystem';

// Re-export the interface type
export type { NotificationPreferences } from './NotificationSystem';

// Default export - NotificationCenter
export { NotificationCenter as default } from './NotificationSystem';
