// ============================================
// REQUEST CONTEXT — Correlation ID System
// ============================================
// Provides per-request correlation IDs.
// Uses module-level state (safe for single-threaded Node.js).

export interface RequestContext {
  requestId: string;
  startTime: number;
  ip: string;
  method: string;
  route: string;
  userAgent: string;
}

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 14);
  const random2 = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}${random2}`;
}

let _currentContext: RequestContext | null = null;

export function getRequestContext(): RequestContext | null {
  return _currentContext;
}

export function getRequestId(): string {
  return _currentContext?.requestId || 'unknown';
}

export function setRequestContext(context: RequestContext): void {
  _currentContext = context;
}

export function clearRequestContext(): void {
  _currentContext = null;
}

export function createContextFromRequest(req: any): RequestContext {
  const forwardedFor = req.headers?.get?.('x-forwarded-for');
  const realIp = req.headers?.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  return {
    requestId: req.headers?.get('x-request-id') || generateRequestId(),
    startTime: Date.now(),
    ip,
    method: req.method || 'GET',
    route: req.nextUrl?.pathname || 'unknown',
    userAgent: req.headers?.get('user-agent') || 'unknown',
  };
}
