'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, AlertTriangle, Shield, Webhook, Activity,
  Database, Users, CreditCard, BookOpen, Clock, ChevronDown,
  ChevronUp, CheckCircle, XCircle, TrendingUp, RefreshCw,
  Zap, Globe, FileText, Server, BarChart3, AlertCircle,
  TriangleAlert, Info, CheckCircle2, Loader2,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface AdminAlertPanelProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

interface MonitoringError {
  id: string;
  message: string;
  severity: string;
  route: string | null;
  method: string | null;
  createdAt: string;
}

interface SecurityAlert {
  id: string;
  type: string;
  severity: string;
  ipAddress: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

interface WebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  processingTimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
  byRoute: { route: string; count: number }[];
  recent24h: number;
  recent7d: number;
  recent30d: number;
  avgPerDay: number;
}

interface AlertStats {
  total: number;
  open: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  recent24h: number;
}

interface WebhookStats {
  total: number;
  byStatus: Record<string, number>;
  byProvider: Record<string, number>;
  failureRate: number;
  recentFailures: number;
  avgProcessingTimeMs: number;
}

interface SystemHealth {
  status: string;
  timestamp: string;
  environment: string;
  database: {
    sizeBytes: number;
    sizeMB: number;
    tables: {
      users: number;
      businesses: number;
      bookings: number;
      payments: number;
    };
  };
  uptime: {
    approximate: string;
    firstRecordAt: string | null;
  };
  security: {
    openAlerts: number;
    unresolvedErrors: number;
    totalAuditLogs: number;
    totalWebhookEvents: number;
  };
  recentActivity24h: {
    bookings: number;
    payments: number;
    alerts: number;
    errors: number;
    webhookEvents: number;
  };
  paymentBreakdown: Record<string, number>;
}

