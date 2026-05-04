import Pusher from 'pusher';

// Server-side Pusher client (for API routes)
// Lazy initialization to avoid crashes when env vars are missing
let _pusherServer: Pusher | null = null;

function getPusherServer(): Pusher | null {
  if (_pusherServer) return _pusherServer;
  if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_SECRET) {
    return null;
  }
  _pusherServer = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
    useTLS: true,
  });
  return _pusherServer;
}

export { getPusherServer };

// Export a getter instead of a direct instance
export const pusherServer = {
  trigger: (...args: Parameters<Pusher['trigger']>) => {
    const p = getPusherServer();
    if (!p) return Promise.resolve();
    return p.trigger(...args);
  },
};

// Channel names
export const CHANNELS = {
  CHAT: (conversationId: string) => `chat-${conversationId}`,
  USER_NOTIFICATIONS: (userId: string) => `user-${userId}`,
  BUSINESS: (businessId: string) => `business-${businessId}`,
  ADMIN: 'admin-channel',
} as const;

// Event names
export const EVENTS = {
  // Chat events
  NEW_MESSAGE: 'new-message',
  TYPING_START: 'typing-start',
  TYPING_STOP: 'typing-stop',
  MESSAGE_READ: 'message-read',

  // Notification events
  NEW_NOTIFICATION: 'new-notification',
  BOOKING_UPDATE: 'booking-update',
  PAYMENT_UPDATE: 'payment-update',

  // Business events
  NEW_BOOKING: 'new-booking',
  BOOKING_CANCELLED: 'booking-cancelled',
  NEW_REVIEW: 'new-review',

  // Admin events
  NEW_USER: 'new-user',
  NEW_BUSINESS: 'new-business',
} as const;

// Helper to send message
export async function sendChatMessage(
  conversationId: string,
  message: {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    createdAt: string;
  }
) {
  await pusherServer.trigger(
    CHANNELS.CHAT(conversationId),
    EVENTS.NEW_MESSAGE,
    message
  );

  // Also notify the receiver
  await pusherServer.trigger(
    CHANNELS.USER_NOTIFICATIONS(message.receiverId),
    EVENTS.NEW_NOTIFICATION,
    {
      type: 'NEW_MESSAGE',
      message: message.content.substring(0, 100),
      conversationId,
    }
  );
}

// Helper to send typing indicator
export async function sendTypingIndicator(
  conversationId: string,
  userId: string,
  isTyping: boolean
) {
  await pusherServer.trigger(
    CHANNELS.CHAT(conversationId),
    isTyping ? EVENTS.TYPING_START : EVENTS.TYPING_STOP,
    { userId }
  );
}

// Helper to send booking notification
export async function sendBookingNotification(
  businessOwnerId: string,
  booking: { id: string; status: string; customerId: string }
) {
  await pusherServer.trigger(
    CHANNELS.USER_NOTIFICATIONS(businessOwnerId),
    EVENTS.NEW_BOOKING,
    booking
  );
}

// Helper to send notification to user
export async function sendUserNotification(
  userId: string,
  notification: { type: string; title: string; message: string; data?: unknown }
) {
  await pusherServer.trigger(
    CHANNELS.USER_NOTIFICATIONS(userId),
    EVENTS.NEW_NOTIFICATION,
    notification
  );
}
