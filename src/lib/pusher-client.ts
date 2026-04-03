import Pusher from 'pusher-js';

// Client-side Pusher client
const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

let pusherClient: Pusher | null = null;

export function getPusherClient() {
  if (!pusherClient && pusherKey) {
    pusherClient = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });
  }
  return pusherClient;
}

// Subscribe to a channel
export function subscribeToChannel(channelName: string) {
  const pusher = getPusherClient();
  if (!pusher) return null;
  return pusher.subscribe(channelName);
}

// Unsubscribe from a channel
export function unsubscribeFromChannel(channelName: string) {
  const pusher = getPusherClient();
  if (!pusher) return;
  pusher.unsubscribe(channelName);
}

// Bind to an event
export function bindToEvent(
  channelName: string,
  eventName: string,
  callback: (data: unknown) => void
) {
  const pusher = getPusherClient();
  if (!pusher) return () => {};

  const channel = pusher.subscribe(channelName);
  channel.bind(eventName, callback);

  return () => {
    channel.unbind(eventName, callback);
  };
}

// Chat hook helpers
export const ChatEvents = {
  NEW_MESSAGE: 'new-message',
  TYPING_START: 'typing-start',
  TYPING_STOP: 'typing-stop',
} as const;
