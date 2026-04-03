'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Webhook, RefreshCw, Trash2, Activity, AlertTriangle,
  CheckCircle, XCircle, Clock, Shield, Fingerprint, BarChart3,
  RotateCw, Zap, TrendingUp, Loader2, Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ============================================
// TYPES
// ============================================

interface WebhookDashboardProps {
  onBack: () => void;
}

interface OverviewStats {
  total: number;
  processed: number;
  failed: number;
  duplicates: number;
  unhandled: number;
  invalidSignature: number;
  received: number;
  successRate: number;
}

interface ProviderHealth {
  provider: string;
  total: number;
  processed: number;
  failed: number;
  duplicates: number;
  avgProcessingTimeMs: number | null;
  lastEventAt: string | null;
  failureRate: number;
  signatureValidCount: number;
  signatureInvalidCount: number;
  maxAttempts: number;
}

interface TimeSeriesDay {
  date: string;
  total: number;
  processed: number;
  failed: number;
}

interface RetryTracking {
  eventsWithMultipleAttempts: number;
  maxAttempts: number;
  avgAttempts: number | null;
  highRetryEvents: number;
}

interface RecentEvent {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  status: string;
  processingAttempts: number;
  processingTimeMs: number | null;
  errorMessage: string | null;
  ipAddress: string | null;
  relatedPaymentId: string | null;
  createdAt: string;
}

interface DetailedStats {
  overview: OverviewStats;
  byProvider: ProviderHealth[];
  timeSeries: TimeSeriesDay[];
  retryTracking: RetryTracking;
  recentEvents: RecentEvent[];
}

// ============================================
// HELPERS
// ============================================

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  PROCESSED: { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle className="w-3 h-3" /> },
  FAILED: { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: <XCircle className="w-3 h-3" /> },
  DUPLICATE: { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: <AlertTriangle className="w-3 h-3" /> },
  INVALID_SIGNATURE: { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: <Fingerprint className="w-3 h-3" /> },
  RECEIVED: { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: <Activity className="w-3 h-3" /> },
  UNHANDLED: { color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20', icon: <Eye className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNHANDLED;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}>
      {config.icon}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SuccessRateBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  let colorClass = 'text-emerald-400';
  if (pct < 80) colorClass = 'text-red-400';
  else if (pct < 95) colorClass = 'text-yellow-400';

  return <span className={`text-2xl font-bold ${colorClass}`}>{pct}%</span>;
}

const PROVIDER_COLORS: Record<string, string> = {
  STRIPE: 'border-l-indigo-500',
  PAYPAL: 'border-l-blue-500',
  MPESA: 'border-l-green-500',
};

