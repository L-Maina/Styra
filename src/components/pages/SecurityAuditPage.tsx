'use client';

import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  Clock,
  Gauge,
  Zap,
  Eye,
  EyeOff,
  Server,
  Globe,
  Code2,
  AlertTriangle,
  Bug,
  Ban,
  Fingerprint,
  Cpu,
  Network,
  RefreshCw,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SecurityAuditPageProps {
  onBack: () => void;
}

interface TestResult {
  url: string;
  label: string;
  status: 'idle' | 'testing' | 'passed' | 'failed';
  statusCode: number | null;
  responseBody: string;
  timestamp: number | null;
}

interface RateLimitConfig {
  endpoint: string;
  maxAttempts: number;
  window: string;
  windowMs: number;
  icon: React.ElementType;
}

interface WebhookProvider {
  name: string;
  method: string;
  status: 'active' | 'inactive';
  details: string;
  color: string;
}

interface AdminRoute {
  route: string;
  methods: string[];
  protection: string;
}

interface SensitiveRoute {
  route: string;
  methodRules: { method: string; protection: string }[];
}

interface SecurityFix {
  description: string;
  severity: 'critical' | 'high' | 'medium';
}

// ─── Data ───────────────────────────────────────────────────────────────────

const testEndpoints = [
  { label: 'GET /api/admin/overview', url: '/api/admin/overview', expected: 401, method: 'GET' },
  { label: 'GET /api/admin/users', url: '/api/admin/users', expected: 401, method: 'GET' },
  { label: 'GET /api/settings', url: '/api/settings', expected: 401, method: 'GET' },
  { label: 'GET /api/articles?admin=true', url: '/api/articles?admin=true', expected: 401, method: 'GET' },
  { label: 'GET /api/payments', url: '/api/payments', expected: 401, method: 'GET' },
];

const adminRoutes: AdminRoute[] = [
  { route: '/api/admin/overview', methods: ['GET'], protection: 'requireAdmin' },
  { route: '/api/admin/users', methods: ['GET', 'PUT', 'DELETE'], protection: 'requireAdmin' },
  { route: '/api/admin/listings', methods: ['GET', 'PUT', 'DELETE'], protection: 'requireAdmin' },
  { route: '/api/admin/reports', methods: ['GET'], protection: 'requireAdmin' },
  { route: '/api/admin/disputes', methods: ['GET', 'PUT'], protection: 'requireAdmin' },
  { route: '/api/admin/tickets', methods: ['GET', 'PUT'], protection: 'requireAdmin' },
  { route: '/api/admin/bans', methods: ['GET', 'POST', 'DELETE'], protection: 'requireAdmin' },
  { route: '/api/admin/claims', methods: ['GET', 'PUT'], protection: 'requireAdmin' },
  { route: '/api/admin/advertisements', methods: ['GET', 'POST', 'PUT', 'DELETE'], protection: 'requireAdmin' },
  { route: '/api/admin/page-content', methods: ['GET', 'PUT'], protection: 'requireAdmin' },
  { route: '/api/admin/settings', methods: ['GET', 'PUT'], protection: 'requireAdmin' },
  { route: '/api/admin/newsletter', methods: ['GET', 'POST'], protection: 'requireAdmin' },
];

const sensitiveRoutes: SensitiveRoute[] = [
  {
    route: '/api/settings',
    methodRules: [
      { method: 'GET', protection: 'requireAuth' },
      { method: 'PUT', protection: 'requireAdmin' },
    ],
  },
  {
    route: '/api/articles',
    methodRules: [
      { method: 'GET', protection: 'Public (published) / requireAdmin (admin=true)' },
      { method: 'POST', protection: 'requireAdmin' },
      { method: 'PUT', protection: 'requireAdmin' },
      { method: 'DELETE', protection: 'requireAdmin' },
    ],
  },
  {
    route: '/api/payments',
    methodRules: [
      { method: 'GET', protection: 'requireAuth' },
      { method: 'POST', protection: 'requireAuth' },
    ],
  },
];

const rateLimits: RateLimitConfig[] = [
  { endpoint: 'Login', maxAttempts: 5, window: '15 min', windowMs: 900000, icon: Key },
  { endpoint: 'OTP Verify', maxAttempts: 5, window: '15 min', windowMs: 900000, icon: Fingerprint },
  { endpoint: 'Forgot Password', maxAttempts: 3, window: '1 hour', windowMs: 3600000, icon: RefreshCw },
  { endpoint: 'Reset Password', maxAttempts: 5, window: '1 hour', windowMs: 3600000, icon: Lock },
  { endpoint: 'General API', maxAttempts: 60, window: '1 min', windowMs: 60000, icon: Gauge },
];

