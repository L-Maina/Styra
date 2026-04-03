/**
 * Environment Configuration — Typed, validated, environment-aware.
 *
 * This is the SINGLE SOURCE OF TRUTH for all environment configuration.
 * Every module that needs env vars MUST import from here.
 *
 * ENVIRONMENT TIERS:
 *   development — Local dev, dev fallbacks allowed, verbose logging
 *   test        — CI/testing, stubs allowed
 *   staging     — Pre-production, real APIs, no fallbacks
 *   production  — Live, real APIs, no fallbacks, minimal logging
 *
 * SECURITY RULES:
 *   - In production: dev fallbacks are DISABLED (strict mode)
 *   - Placeholder values (e.g. "sk_test_placeholder") are REJECTED in staging/production
 *   - Missing required secrets cause CRASH on startup (fail-closed)
 */

// ── Environment Tier ────────────────────────────────────────────────────────

export type EnvironmentTier = 'development' | 'test' | 'staging' | 'production';

export function getEnvTier(): EnvironmentTier {
  return (process.env.NODE_ENV as EnvironmentTier) || 'development';
}

export function isDev(): boolean {
  return getEnvTier() === 'development';
}

export function isTest(): boolean {
  return getEnvTier() === 'test';
}

export function isStaging(): boolean {
  return getEnvTier() === 'staging';
}

export function isProd(): boolean {
  return getEnvTier() === 'production';
}

/** Strict mode: no dev fallbacks allowed (staging + production) */
export function isStrictMode(): boolean {
  return isStaging() || isProd();
}

// ── Placeholder Detection ──────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  'placeholder',
  '_test_',
  '_dev_',
  'changeme',
  'your_',
  'todo',
  'example',
  'xxx',
  'weak',
  'secrets',
];

function isPlaceholderValue(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => lower.includes(p));
}

// ── Required Secret Validation ─────────────────────────────────────────────

interface SecretConfig {
  name: string;
  envKey: string;
  requiredIn: EnvironmentTier[];
  minLength?: number;
  rejectPlaceholders?: boolean;
}

const REQUIRED_SECRETS: SecretConfig[] = [
  {
    name: 'JWT Secret',
    envKey: 'JWT_SECRET',
    requiredIn: ['development', 'staging', 'production'],
    minLength: 32,
    rejectPlaceholders: true,
  },
  {
    name: 'Database URL',
    envKey: 'DATABASE_URL',
    requiredIn: ['development', 'staging', 'production'],
    rejectPlaceholders: false,
  },
  {
    name: 'Stripe Secret Key',
    envKey: 'STRIPE_SECRET_KEY',
    requiredIn: ['staging', 'production'],
    rejectPlaceholders: true,
  },
  {
    name: 'Stripe Webhook Secret',
    envKey: 'STRIPE_WEBHOOK_SECRET',
    requiredIn: ['staging', 'production'],
    rejectPlaceholders: true,
  },
  {
    name: 'Resend API Key',
    envKey: 'RESEND_API_KEY',
    requiredIn: ['staging', 'production'],
    rejectPlaceholders: true,
  },
];

/**
 * Validate all required secrets for the current environment tier.
 * Called at module load time to fail-fast on misconfiguration.
 *
 * @returns Array of validation errors (empty = all valid)
 */
export function validateEnvironment(): string[] {
  const tier = getEnvTier();
  const errors: string[] = [];

  for (const secret of REQUIRED_SECRETS) {
    if (!secret.requiredIn.includes(tier)) continue;

    const value = process.env[secret.envKey];

    if (!value) {
      errors.push(`[ENV] ${secret.name} (${secret.envKey}) is required in ${tier}`);
      continue;
    }

    if (secret.minLength && value.length < secret.minLength) {
      errors.push(
        `[ENV] ${secret.name} (${secret.envKey}) is too short: ${value.length} chars (min: ${secret.minLength})`
      );
    }

    if (secret.rejectPlaceholders && isPlaceholderValue(value)) {
      errors.push(
        `[ENV] ${secret.name} (${secret.envKey}) appears to be a placeholder value. Set a real secret.`
      );
    }
  }

  return errors;
}

// ── Application Config ─────────────────────────────────────────────────────