const PROVIDER_ICONS: Record<string, string> = {
  STRIPE: '💳',
  PAYPAL: '🅿️',
  MPESA: '📱',
};

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Overview cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Provider cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <Skeleton className="h-5 w-20 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <Skeleton className="h-5 w-32 mb-6" />
        <div className="flex items-end gap-3 h-48">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton className="w-full h-32 rounded-t" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WebhookDashboard({ onBack }: WebhookDashboardProps) {
  const [data, setData] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setFetchError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pruning, setPruning] = useState(false);
  const [prunedCount, setPrunedCount] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/webhooks?type=detailed', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch webhook data');
      setData(json.data);
      setLastUpdated(new Date());
      setFetchError(null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load webhook data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrune = useCallback(async () => {
    setPruning(true);
    setPrunedCount(null);
    try {
      const res = await fetch('/api/admin/webhooks?type=prune', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setPrunedCount(json.data.pruned);
        // Refresh data after pruning
        await fetchData();
      }
    } catch {
      // Silent fail
    } finally {
      setPruning(false);
    }
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchData]);

  const overview = data?.overview;
  const providers = data?.byProvider || [];
  const timeSeries = data?.timeSeries || [];
  const retryTracking = data?.retryTracking;
  const recentEvents = data?.recentEvents || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══════════ HEADER ═══════════ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <Webhook className="w-7 h-7 text-emerald-500" />
                Webhook Monitor
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Payment webhook event monitoring and management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                id="auto-refresh"
              />
              <label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
                Auto-refresh (30s)
              </label>
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {formatRelativeTime(lastUpdated.toISOString())}
              </span>
            )}

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {/* Prune button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrune}
              disabled={pruning}
              className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className={`w-4 h-4 mr-1.5 ${pruning ? 'animate-spin' : ''}`} />
              {pruning ? 'Pruning...' : 'Prune Old Events'}
            </Button>
          </div>
        </div>

        {/* Prune result notification */}
        {prunedCount !== null && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Pruned {prunedCount} old webhook event{prunedCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
            <button onClick={fetchData} className="ml-auto text-xs underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && !data && <LoadingSkeleton />}

        {/* ═══════════ MAIN CONTENT ═══════════ */}
        {data && overview && (
          <div className="space-y-6">
            {/* ═══════════ OVERVIEW CARDS ═══════════ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Total Events */}
              <Card className="border-slate-800 bg-slate-900/60 py-4 gap-0">
                <CardContent className="px-4 py-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-2xl font-bold">{overview.total.toLocaleString()}</p>
                </CardContent>
              </Card>

              {/* Success Rate */}
              <Card className="border-slate-800 bg-slate-900/60 py-4 gap-0">
                <CardContent className="px-4 py-0">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Success Rate</span>
                  </div>
                  <SuccessRateBadge rate={overview.successRate} />
                </CardContent>
              </Card>

              {/* Failed */}
              <Card className="border-red-500/20 bg-red-500/5 py-4 gap-0">
                <CardContent className="px-4 py-0">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400/70 uppercase tracking-wider">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{overview.failed.toLocaleString()}</p>
                </CardContent>
              </Card>

              {/* Duplicates */}
              <Card className="border-yellow-500/20 bg-yellow-500/5 py-4 gap-0">
                <CardContent className="px-4 py-0">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400/70 uppercase tracking-wider">Duplicates</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">{overview.duplicates.toLocaleString()}</p>
                </CardContent>
              </Card>

              {/* Invalid Signatures */}
              <Card className="border-red-500/20 bg-red-500/5 py-4 gap-0">
                <CardContent className="px-4 py-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400/70 uppercase tracking-wider">Bad Sigs</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{overview.invalidSignature.toLocaleString()}</p>
                </CardContent>
              </Card>

              {/* Avg Processing Time */}
              <Card className="border-slate-800 bg-slate-900/60 py-4 gap-0">
                <CardContent className="px-4 py-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg Time</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {providers.length > 0 && providers.some(p => p.avgProcessingTimeMs)
                      ? Math.round(
                          providers.reduce((sum, p) => sum + (p.avgProcessingTimeMs || 0), 0) /
                          providers.filter(p => p.avgProcessingTimeMs).length
                        )
                      : 0}
                    <span className="text-sm text-muted-foreground ml-1">ms</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ═══════════ PROVIDER HEALTH ═══════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['STRIPE', 'PAYPAL', 'MPESA'] as const).map((providerName) => {
                const provider = providers.find(p => p.provider === providerName) || {
                  provider: providerName,
                  total: 0,
                  processed: 0,
                  failed: 0,
                  duplicates: 0,
                  avgProcessingTimeMs: null,
                  lastEventAt: null,
                  failureRate: 0,
                  signatureValidCount: 0,
                  signatureInvalidCount: 0,
                  maxAttempts: 0,
                };
                const successPct = provider.total > 0
                  ? Math.round(((provider.processed) / provider.total) * 100)
                  : 100;
                const borderColor = PROVIDER_COLORS[providerName] || 'border-l-slate-500';

                return (
                  <Card
                    key={providerName}
                    className={`border-slate-800 bg-slate-900/60 border-l-4 ${borderColor} py-0 gap-0`}
                  >
                    <CardHeader className="pb-0 px-5 pt-5">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-lg">{PROVIDER_ICONS[providerName]}</span>
                        {providerName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 py-4 space-y-3">
                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Events</span>
                          <p className="font-semibold text-sm">{provider.total}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Success</span>
                          <p className={`font-semibold text-sm ${
                            successPct >= 95 ? 'text-emerald-400' :
                            successPct >= 80 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {successPct}%
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Time</span>
                          <p className="font-semibold text-sm">
                            {provider.avgProcessingTimeMs ? `${Math.round(provider.avgProcessingTimeMs)}ms` : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Event</span>
                          <p className="font-semibold text-sm">
                            {provider.lastEventAt ? formatRelativeTime(provider.lastEventAt) : 'Never'}
                          </p>
                        </div>
                      </div>

                      {/* Signature status */}
                      <div className="flex items-center gap-4 text-xs pt-2 border-t border-border">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">{provider.signatureValidCount}</span>
                          <span className="text-muted-foreground">valid</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Fingerprint className="w-3 h-3 text-red-400" />
                          <span className="text-red-400">{provider.signatureInvalidCount}</span>
                          <span className="text-muted-foreground">invalid</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ═══════════ 7-DAY ACTIVITY CHART ═══════════ */}
            <Card className="border-slate-800 bg-slate-900/60 py-0 gap-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  7-Day Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-5">
                {timeSeries.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    No webhook activity in the last 7 days
                  </div>
                ) : (
                  <div className="flex items-end gap-2 sm:gap-4 h-48">
                    {timeSeries.map((day) => {
                      const maxTotal = Math.max(...timeSeries.map(d => d.total), 1);
                      const processedHeight = Math.max((day.processed / maxTotal) * 100, 2);
                      const failedHeight = Math.max((day.failed / maxTotal) * 100, 0);
                      const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });

                      return (
                        <div
                          key={day.date}
                          className="flex-1 flex flex-col items-center gap-1"
                          title={`${dayLabel}: ${day.total} total (${day.processed} processed, ${day.failed} failed)`}
                        >
                          <span className="text-xs text-muted-foreground font-medium">{day.total}</span>
                          <div className="w-full flex flex-col justify-end" style={{ height: '140px' }}>
                            {/* Failed portion (bottom) */}
                            {day.failed > 0 && (
                              <div
                                className="w-full bg-red-400/80 rounded-b transition-all"
                                style={{ height: `${failedHeight}%` }}
                              />
                            )}
                            {/* Processed portion (top) */}
                            <div
                              className="w-full bg-emerald-400/80 rounded-t transition-all"
                              style={{ height: `${processedHeight}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{dayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400/80" />
                    Processed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-400/80" />
                    Failed
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ═══════════ RETRY TRACKING ═══════════ */}
            <Card className="border-slate-800 bg-slate-900/60 py-0 gap-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCw className="w-5 h-5 text-orange-400" />
                  Retry Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-800/40 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <RotateCw className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground uppercase">Multi-Attempt</span>
                    </div>
                    <p className="text-2xl font-bold">{retryTracking?.eventsWithMultipleAttempts ?? 0}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-muted-foreground uppercase">Max Attempts</span>
                    </div>
                    <p className="text-2xl font-bold">{retryTracking?.maxAttempts ?? 0}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-muted-foreground uppercase">Avg Attempts</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {retryTracking?.avgAttempts ? retryTracking.avgAttempts.toFixed(1) : '-'}
                    </p>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-orange-400/70 uppercase">High Retry (3+)</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{retryTracking?.highRetryEvents ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ═══════════ RECENT EVENTS TABLE ═══════════ */}
            <Card className="border-slate-800 bg-slate-900/60 py-0 gap-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    Recent Events
                    <Badge variant="secondary" className="text-xs">
                      {recentEvents.length}
                    </Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-5">
                {recentEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <Webhook className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">No webhook events recorded yet</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border">
                          <TableHead className="text-xs text-muted-foreground">Provider</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Event Type</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden sm:table-cell">Attempts</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden md:table-cell">Time (ms)</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden lg:table-cell">Error</TableHead>
                          <TableHead className="text-xs text-muted-foreground text-right">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentEvents.map((event) => (
                          <TableRow key={event.id} className="border-border">
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{PROVIDER_ICONS[event.provider] || '🔗'}</span>
                                <span className="text-xs font-medium">{event.provider}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs text-muted-foreground max-w-[150px] truncate block">
                                {event.eventType}
                              </code>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={event.status} />
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className={`text-xs font-medium ${event.processingAttempts > 1 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                                {event.processingAttempts}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {event.processingTimeMs != null ? event.processingTimeMs : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span
                                className="text-xs text-red-400 max-w-[200px] truncate block"
                                title={event.errorMessage || undefined}
                              >
                                {event.errorMessage || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatRelativeTime(event.createdAt)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══════════ FOOTER ═══════════ */}
            <div className="text-center pt-4 pb-8">
              <p className="text-xs text-muted-foreground">
                {lastUpdated
                  ? `Last updated: ${lastUpdated.toLocaleString()}`
                  : 'Monitoring active'}
                {autoRefresh && ' · Auto-refreshing every 30s'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WebhookDashboard;