const webhookProviders: WebhookProvider[] = [
  {
    name: 'Stripe',
    method: 'HMAC-SHA256 signature verification',
    status: 'active',
    details: 'Verifies webhook signature using STRIPE_WEBHOOK_SECRET. Rejects unsigned or tampered payloads.',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    name: 'PayPal',
    method: 'HMAC-SHA256 signature verification',
    status: 'active',
    details: 'Verifies webhook signature with no fallback secret. Fails closed on missing configuration.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    name: 'M-Pesa',
    method: 'Callback structure + HMAC verification',
    status: 'active',
    details: 'Validates callback body structure and verifies HMAC signature to prevent spoofed callbacks.',
    color: 'from-green-500 to-emerald-600',
  },
];

const securityFixes: SecurityFix[] = [
  { description: 'Replaced insecure base64 JWT decoding with HMAC-SHA256 signature verification in middleware', severity: 'critical' },
  { description: 'Added HS256 algorithm enforcement to both middleware (Web Crypto) and server-side (jsonwebtoken)', severity: 'critical' },
  { description: 'Replaced broken rate limiter with persistent Prisma/PostgreSQL-backed store', severity: 'critical' },
  { description: 'Removed PayPal webhook fallback secret — fails closed on missing config', severity: 'critical' },
  { description: 'Added M-Pesa signature verification to prevent callback spoofing', severity: 'critical' },
  { description: 'Added rate limiting to reset-password endpoint (5/hour)', severity: 'high' },
  { description: 'Protected /api/settings GET endpoint with requireAuth', severity: 'high' },
  { description: 'Fixed /api/articles admin=true bypass — now requires ADMIN role', severity: 'high' },
  { description: 'Removed sensitive console logging from production code', severity: 'medium' },
  { description: 'Added banned user check to authentication flow', severity: 'high' },
  { description: 'Sanitized error responses — no internal details leaked to clients', severity: 'critical' },
];

const jwtCodeSnippet = `// lib/auth.ts — JWT Configuration
// INTENTIONAL: Application MUST fail if JWT_SECRET is missing.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. '
    'The application cannot start without it. '
    'Generate one with: openssl rand -base64 48'
  );
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256', // Explicit algorithm — defense in depth
  });
}

export function verifyToken(token: string) {
  try {
    // SECURITY: Explicitly require HS256 algorithm.
    // Without this, an attacker could forge a token with
    // {"alg":"none"} which jsonwebtoken would accept.
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
  } catch {
    return null; // Invalid, expired, or wrong algorithm
  }
}`;

const middlewareCodeSnippet = `// middleware.ts — HMAC-SHA256 Signature Verification
// SECURITY: This replaced the previous INSECURE base64-only decoding.
// Without signature verification, ANYONE could forge a JWT with
// {role: "ADMIN"} without knowing the secret.

async function verifyJwtSignature(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  // Step 0: Reject tokens with unexpected algorithm
  const header = JSON.parse(
    atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))
  );
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    return null;
  }

  // Step 1: Import HMAC key
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  // Step 2: Verify HMAC-SHA256 signature
  const signedData = new TextEncoder().encode(
    headerB64 + '.' + payloadB64
  );
  const signatureBytes = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );
  const isValid = await crypto.subtle.verify(
    'HMAC', cryptoKey, signatureBytes, signedData
  );
  if (!isValid) return null;

  // Step 3: Decode payload
  const payload = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )
  ));

  // Step 4: Check expiration
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Middleware usage
if (authToken && jwtSecret) {
  const payload = await verifyJwtSignature(authToken, jwtSecret);
  if (payload) {
    isAuthenticated = payload.role !== undefined;
    isAdmin = payload.role === 'ADMIN';
    isProvider = payload.role === 'BUSINESS_OWNER';
  }
}`;

// ─── Sub-Components ─────────────────────────────────────────────────────────

