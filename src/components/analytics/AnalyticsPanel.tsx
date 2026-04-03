'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Types ──────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'pages' | 'events' | 'users';

interface OverviewRow {
  page: string | null;
  count: number;
}

interface PagesRow {
  page: string | null;
  count: number;
}

interface EventsRow {
  event: string;
  count: number;
}

interface UsersRow {
  userId: string | null;
  eventCount: number;
}

interface TabConfig {
  key: TabKey;
  label: string;
  columns: string[];
}

const TABS: TabConfig[] = [
  { key: 'overview', label: 'Overview', columns: ['Page', 'Views'] },
  { key: 'pages', label: 'Pages', columns: ['Page', 'Events'] },
  { key: 'events', label: 'Events', columns: ['Event', 'Count'] },
  { key: 'users', label: 'Users', columns: ['User ID', 'Events'] },
];

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function downloadCSV(headers: string[], rows: string[][], filename: string) {
  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Component ──────────────────────────────────────────────────────────

export function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range — default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: activeTab,
        startDate,
        endDate,
      });

      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── CSV export ─────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (!tab || !data) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    switch (activeTab) {
      case 'overview': {
        headers = ['Page', 'Views'];
        rows = ((data.topPages ?? []) as OverviewRow[]).map((r) => [
          r.page ?? '(unknown)',
          String(r.count),
        ]);
        break;
      }
      case 'pages': {
        headers = ['Page', 'Events'];
        rows = ((data.pages ?? []) as PagesRow[]).map((r) => [
          r.page ?? '(unknown)',
          String(r.count),
        ]);
        break;
      }
      case 'events': {
        headers = ['Event', 'Count'];
        rows = ((data.events ?? []) as EventsRow[]).map((r) => [
          r.event,
          String(r.count),
        ]);
        break;
      }
      case 'users': {
        headers = ['User ID', 'Events'];
        rows = ((data.users ?? []) as UsersRow[]).map((r) => [
          r.userId ?? '(anonymous)',
          String(r.eventCount),
        ]);
        break;
      }
    }

    downloadCSV(headers, rows, `analytics-${activeTab}-${startDate}-${endDate}.csv`);
  }, [activeTab, data, startDate, endDate]);

  // ─── Render table rows based on active tab ──────────────────────────

  const renderRows = () => {
    if (!data) return null;

    switch (activeTab) {
      case 'overview': {
        const items = (data.topPages ?? []) as OverviewRow[];
        if (items.length === 0) {
          return <tr><td colSpan={2} className="text-center text-muted-foreground py-8">No data</td></tr>;
        }
        return items.map((row, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-3 px-4 text-sm font-mono truncate max-w-xs">{row.page ?? '(unknown)'}</td>
            <td className="py-3 px-4 text-sm text-right tabular-nums">{row.count.toLocaleString()}</td>
          </tr>
        ));
      }
      case 'pages': {
        const items = (data.pages ?? []) as PagesRow[];
        if (items.length === 0) {
          return <tr><td colSpan={2} className="text-center text-muted-foreground py-8">No data</td></tr>;
        }
        return items.map((row, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-3 px-4 text-sm font-mono truncate max-w-xs">{row.page ?? '(unknown)'}</td>
            <td className="py-3 px-4 text-sm text-right tabular-nums">{row.count.toLocaleString()}</td>
          </tr>
        ));
      }
      case 'events': {
        const items = (data.events ?? []) as EventsRow[];
        if (items.length === 0) {
          return <tr><td colSpan={2} className="text-center text-muted-foreground py-8">No data</td></tr>;
        }
        return items.map((row, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-3 px-4 text-sm font-mono">{row.event}</td>
            <td className="py-3 px-4 text-sm text-right tabular-nums">{row.count.toLocaleString()}</td>
          </tr>
        ));
      }
      case 'users': {
        const items = (data.users ?? []) as UsersRow[];
        if (items.length === 0) {
          return <tr><td colSpan={2} className="text-center text-muted-foreground py-8">No data</td></tr>;
        }
        return items.map((row, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-3 px-4 text-sm font-mono truncate max-w-xs">{row.userId ?? '(anonymous)'}</td>
            <td className="py-3 px-4 text-sm text-right tabular-nums">{row.eventCount.toLocaleString()}</td>
          </tr>
        ));
      }
    }
  };

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Analytics</CardTitle>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={!data || loading}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 mt-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-border/50 custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  {currentTab.columns.map((col) => (
                    <th
                      key={col}
                      className={`py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${
                        col === 'Views' || col === 'Events' || col === 'Count' ? 'text-right' : ''
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