export interface AppConfig {
  /** Current environment tier */
  env: EnvironmentTier;
  /** Whether strict mode is active (no dev fallbacks) */
  strict: boolean;
  /** Application URL (public) */
  appUrl: string;
  /** JWT configuration */
  jwt: {
    secret: string;
    expiresIn: string;
    issuer: string;
  };
  /** Database */
  database: {
    url: string;
  };
  /** Stripe */
  stripe: {
    publishableKey: string;
    secretKey: string | null;
    webhookSecret: string | null;
    isConfigured: boolean;
  };
  /** PayPal */
  paypal: {
    clientId: string | null;
    clientSecret: string | null;
    webhookSecret: string | null;
    mode: 'sandbox' | 'live';
    isConfigured: boolean;
  };
  /** Paystack */
  paystack: {
    secretKey: string | null;
    publicKey: string | null;
    webhookSecret: string | null;
    isConfigured: boolean;
  };
  /** M-Pesa */
  mpesa: {
    consumerKey: string | null;
    consumerSecret: string | null;
    passkey: string | null;
    shortcode: string | null;
    env: 'sandbox' | 'production';
    callbackUrl: string | null;
    isConfigured: boolean;
  };
  /** Email */
  email: {
    apiKey: string | null;
    from: string;
    isConfigured: boolean;
  };
  /** Rate limiting */
  rateLimit: {
    /** Global rate limit (requests per minute per IP) */
    globalRpm: number;
    /** Auth endpoints rate limit (requests per window) */
    authMax: number;
    /** Auth endpoints window (seconds) */
    authWindow: number;
  };
  /** CORS */
  cors: {
    origins: string[];
  };
  /** Cron secret for automated cleanup endpoints */
  cronSecret: string | null;
  /** Feature flags */
  features: {
    /** Allow dev-mode payment fallbacks */
    devPaymentFallback: boolean;
    /** Enable verbose error logging */
    verboseErrors: boolean;
    /** Enable audit log hash chain */
    auditHashChain: boolean;
    /** Enable security alerts */
    securityAlerts: boolean;
  };
}

// ── Build Phase Detection (MUST be before buildConfig) ───────────────
const _isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.__NEXT_BUILD_PHASE !== undefined ||
  // Vercel build phase: VERCEL=1 is set but VERCEL_URL is not yet available
  (process.env.VERCEL === '1' && !process.env.VERCEL_URL);

// ── Build Config ───────────────────────────────────────────────────────────