// ============================================
// SEVERITY HELPERS
// ============================================

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  MEDIUM: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  HIGH: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  CRITICAL: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const SEVERITY_DOTS: Record<string, string> = {
  LOW: 'bg-blue-400',
  MEDIUM: 'bg-yellow-400',
  HIGH: 'bg-orange-400',
  CRITICAL: 'bg-red-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.MEDIUM}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOTS[severity] || SEVERITY_DOTS.MEDIUM}`} />
      {severity}
    </span>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ============================================
// SECTION CARD
// ============================================

function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
  badgeColor,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-emerald-400">{icon}</div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {badge !== undefined && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor || 'bg-slate-700 text-slate-300'}`}>
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AdminAlertPanel({ onBack, onNavigate }: AdminAlertPanelProps) {
  // Data states
  const [errorData, setErrorData] = useState<{ errors: MonitoringError[]; stats: ErrorStats } | null>(null);
  const [alertData, setAlertData] = useState<{ alerts: SecurityAlert[]; stats: AlertStats } | null>(null);
  const [webhookData, setWebhookData] = useState<{ events: WebhookEvent[]; stats: WebhookStats } | null>(null);
  const [systemData, setSystemData] = useState<SystemHealth | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setFetchError] = useState<string | null>(null);

  // API helper
  const api = useCallback(async (url: string) => {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json.data;
  }, []);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [errors, alerts, webhooks, system] = await Promise.all([
        api('/api/admin/monitoring?type=errors&limit=50'),
        api('/api/admin/monitoring?type=alerts&limit=50'),
        api('/api/admin/monitoring?type=webhooks&limit=30'),
        api('/api/admin/monitoring?type=system'),
      ]);
      setErrorData(errors);
      setAlertData(alerts);
      setWebhookData(webhooks);
      setSystemData(system);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Resolve errors handler
  const handleResolveErrors = useCallback(async (errorIds: string[]) => {
    try {
      await fetch('/api/admin/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'resolve', errorIds }),
      });
      // Refetch errors
      const data = await api('/api/admin/monitoring?type=errors&limit=50');
      setErrorData(data);
    } catch {
      // Silent fail
    }
  }, [api]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                <Activity className="w-8 h-8 text-emerald-400" />
                Admin Monitoring Center
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Real-time system monitoring, error tracking, and security alerts
              </p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:bg-slate-800 transition-colors text-sm text-slate-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && !errorData && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Loading monitoring data...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="ml-auto text-sm text-red-400 hover:text-red-300">
              Retry
            </button>
          </div>
        )}

        {/* Summary Cards */}
        {errorData && alertData && webhookData && systemData && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {/* Unresolved Errors */}
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Errors</span>
                </div>
                <p className="text-2xl font-bold text-white">{errorData.stats.unresolved}</p>
                <p className="text-xs text-slate-500 mt-1">{errorData.stats.recent24h} in last 24h</p>
              </div>

              {/* Open Security Alerts */}
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Alerts</span>
                </div>
                <p className="text-2xl font-bold text-white">{alertData.stats.open}</p>
                <p className="text-xs text-slate-500 mt-1">{alertData.stats.recent24h} in last 24h</p>
              </div>

              {/* Webhook Failures */}
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Webhook className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Webhooks</span>
                </div>
                <p className="text-2xl font-bold text-white">{webhookData.stats.failureRate}%</p>
                <p className="text-xs text-slate-500 mt-1">failure rate</p>
              </div>

              {/* System Health */}
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">System</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">Healthy</p>
                <p className="text-xs text-slate-500 mt-1">{systemData.environment}</p>
              </div>
            </div>

            {/* Content Grid */}
            <div className="space-y-6">
              {/* Error Tracker Section */}
              <SectionCard
                title="Error Tracker"
                icon={<AlertTriangle className="w-5 h-5" />}
                badge={errorData.stats.unresolved}
                badgeColor={errorData.stats.unresolved > 0 ? 'bg-orange-400/10 text-orange-400 border border-orange-400/20' : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'}
              >
                {/* Severity distribution */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
                    <div key={sev} className="bg-slate-800/40 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-white">
                        {errorData.stats.bySeverity[sev] || 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{sev}</p>
                    </div>
                  ))}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {errorData.stats.recent24h} / 24h</span>
                  <span>{errorData.stats.recent7d} / 7d</span>
                  <span>{errorData.stats.recent30d} / 30d</span>
                  <span>~{errorData.stats.avgPerDay}/day avg</span>
                </div>

                {/* Error table */}
                {errorData.errors.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mb-2" />
                    <p className="text-sm">No unresolved errors</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/60 sticky top-0">
                        <tr>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Severity</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Message</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium hidden sm:table-cell">Route</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium hidden lg:table-cell">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorData.errors.slice(0, 20).map((err) => (
                          <tr key={err.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                            <td className="p-3">
                              <SeverityBadge severity={err.severity} />
                            </td>
                            <td className="p-3">
                              <p className="text-slate-300 truncate max-w-xs">{err.message}</p>
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              <code className="text-xs text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                                {err.method || '?'} {err.route || '-'}
                              </code>
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              <span className="text-xs text-slate-500">
                                {formatRelativeTime(err.createdAt)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Top error routes */}
                {errorData.stats.byRoute.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Top Error Routes</p>
                    <div className="space-y-1">
                      {errorData.stats.byRoute.slice(0, 5).map((item) => (
                        <div key={item.route} className="flex items-center justify-between bg-slate-800/30 rounded px-3 py-1.5">
                          <code className="text-xs text-slate-400">{item.route}</code>
                          <span className="text-xs text-slate-500 font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Security Alerts Section */}
              <SectionCard
                title="Security Alerts"
                icon={<Shield className="w-5 h-5" />}
                badge={alertData.stats.open}
                badgeColor={alertData.stats.open > 0 ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'}
              >
                {/* Severity breakdown */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
                    <div key={sev} className="bg-slate-800/40 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-white">
                        {alertData.stats.bySeverity[sev] || 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{sev}</p>
                    </div>
                  ))}
                </div>

                {/* Alert type breakdown */}
                {Object.keys(alertData.stats.byType).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">By Type</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(alertData.stats.byType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between bg-slate-800/30 rounded px-3 py-1.5">
                          <span className="text-xs text-slate-400 truncate">{type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-slate-500 font-medium ml-2">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent alerts table */}
                {alertData.alerts.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mb-2" />
                    <p className="text-sm">No security alerts</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/60 sticky top-0">
                        <tr>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Severity</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Title</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium hidden sm:table-cell">Type</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium hidden lg:table-cell">IP</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alertData.alerts.slice(0, 15).map((alert) => (
                          <tr key={alert.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                            <td className="p-3">
                              <SeverityBadge severity={alert.severity} />
                            </td>
                            <td className="p-3">
                              <p className="text-slate-300 truncate max-w-xs">{alert.title}</p>
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              <code className="text-xs text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                                {alert.type.replace(/_/g, ' ')}
                              </code>
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              <code className="text-xs text-slate-500">{alert.ipAddress}</code>
                            </td>
                            <td className="p-3">
                              <span className="text-xs text-slate-500">{formatRelativeTime(alert.createdAt)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Webhook Events Section */}
              <SectionCard
                title="Webhook Events"
                icon={<Webhook className="w-5 h-5" />}
                badge={`${webhookData.stats.total}`}
                badgeColor="bg-purple-400/10 text-purple-400 border border-purple-400/20"
              >
                {/* View Full Dashboard link */}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('webhook-monitoring')}
                    className="mb-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-colors"
                  >
                    <Webhook className="w-4 h-4" />
                    Open Webhook Monitor Dashboard
                  </button>
                )}
                {/* Provider breakdown */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {(['STRIPE', 'PAYPAL', 'MPESA'] as const).map((provider) => (
                    <div key={provider} className="bg-slate-800/40 rounded-lg p-3">
                      <p className="text-lg font-bold text-white">
                        {webhookData.stats.byProvider[provider] || 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{provider}</p>
                    </div>
                  ))}
                </div>

                {/* Status breakdown */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Processed: {webhookData.stats.byStatus['PROCESSED'] || 0}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Failed: {webhookData.stats.byStatus['FAILED'] || 0}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    Duplicate: {webhookData.stats.byStatus['DUPLICATE'] || 0}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    Unhandled: {webhookData.stats.byStatus['UNHANDLED'] || 0}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Avg processing: {webhookData.stats.avgProcessingTimeMs}ms
                  </span>
                  <span>Failure rate: {webhookData.stats.failureRate}%</span>
                  <span>Recent failures: {webhookData.stats.recentFailures}</span>
                </div>

                {/* Recent webhook events */}
                {webhookData.events.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-500">
                    <Globe className="w-10 h-10 text-slate-600 mb-2" />
                    <p className="text-sm">No webhook events yet</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/60 sticky top-0">
                        <tr>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Provider</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Event</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium">Status</th>
                          <th className="text-left p-3 text-xs text-slate-500 font-medium hidden sm:table-cell">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhookData.events.slice(0, 15).map((event) => (
                          <tr key={event.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                            <td className="p-3">
                              <span className="text-xs font-medium text-slate-300">{event.provider}</span>
                            </td>
                            <td className="p-3">
                              <code className="text-xs text-slate-400">{event.eventType}</code>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                event.status === 'PROCESSED'
                                  ? 'bg-emerald-400/10 text-emerald-400'
                                  : event.status === 'FAILED' || event.status === 'INVALID_SIGNATURE'
                                    ? 'bg-red-400/10 text-red-400'
                                    : 'bg-yellow-400/10 text-yellow-400'
                              }`}>
                                {event.status === 'PROCESSED' && <CheckCircle className="w-3 h-3" />}
                                {event.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                                {event.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              <span className="text-xs text-slate-500">
                                {event.processingTimeMs ? `${event.processingTimeMs}ms` : '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* System Health Section */}
              <SectionCard
                title="System Health"
                icon={<Server className="w-5 h-5" />}
                badge="OK"
                badgeColor="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Environment */}
                  <div className="bg-slate-800/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Environment</p>
                    </div>
                    <p className="text-lg font-bold text-white">{systemData.environment}</p>
                    <p className="text-xs text-slate-500 mt-1">Uptime: {systemData.uptime.approximate}</p>
                  </div>

                  {/* Database */}
                  <div className="bg-slate-800/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-4 h-4 text-blue-400" />
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Database</p>
                    </div>
                    <p className="text-lg font-bold text-white">{systemData.database.sizeMB} MB</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {systemData.database.tables.users} users, {systemData.database.tables.businesses} businesses
                    </p>
                  </div>

                  {/* Security */}
                  <div className="bg-slate-800/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Security</p>
                    </div>
                    <p className="text-lg font-bold text-white">{systemData.security.totalAuditLogs}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      audit log entries
                    </p>
                  </div>
                </div>

                {/* Record counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3">
                    <Users className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-white">{systemData.database.tables.users}</p>
                      <p className="text-xs text-slate-500">Users</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3">
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-white">{systemData.database.tables.bookings}</p>
                      <p className="text-xs text-slate-500">Bookings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-white">{systemData.database.tables.payments}</p>
                      <p className="text-xs text-slate-500">Payments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-white">{systemData.security.totalWebhookEvents}</p>
                      <p className="text-xs text-slate-500">Webhooks</p>
                    </div>
                  </div>
                </div>

                {/* Recent activity */}
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Activity (Last 24h)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: 'Bookings', value: systemData.recentActivity24h.bookings, icon: <BookOpen className="w-3 h-3" /> },
                      { label: 'Payments', value: systemData.recentActivity24h.payments, icon: <CreditCard className="w-3 h-3" /> },
                      { label: 'Alerts', value: systemData.recentActivity24h.alerts, icon: <AlertTriangle className="w-3 h-3" /> },
                      { label: 'Errors', value: systemData.recentActivity24h.errors, icon: <AlertCircle className="w-3 h-3" /> },
                      { label: 'Webhooks', value: systemData.recentActivity24h.webhookEvents, icon: <Webhook className="w-3 h-3" /> },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-800/30 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-slate-600">{item.icon}</span>
                        <span className="text-sm font-semibold text-white">{item.value}</span>
                        <span className="text-xs text-slate-500">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment breakdown */}
                {Object.keys(systemData.paymentBreakdown).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Payment Status Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(systemData.paymentBreakdown).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-1.5 bg-slate-800/30 rounded-full px-3 py-1">
                          <span className={`w-2 h-2 rounded-full ${
                            status === 'COMPLETED' ? 'bg-emerald-400' :
                            status === 'PENDING' ? 'bg-yellow-400' :
                            status === 'FAILED' ? 'bg-red-400' :
                            'bg-slate-500'
                          }`} />
                          <span className="text-xs text-slate-400">{status}</span>
                          <span className="text-xs text-slate-500 font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-slate-600">
                Last refreshed: {systemData.timestamp ? new Date(systemData.timestamp).toLocaleString() : '-'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminAlertPanel;
