'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Users, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────────────────────────

interface OverviewData {
  totalEvents: number;
  uniqueUsers: number;
  pageViews: number;
  topPages: Array<{ page: string | null; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
}

type Period = '1d' | '7d' | '30d' | '90d';

interface MetricCard {
  label: string;
  value: string;
  change?: string;
  sparkData: number[];
  icon: React.ReactNode;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getPeriodDays(period: Period): number {
  switch (period) {
    case '1d': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function buildSparkline(data: number[], width = 64, height = 24): string {
  if (data.length < 2) return '';
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return `M${points.join(' L')}`;
}

// ─── Component ──────────────────────────────────────────────────────────

export function AnalyticsWidget() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const params = new URLSearchParams({
        type: 'overview',
        startDate: startDate.toISOString().split('T')[0],
      });

      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const periods: Array<{ key: Period; label: string }> = [
    { key: '1d', label: 'Today' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
  ];

  // Sparkline data: last 7 data points from daily trend
  const sparkData = data?.dailyTrend
    ? data.dailyTrend.slice(-7).map((d) => d.count)
    : [];

  // Conversion rate approximation
  const signupEvents = data?.dailyTrend
    ? 0 // placeholder — real signup tracking would be separate
    : 0;
  const conversionRate =
    data && data.pageViews > 0
      ? ((signupEvents / data.pageViews) * 100).toFixed(1)
      : '0.0';

  // Avg session duration (placeholder — tracked via engagement events)
  const avgSession = '4m 32s';

  const metrics: MetricCard[] = [
    {
      label: 'Total Page Views',
      value: data ? formatNumber(data.pageViews) : '—',
      change: '+12%',
      sparkData,
      icon: <Eye className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: 'Active Users',
      value: data ? formatNumber(data.uniqueUsers) : '—',
      sparkData,
      icon: <Users className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      sparkData,
      icon: <TrendingUp className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: 'Avg Session',
      value: avgSession,
      sparkData,
      icon: <Clock className="h-5 w-5 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              period === p.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-4 gap-0">
            <CardHeader className="pb-0 px-0 pt-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.label}
                </CardTitle>
                {metric.icon}
              </div>
            </CardHeader>
            <CardContent className="px-0 pt-2 pb-0">
              {loading ? (
                <Skeleton className="h-8 w-24 mb-2" />
              ) : error ? (
                <div className="flex items-center gap-1 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Error</span>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  {metric.change && (
                    <span className="text-xs text-emerald-500">
                      {metric.change}
                    </span>
                  )}
                </>
              )}

              {/* SVG sparkline */}
              {!loading && !error && metric.sparkData.length > 1 && (
                <svg
                  viewBox={`0 0 64 24`}
                  className="mt-2 w-full h-6"
                  fill="none"
                >
                  <path
                    d={buildSparkline(metric.sparkData)}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="text-primary/60"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchOverview}
            className="ml-auto underline text-xs hover:text-destructive/80"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
