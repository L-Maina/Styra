'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Pusher from 'pusher-js';
import { useAuthStore } from '@/store';

// Pusher configuration
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

interface UsePusherOptions {
  onMessage?: (message: unknown) => void;
  onNotification?: (notification: unknown) => void;
  onTyping?: (data: { userId: string; isTyping: boolean }) => void;
  onBookingUpdate?: (booking: unknown) => void;
}

export function usePusher(options: UsePusherOptions = {}) {
  const pusherRef = useRef<Pusher | null>(null);
  const channelsRef = useRef<Map<string, any>>(new Map());
  const { user, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);

  // Initialize Pusher
  useEffect(() => {
    if (!isAuthenticated || !PUSHER_KEY || !user) return;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: '/api/pusher/auth',
      auth: {
        headers: {},
      },
    });

    pusherRef.current = pusher;

    pusher.connection.bind('connected', () => {
      setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
    });

    // Subscribe to user's notification channel
    const userChannel = pusher.subscribe(`user-${user.id}`);

    userChannel.bind('new-notification', (data: unknown) => {
      options.onNotification?.(data);
    });

    userChannel.bind('booking-update', (data: unknown) => {
      options.onBookingUpdate?.(data);
    });

    channelsRef.current.set(`user-${user.id}`, userChannel);

    return () => {
      pusher.disconnect();
      channelsRef.current.clear();
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id]);

  // Subscribe to a chat channel
  const subscribeToChat = useCallback((conversationId: string) => {
    if (!pusherRef.current) return null;

    const channelName = `chat-${conversationId}`;
    let channel = channelsRef.current.get(channelName);

    if (!channel) {
      channel = pusherRef.current.subscribe(channelName);

      channel.bind('new-message', (data: unknown) => {
        options.onMessage?.(data);
      });

      channel.bind('typing-start', (data: { userId: string }) => {
        options.onTyping?.({ userId: data.userId, isTyping: true });
      });

      channel.bind('typing-stop', (data: { userId: string }) => {
        options.onTyping?.({ userId: data.userId, isTyping: false });
      });

      channelsRef.current.set(channelName, channel);
    }

    return channel;
  }, [options]);

  // Unsubscribe from a chat channel
  const unsubscribeFromChat = useCallback((conversationId: string) => {
    const channelName = `chat-${conversationId}`;
    const channel = channelsRef.current.get(channelName);

    if (channel && pusherRef.current) {
      pusherRef.current.unsubscribe(channelName);
      channelsRef.current.delete(channelName);
    }
  }, []);

  // Subscribe to a business channel
  const subscribeToBusiness = useCallback((businessId: string) => {
    if (!pusherRef.current) return null;

    const channelName = `business-${businessId}`;
    let channel = channelsRef.current.get(channelName);

    if (!channel) {
      channel = pusherRef.current.subscribe(channelName);

      channel.bind('new-booking', (data: unknown) => {
        options.onBookingUpdate?.(data);
      });

      channelsRef.current.set(channelName, channel);
    }

    return channel;
  }, [options]);

  return {
    subscribeToChat,
    unsubscribeFromChat,
    subscribeToBusiness,
    isConnected,
  };
}

// Hook for chat functionality
export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<unknown[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const { subscribeToChat, unsubscribeFromChat } = usePusher({
    onMessage: (message) => {
      setMessages(prev => [...prev, message]);
    },
    onTyping: ({ userId, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          return prev.includes(userId) ? prev : [...prev, userId];
        } else {
          return prev.filter(id => id !== userId);
        }
      });
    },
  });

  useEffect(() => {
    if (conversationId) {
      subscribeToChat(conversationId);
    }

    return () => {
      if (conversationId) {
        unsubscribeFromChat(conversationId);
      }
    };
  }, [conversationId, subscribeToChat, unsubscribeFromChat]);

  return {
    messages,
    typingUsers,
  };
}
