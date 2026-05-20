// ============================================
// INPUT SANITIZATION & PAYLOAD SIZE LIMITS
// ============================================
// Comprehensive input sanitization and payload validation.
// Applied as a middleware-level check for all API routes.
//
// DEFENSES:
//   1. Payload size limits (prevents DoS via large payloads)
//   2. Content-Type validation (prevents content smuggling)
//   3. Deeply-nested JSON rejection (prevents parser abuse)
//   4. String field sanitization (XSS, NoSQL injection)
//   5. Prototype pollution prevention
//   6. Key count limits (prevents hash flooding)

// ============================================
// CONFIGURATION
// ============================================

/** Maximum request body size in bytes */
const MAX_PAYLOAD_SIZE = parseInt(process.env.MAX_PAYLOAD_SIZE || '1048576', 10); // 1MB default

/** Maximum JSON nesting depth */
const MAX_JSON_DEPTH = parseInt(process.env.MAX_JSON_DEPTH || '10', 10);

/** Maximum number of keys in a single object */
const MAX_OBJECT_KEYS = parseInt(process.env.MAX_OBJECT_KEYS || '100', 10);

/** Maximum string field length (individual fields) */
const MAX_STRING_LENGTH = parseInt(process.env.MAX_STRING_LENGTH || '100000', 10); // 100KB

/** Routes exempt from payload size limits (e.g., file uploads) */
const SIZE_EXEMPT_ROUTES = [
  '/api/businesses/cover-image',
  '/api/businesses/portfolio',
  '/api/upload',
];

// ============================================
// TYPES
// ============================================

export interface SanitizationResult {
  valid: boolean;
  error?: string;
  sanitized?: unknown;
}

// ============================================
// PAYLOAD SIZE CHECK
// ============================================

/**
 * Check if a request's content length exceeds the limit.
 * Returns null if OK, or an error Response if too large.
 */
export function checkPayloadSize(request: Request): Response | null {
  const { pathname } = new URL(request.url);

  // Skip for exempt routes (file uploads)
  if (SIZE_EXEMPT_ROUTES.some(route => pathname.startsWith(route))) {
    return null;
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Request payload too large.',
        maxSize: MAX_PAYLOAD_SIZE,
      }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

// ============================================
// CONTENT-TYPE VALIDATION
// ============================================

const ALLOWED_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

/**
 * Validate the Content-Type header for state-changing requests.
 * Returns null if OK, or an error Response if invalid.
 */
export function validateContentType(request: Request): Response | null {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return null;
  }

  const contentType = request.headers.get('content-type');
  if (!contentType) {
    // Allow requests without content-type (some legacy clients)
    return null;
  }

  const baseType = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(baseType)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unsupported Content-Type.',
      }),
      {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

// ============================================
// JSON DEPTH & KEY COUNT VALIDATION
// ============================================

/**
 * Validate and sanitize a parsed JSON object.
 * Checks for:
 *   - Excessive nesting depth
 *   - Excessive key count per object
 *   - Prototype pollution attempts
 *   - Oversized string fields
 *
 * Returns a SanitizationResult with the sanitized object or an error.
 */
export function sanitizeJsonObject(
  obj: unknown,
  depth: number = 0,
): SanitizationResult {
  // Check nesting depth
  if (depth > MAX_JSON_DEPTH) {
    return {
      valid: false,
      error: `JSON nesting too deep (max: ${MAX_JSON_DEPTH} levels)`,
    };
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return { valid: true, sanitized: obj };
  }

  // Handle primitives
  if (typeof obj === 'number') {
    // Reject NaN and Infinity (could cause issues in DB)
    if (!Number.isFinite(obj)) {
      return {
        valid: false,
        error: 'Invalid number value (NaN or Infinity not allowed)',
      };
    }
    return { valid: true, sanitized: obj };
  }

  if (typeof obj === 'boolean') {
    return { valid: true, sanitized: obj };
  }

  // Handle strings
  if (typeof obj === 'string') {
    if (obj.length > MAX_STRING_LENGTH) {
      return {
        valid: false,
        error: `String value too long (max: ${MAX_STRING_LENGTH} characters)`,
      };
    }
    return { valid: true, sanitized: sanitizeString(obj) };
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length > 1000) {
      return {
        valid: false,
        error: 'Array too long (max: 1000 elements)',
      };
    }
    const sanitized: unknown[] = [];
    for (const item of obj) {
      const result = sanitizeJsonObject(item, depth + 1);
      if (!result.valid) return result;
      sanitized.push(result.sanitized);
    }
    return { valid: true, sanitized };
  }

  // Handle objects
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);

    // Check key count
    if (entries.length > MAX_OBJECT_KEYS) {
      return {
        valid: false,
        error: `Object has too many keys (max: ${MAX_OBJECT_KEYS})`,
      };
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of entries) {
      // Prototype pollution prevention
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        continue; // Silently strip dangerous keys
      }

      // Sanitize key name
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey.length === 0) {
        continue; // Skip empty keys after sanitization
      }

      // Recursively sanitize value
      const result = sanitizeJsonObject(value, depth + 1);
      if (!result.valid) return result;

      sanitized[sanitizedKey] = result.sanitized;
    }

    return { valid: true, sanitized };
  }

  // Unknown type — reject
  return {
    valid: false,
    error: `Unsupported value type: ${typeof obj}`,
  };
}

// ============================================
// STRING SANITIZATION
// ============================================

/**
 * Sanitize a string value.
 * - Strips script tags and event handlers
 * - Removes javascript: URLs
 * - Strips null bytes
 * - Trims whitespace
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, '')
    // Remove event handlers (onX=)
    .replace(/\bon\w+\s*=/gi, '')
    // Remove data: URLs that could execute code
    .replace(/data\s*:\s*text\/html/gi, '')
    // Remove vbscript:
    .replace(/vbscript\s*:/gi, '')
    // Trim whitespace
    .trim();
}

// ============================================
// FULL REQUEST SANITIZATION
// ============================================

/**
 * Full request sanitization pipeline.
 * Call this from API routes after parsing the request body.
 *
 * @param parsedBody - The parsed JSON body from request.json()
 * @returns SanitizationResult with the sanitized body or an error
 */
export function sanitizeRequestBody(parsedBody: unknown): SanitizationResult {
  // Reject empty bodies for POST/PUT/PATCH
  if (parsedBody === null || parsedBody === undefined) {
    return { valid: false, error: 'Request body is required' };
  }

  return sanitizeJsonObject(parsedBody);
}

// ============================================
// QUERY PARAMETER SANITIZATION
// ============================================

/**
 * Sanitize URL query parameters.
 * Limits the number of parameters and sanitizes each value.
 */
export function sanitizeQueryParams(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  let count = 0;

  for (const [key, value] of params.entries()) {
    // Limit parameter count
    if (count >= 50) break;

    // Prototype pollution prevention
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      continue;
    }

    // Sanitize key and value
    const sanitizedKey = sanitizeString(key);
    const sanitizedValue = sanitizeString(value);

    if (sanitizedKey.length > 0 && sanitizedValue.length <= 1000) {
      result[sanitizedKey] = sanitizedValue;
    }

    count++;
  }

  return result;
}
