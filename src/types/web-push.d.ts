declare module 'web-push' {
  interface SendResult {
    status: number;
    body?: string;
    headers?: Record<string, string>;
  }

  interface WebPushError extends Error {
    status: number;
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
    endpoint: string;
  }

  function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  function sendNotification(
    subscription: { endpoint: string; keys: { auth: string; p256dh: string } },
    payload?: string | null,
    options?: { TTL?: number; urgency?: 'normal' | 'low' | 'high'; topic?: string }
  ): Promise<SendResult>;

  function generateVAPIDKeys(): { publicKey: string; privateKey: string };

  export { setVapidDetails, sendNotification, generateVAPIDKeys, WebPushError };

  const _default: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
    generateVAPIDKeys: typeof generateVAPIDKeys;
  };
  export default _default;
}