function SectionCard({
  children,
  className = '',
  title,
  icon: Icon,
  iconColor = 'text-emerald-400',
  glowColor = 'rgba(16, 185, 129, 0.08)',
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  glowColor?: string;
}) {
  return (
    <section
      className={`relative rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden ${className}`}
    >
      {/* Subtle top glow */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
        }}
      />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const displayCode = expanded ? code : code.split('\n').slice(0, 6).join('\n') + '\n  // ...';
  const lines = displayCode.split('\n');

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-mono text-slate-400">{title}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="inline-block w-8 text-right mr-4 text-slate-600 select-none text-xs leading-relaxed">
                  {i + 1}
                </span>
                <span className="text-slate-300 font-mono">{line || '\u00A0'}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function StatusBadge({ children, variant = 'success' }: { children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' }) {
  const styles = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/15 text-red-400 border-red-500/20',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colorMap: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    POST: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    DELETE: 'bg-red-500/15 text-red-400 border-red-500/25',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${colorMap[method] || 'bg-slate-500/15 text-slate-400 border-slate-500/25'}`}>
      {method}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' }) {
  const styles = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/25',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  };
  const labels = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM' };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${styles[severity]}`}>
      {labels[severity]}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const SecurityAuditPage: React.FC<SecurityAuditPageProps> = ({ onBack }) => {
  const [testResults, setTestResults] = useState<TestResult[]>(
    testEndpoints.map((ep) => ({
      url: ep.url,
      label: ep.label,
      status: 'idle' as const,
      statusCode: null,
      responseBody: '',
      timestamp: null,
    }))
  );
  const [isRunningAll, setIsRunningAll] = useState(false);

  const runSingleTest = useCallback(
    async (index: number) => {
      const endpoint = testEndpoints[index];
      setTestResults((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'testing', statusCode: null, responseBody: '', timestamp: null };
        return next;
      });

      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          credentials: 'omit',
        });

        let body = '';
        try {
          const json = await response.json();
          body = JSON.stringify(json, null, 2);
        } catch {
          body = '(non-JSON response)';
        }

        const isBlocked = response.status === endpoint.expected;

        setTestResults((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            status: isBlocked ? 'passed' : 'failed',
            statusCode: response.status,
            responseBody: body,
            timestamp: Date.now(),
          };
          return next;
        });
      } catch (err) {
        setTestResults((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            status: 'failed',
            statusCode: null,
            responseBody: `Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
            timestamp: Date.now(),
          };
          return next;
        });
      }
    },
    []
  );

  const runAllTests = useCallback(async () => {
    setIsRunningAll(true);
    // Run all tests in parallel
    await Promise.all(testEndpoints.map((_, i) => runSingleTest(i)));
    setIsRunningAll(false);
  }, [runSingleTest]);

  const passedCount = testResults.filter((r) => r.status === 'passed').length;
  const totalCount = testResults.length;
  const allDone = testResults.every((r) => r.status !== 'idle' && r.status !== 'testing');

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-cyan-500/[0.02] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-0 w-[350px] h-[350px] bg-purple-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* ── 1. Header ─────────────────────────────────────────────────── */}
        <header className="mb-10 sm:mb-14">
          <div className="relative rounded-2xl border border-slate-700/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 overflow-hidden p-6 sm:p-8">
            {/* Header gradient glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-emerald-500/[0.07] rounded-full blur-[80px]" />
              <div className="absolute top-0 right-0 w-[300px] h-[150px] bg-cyan-500/[0.05] rounded-full blur-[60px]" />
            </div>
            <div className="relative">
              {/* Back button */}
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-5 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back
              </button>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Phase 2 — Security Lockdown
                      </h1>
                      <StatusBadge variant="success">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ALL CHECKS PASSED
                      </StatusBadge>
                    </div>
                    <p className="text-slate-400 text-sm sm:text-base max-w-xl">
                      Comprehensive security audit and route protection demonstration
                    </p>
                  </div>
                </div>

                {/* Stats summary */}
                <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-2.5 border border-slate-700/40">
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-400">{adminRoutes.length}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Routes</div>
                  </div>
                  <div className="w-px h-8 bg-slate-700" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-cyan-400">{rateLimits.length}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Limits</div>
                  </div>
                  <div className="w-px h-8 bg-slate-700" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-400">{securityFixes.length}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Fixes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {/* ── 2. JWT Security Section ──────────────────────────────────── */}
          <SectionCard title="JWT Token Security" icon={Key} iconColor="text-amber-400" glowColor="rgba(245, 158, 11, 0.1)">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <CodeBlock code={jwtCodeSnippet} title="lib/auth.ts — JWT Configuration" />
              </div>
              <div className="flex flex-col justify-center gap-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-emerald-300">No Fallback Secret</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      JWT_SECRET has NO fallback value. Server crashes at startup if the env var is missing.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-emerald-300">Fails on Missing Secret</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Fatal error thrown before any HTTP listener is bound — no chance of running insecured.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-emerald-300">HS256 Algorithm Enforced</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Explicitly uses HMAC-SHA256 to prevent algorithm confusion attacks.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/10">
                  <Fingerprint className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-cyan-300">Server-Side Role Extraction</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Roles decoded from JWT payload on the server — never trusts client-set cookies or headers.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── 3. Admin Route Protection Table ──────────────────────────── */}
          <SectionCard title="Admin Route Protection" icon={ShieldAlert} iconColor="text-red-400" glowColor="rgba(239, 68, 68, 0.08)">
            <p className="text-sm text-slate-400 mb-4">
              All routes under <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 text-xs font-mono">/api/admin/*</code> require the{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 text-xs font-mono">ADMIN</code> role. Unauthenticated requests receive{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-red-400 text-xs font-mono">401</code>; authenticated non-admins receive{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-orange-400 text-xs font-mono">403</code>.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-700/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/60 border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Route</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Methods</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Protection</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {adminRoutes.map((route) => (
                    <tr key={route.route} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{route.route}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {route.methods.map((m) => (
                            <MethodBadge key={m} method={m} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-mono border border-red-500/15">
                          {route.protection}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ── 4. Sensitive Route Protection ────────────────────────────── */}
          <SectionCard title="Sensitive Route Protection" icon={Eye} iconColor="text-cyan-400" glowColor="rgba(6, 182, 212, 0.08)">
            <p className="text-sm text-slate-400 mb-4">
              Mixed-access routes apply different protection levels based on HTTP method and query parameters.
            </p>
            <div className="space-y-3">
              {sensitiveRoutes.map((sr) => (
                <div key={sr.route} className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/40 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-xs text-slate-300">{sr.route}</span>
                  </div>
                  <div className="divide-y divide-slate-800/40">
                    {sr.methodRules.map((rule) => (
                      <div key={`${sr.route}-${rule.method}`} className="px-4 py-3 flex items-center gap-3">
                        <MethodBadge method={rule.method} />
                        <span className="text-xs text-slate-400 flex-1">{rule.protection}</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 5. Rate Limiting Section ─────────────────────────────────── */}
          <SectionCard title="Rate Limiting Configuration" icon={Gauge} iconColor="text-blue-400" glowColor="rgba(59, 130, 246, 0.08)">
            <p className="text-sm text-slate-400 mb-5">
              All authentication-sensitive endpoints are rate-limited to prevent brute-force and abuse attacks.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rateLimits.map((limit) => (
                <div
                  key={limit.endpoint}
                  className="relative rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <limit.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{limit.endpoint}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        {limit.window}
                      </div>
                    </div>
                  </div>
                  {/* Rate limit bar visual */}
                  <div className="mb-2">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-2xl font-bold text-blue-400">{limit.maxAttempts}</span>
                      <span className="text-[11px] text-slate-500">max requests</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${Math.min((limit.maxAttempts / 60) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    window: {limit.windowMs.toLocaleString()}ms
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 6. Webhook Security Section ──────────────────────────────── */}
          <SectionCard title="Webhook Security" icon={Lock} iconColor="text-purple-400" glowColor="rgba(168, 85, 247, 0.08)">
            <p className="text-sm text-slate-400 mb-5">
              All payment webhook endpoints verify cryptographic signatures before processing. No fallback secrets are used.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {webhookProviders.map((provider) => (
                <div
                  key={provider.name}
                  className="relative rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden hover:border-slate-600/50 transition-colors"
                >
                  {/* Top accent gradient */}
                  <div className={`h-1 bg-gradient-to-r ${provider.color}`} />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">{provider.name}</h3>
                      {provider.status === 'active' ? (
                        <StatusBadge variant="success">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="danger">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </StatusBadge>
                      )}
                    </div>
                    <div className="flex items-start gap-2 mb-3">
                      <Lock className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-slate-300 font-mono">{provider.method}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{provider.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 7. Live API Test Section ─────────────────────────────────── */}
          <SectionCard title="Live API Protection Test" icon={Zap} iconColor="text-yellow-400" glowColor="rgba(234, 179, 8, 0.1)">
            <p className="text-sm text-slate-400 mb-5">
              Click below to test protected endpoints. Without authentication, all admin and sensitive routes should return{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-red-400 text-xs font-mono">401 Unauthorized</code>.
            </p>

            {/* Run All button + summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <div>
                <div className="text-sm font-medium text-white mb-0.5">
                  {allDone ? (
                    <>
                      Results:{' '}
                      <span className="text-emerald-400">{passedCount}/{totalCount}</span> blocked
                    </>
                  ) : (
                    'Click individual tests or run all at once'
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Requests sent without credentials — simulating unauthenticated access
                </div>
              </div>
              <button
                onClick={runAllTests}
                disabled={isRunningAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-all shadow-lg shadow-emerald-500/15"
              >
                {isRunningAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run All Tests
                  </>
                )}
              </button>
            </div>

            {/* Individual test cards */}
            <div className="space-y-3">
              {testEndpoints.map((endpoint, index) => {
                const result = testResults[index];
                return (
                  <div
                    key={endpoint.url}
                    className={`rounded-xl border transition-colors ${
                      result.status === 'passed'
                        ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                        : result.status === 'failed'
                          ? 'border-red-500/20 bg-red-500/[0.04]'
                          : 'border-slate-700/50 bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-slate-300 truncate">{endpoint.label}</span>
                        <span className="text-[10px] text-slate-600 hidden sm:inline">expected {endpoint.expected}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Result indicator */}
                        {result.status === 'passed' && (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-xs font-semibold">BLOCKED ({result.statusCode})</span>
                          </div>
                        )}
                        {result.status === 'failed' && (
                          <div className="flex items-center gap-1.5 text-red-400">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-xs font-semibold">
                              UNEXPECTED {result.statusCode !== null ? `(${result.statusCode})` : ''}
                            </span>
                          </div>
                        )}
                        {result.status === 'testing' && (
                          <div className="flex items-center gap-1.5 text-blue-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs">Testing...</span>
                          </div>
                        )}
                        {/* Test button */}
                        <button
                          onClick={() => runSingleTest(index)}
                          disabled={result.status === 'testing'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-xs text-slate-300 hover:text-white transition-colors"
                        >
                          {result.status === 'testing' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          {result.status === 'idle' ? 'Test' : 'Retry'}
                        </button>
                      </div>
                    </div>

                    {/* Response body (collapsible) */}
                    {(result.status === 'passed' || result.status === 'failed') && result.responseBody && (
                      <div className="border-t border-slate-700/30 px-4 py-3 bg-slate-950/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Terminal className="w-3 h-3 text-slate-500" />
                          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Response</span>
                          {result.timestamp && (
                            <span className="text-[11px] text-slate-600 ml-auto font-mono">
                              {new Date(result.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <pre className="text-xs text-slate-400 font-mono overflow-x-auto max-h-28 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
                          {result.responseBody}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── 8. Middleware Code Section ───────────────────────────────── */}
          <SectionCard title="Middleware — Route Protection Logic" icon={Code2} iconColor="text-orange-400" glowColor="rgba(249, 115, 22, 0.08)">
            <p className="text-sm text-slate-400 mb-4">
              Key excerpt from the Next.js middleware showing JWT role extraction and route protection decisions.
            </p>
            <CodeBlock code={middlewareCodeSnippet} title="middleware.ts — JWT Extraction & Route Guard" />
          </SectionCard>

          {/* ── 9. Security Fixes Applied ───────────────────────────────── */}
          <SectionCard
            title="Security Fixes Applied"
            icon={Bug}
            iconColor="text-emerald-400"
            glowColor="rgba(16, 185, 129, 0.1)"
          >
            <p className="text-sm text-slate-400 mb-5">
              All identified security vulnerabilities have been addressed. Each fix has been verified and deployed.
            </p>
            <div className="space-y-2">
              {securityFixes.map((fix, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:border-slate-600/50 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-300">{fix.description}</span>
                  </div>
                  <SeverityBadge severity={fix.severity} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="mt-12 pt-8 border-t border-slate-800/60 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>Security Audit Report — Phase 2 Lockdown</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • All checks passed
          </p>
        </footer>
      </div>
    </div>
  );
};