function buildConfig(): AppConfig {
  const tier = getEnvTier();
  const strict = isStrictMode();

  // JWT — skip fatal throw during Next.js build phase (secrets not available at build time)
  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret && !_isBuildPhase && tier !== 'test') {
    if (tier === 'development') {
      console.warn(
        '[ENV] ⚠️  JWT_SECRET is not set. Auth features will not work. Add it to your .env file.'
      );
    } else {
      throw new Error(
        '[FATAL] JWT_SECRET is not set. This is a critical security misconfiguration.'
      );
    }
  }

  // Stripe
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  const stripeIsPlaceholder = stripeSecretKey && isPlaceholderValue(stripeSecretKey);
  const stripeConfigured = !!(
    stripeSecretKey &&
    !stripeIsPlaceholder &&
    stripeWebhookSecret &&
    !isPlaceholderValue(stripeWebhookSecret)
  );

  // In strict mode, placeholder Stripe keys are treated as NOT configured
  const effectiveStripeKey = (strict && stripeIsPlaceholder) ? null : stripeSecretKey;
  const effectiveStripeWebhook = (strict && stripeWebhookSecret && isPlaceholderValue(stripeWebhookSecret))
    ? null
    : stripeWebhookSecret;

  // PayPal
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || null;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || null;
  const paypalWebhookSecret = process.env.PAYPAL_WEBHOOK_SECRET || null;
  const paypalMode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
  const paypalConfigured = !!(paypalClientId && paypalClientSecret);

  // Paystack
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || null;
  const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY || null;
  const paystackWebhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || null;
  const paystackConfigured = !!(paystackSecretKey && paystackWebhookSecret);

  // M-Pesa
  const mpesaConfigured = !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_BUSINESS_SHORTCODE &&
    process.env.MPESA_ONLINE_PASSKEY
  );

  // Email
  const resendApiKey = process.env.RESEND_API_KEY || null;
  const emailConfigured = !!resendApiKey;

  return {
    env: tier,
    strict,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'styra',
    },

    database: {
      url: process.env.DATABASE_URL || '', // Must be set explicitly (PostgreSQL / Supabase)
    },

    stripe: {
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      secretKey: effectiveStripeKey,
      webhookSecret: effectiveStripeWebhook,
      isConfigured: strict ? stripeConfigured : !!effectiveStripeKey,
    },

    paystack: {
      secretKey: paystackSecretKey,
      publicKey: paystackPublicKey,
      webhookSecret: paystackWebhookSecret,
      isConfigured: paystackConfigured,
    },

    paypal: {
      clientId: paypalClientId,
      clientSecret: paypalClientSecret,
      webhookSecret: paypalWebhookSecret,
      mode: paypalMode,
      isConfigured: paypalConfigured,
    },

    mpesa: {
      consumerKey: process.env.MPESA_CONSUMER_KEY || null,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || null,
      passkey: process.env.MPESA_ONLINE_PASSKEY || null,
      shortcode: process.env.MPESA_BUSINESS_SHORTCODE || null,
      env: process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
      callbackUrl: process.env.MPESA_CALLBACK_URL || null,
      isConfigured: mpesaConfigured,
    },

    email: {
      apiKey: resendApiKey,
      from: process.env.EMAIL_FROM || 'Styra <noreply@styra.app>',
      isConfigured: emailConfigured,
    },

    rateLimit: {
      globalRpm: parseInt(process.env.RATE_LIMIT_GLOBAL_RPM || '200', 10),
      authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
      authWindow: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || '900', 10),
    },

    cors: {
      origins: (process.env.CORS_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
        .split(',')
        .map(s => s.trim()),
    },

    cronSecret: process.env.CRON_SECRET || null,

    features: {
      // DEV FALLBACKS ARE DISABLED IN STRICT MODE
      devPaymentFallback: !strict,
      verboseErrors: !strict,
      auditHashChain: true,
      securityAlerts: true,
    },
  };
}

// ── Lazy Singleton Export ────────────────────────────────────────────────

/**
 * Application configuration — LAZY singleton.
 *
 * Uses a getter so the config is only built when first accessed at RUNTIME,
 * not at module import time. This prevents `next build` from crashing when
 * env vars like JWT_SECRET / DATABASE_URL are not set during CI builds.
 *
 * Access via: import { env } from '@/lib/env';
 */
let _cachedConfig: AppConfig | null = null;

export const env: AppConfig = new Proxy({} as AppConfig, {
  get(_target, prop, receiver) {
    if (!_cachedConfig) {
      _cachedConfig = buildConfig();
    }
    const value = Reflect.get(_cachedConfig, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(_cachedConfig);
    }
    return value;
  },
});

// ── Startup Validation ─────────────────────────────────────────────────────

/**
 * Run startup validation.
 * Call this explicitly from your entry point (e.g. instrumentation.ts)
 * — it is NOT run automatically at import time.
 *
 * In production: crashes on misconfiguration (fail-closed).
 * In development: logs warnings but continues.
 */
export function ensureValidEnvironment(): void {
  // Force config to build (triggers validation inside buildConfig)
  const errors = validateEnvironment();

  if (errors.length === 0) {
    if (!isProd()) {
      console.log(`[ENV] ✅ Environment validated (${env.env})`);
      if (isDev()) {
        console.log('[ENV] ⚠️  Dev fallbacks ENABLED (strict mode OFF)');
      }
    }
    return;
  }

  if (isStrictMode()) {
    console.error('[ENV] ❌ CRITICAL: Environment validation failed:');
    errors.forEach(err => console.error(`  ${err}`));
    console.error('[ENV] Application will NOT start until these are fixed.');
    throw new Error(`Environment misconfiguration: ${errors.join('; ')}`);
  }

  console.warn('[ENV] ⚠️  Environment validation warnings (dev mode — continuing):');
  errors.forEach(err => console.warn(`  ${err}`));
}
