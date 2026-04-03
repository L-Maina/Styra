'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Filter,
  Search,
  ChevronDown,
  MoreHorizontal,
  Eye,
  RefreshCw,
  FileText,
  PieChart,
  BarChart3,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Heart,
  Crown,
  Target,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMonetization } from './MonetizationProvider';
import type {
  RevenueBreakdown,
  RevenueMetrics,
  PlatformTransaction,
  TopPerformer,
  RevenueByCategory,
} from '@/types/monetization';

// ============================================
// TYPES
// ============================================

interface RevenueDashboardProps {
  adminId?: string;
  onExport?: (format: 'csv' | 'pdf') => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

interface TransactionRowProps {
  transaction: PlatformTransaction;
  onViewDetails?: () => void;
}

// ============================================
// STAT CARD COMPONENT
// ============================================

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  iconBg,
}) => {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={cn('p-3 rounded-xl', iconBg)}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
          {change !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {changeLabel && (
            <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// TRANSACTION ROW COMPONENT
// ============================================

const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onViewDetails }) => {
  const typeConfig = {
    BOOKING_COMMISSION: { label: 'Booking', icon: CreditCard, color: 'text-green-600' },
    PREMIUM_LISTING: { label: 'Premium', icon: Crown, color: 'text-amber-600' },
    MARKETING_BOOST: { label: 'Marketing', icon: Target, color: 'text-purple-600' },
    SUBSCRIPTION: { label: 'Subscription', icon: Layers, color: 'text-blue-600' },
    TIP_PROCESSING: { label: 'Tip', icon: Heart, color: 'text-pink-600' },
    REFUND: { label: 'Refund', icon: RefreshCw, color: 'text-red-600' },
    CHARGEBACK: { label: 'Chargeback', icon: AlertCircle, color: 'text-orange-600' },
    PAYOUT: { label: 'Payout', icon: DollarSign, color: 'text-indigo-600' },
    ADJUSTMENT: { label: 'Adjustment', icon: MoreHorizontal, color: 'text-gray-600' },
  };
  
  const statusConfig = {
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800' },
    FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800' },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
    REFUNDED: { label: 'Refunded', color: 'bg-orange-100 text-orange-800' },
    DISPUTED: { label: 'Disputed', color: 'bg-purple-100 text-purple-800' },
  };
  
  const config = typeConfig[transaction.type];
  const status = statusConfig[transaction.status];
  const Icon = config.icon;
  
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-muted', config.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{transaction.id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', status.color)}>
          {status.label}
        </span>
      </TableCell>
      <TableCell className="text-right font-medium">
        ${transaction.amount.toFixed(2)}
      </TableCell>
      <TableCell className="text-right text-green-600 font-medium">
        +${transaction.platformFee.toFixed(2)}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        ${transaction.providerAmount.toFixed(2)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(transaction.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={onViewDetails}>
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

// ============================================
// TOP PERFORMERS COMPONENT
// ============================================

interface TopPerformersProps {
  performers: TopPerformer[];
  title: string;
}

const TopPerformers: React.FC<TopPerformersProps> = ({ performers, title }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {performers.map((performer, index) => (
            <div
              key={performer.id}
              className="flex items-center gap-3"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                  index === 0 && 'bg-amber-100 text-amber-800',
                  index === 1 && 'bg-gray-100 text-gray-800',
                  index === 2 && 'bg-orange-100 text-orange-800',
                  index > 2 && 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{performer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {performer.transactions} transactions
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${performer.revenue.toFixed(0)}</p>
                <p
                  className={cn(
                    'text-xs font-medium',
                    performer.growth >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {performer.growth >= 0 ? '+' : ''}
                  {performer.growth.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Trophy icon for TopPerformers
const Trophy = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

// ============================================
// REVENUE CHART COMPONENT
// ============================================

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  
  return (
    <div className="h-48 flex items-end gap-1">
      {data.map((item, index) => (
        <div
          key={index}
          className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-colors relative group"
          style={{ height: `${(item.revenue / maxRevenue) * 100}%` }}
        >
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            ${item.revenue.toFixed(0)}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// CATEGORY BREAKDOWN COMPONENT
// ============================================

interface CategoryBreakdownProps {
  categories: RevenueByCategory[];
}

const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ categories }) => {
  const totalRevenue = categories.reduce((sum, c) => sum + c.commissionRevenue, 0);
  
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Revenue by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories.map((category, index) => {
            const percentage = (category.commissionRevenue / totalRevenue) * 100;
            
            return (
              <div key={category.category}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', colors[index % colors.length])} />
                    <span className="text-sm font-medium">{category.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">
                      ${category.commissionRevenue.toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// MAIN REVENUE DASHBOARD COMPONENT
// ============================================

export const RevenueDashboard: React.FC<RevenueDashboardProps> = ({
  adminId,
  onExport,
}) => {
  const {
    transactions,
    revenueMetrics,
    revenueBreakdown,
    calculateRevenueMetrics,
    calculateRevenueBreakdown,
    isLoading,
  } = useMonetization();
  
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Calculate date ranges
  const dateRange = useMemo(() => {
    const end = new Date();
    let start = new Date();
    
    switch (period) {
      case 'DAILY':
        start.setDate(start.getDate() - 1);
        break;
      case 'WEEKLY':
        start.setDate(start.getDate() - 7);
        break;
      case 'MONTHLY':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'YEARLY':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    return { start, end };
  }, [period]);
  
  // Calculate metrics
  useEffect(() => {
    calculateRevenueMetrics();
    calculateRevenueBreakdown(period, dateRange.start, dateRange.end);
  }, [period, dateRange, calculateRevenueMetrics, calculateRevenueBreakdown]);
  
  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.businessId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);
  
  // Overview data state (fetched from API)
  const [chartData, setChartData] = useState<{ date: string; revenue: number }[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<TopPerformer[]>([]);
  const [topCategories, setTopCategories] = useState<TopPerformer[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<RevenueByCategory[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Fetch overview data from API
  const fetchOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch('/api/revenue', {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (json.success && json.data?.overview) {
        const { overview } = json.data;
        if (overview.chartData) setChartData(overview.chartData);
        if (overview.topBusinesses) setTopBusinesses(overview.topBusinesses);
        if (overview.topCategories) setTopCategories(overview.topCategories);
        if (overview.categoryBreakdown) setCategoryBreakdown(overview.categoryBreakdown);
      }
    } catch (err: unknown) {
      setOverviewError(err instanceof Error ? err.message : 'Failed to load revenue data');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);
  
  // Format currency
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
          <p className="text-muted-foreground">
            Track platform revenue, commissions, and payouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v: typeof period) => setPeriod(v)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onExport?.('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.('pdf')}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Overview Error State */}
      {overviewError && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <p className="font-semibold text-lg">Failed to load revenue data</p>
              <p className="text-muted-foreground mt-1">{overviewError}</p>
            </div>
            <Button variant="outline" onClick={fetchOverviewData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview Loading Skeleton */}
      {overviewLoading && !overviewError && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
                    <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-7 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end gap-1">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-muted animate-pulse rounded-t"
                      style={{ height: `${Math.random() * 80 + 20}%` }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-5 w-36 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="h-2 w-full bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-5 w-28 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                        <div className="flex-1 space-y-1">
                          <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                        </div>
                        <div className="h-4 w-14 bg-muted animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!overviewLoading && !overviewError && (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(revenueMetrics?.totalRevenue || 0)}
          change={12.5}
          changeLabel="vs. last period"
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title="Commission Revenue"
          value={formatCurrency(revenueBreakdown?.commissionRevenue || 0)}
          change={8.2}
          icon={CreditCard}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Premium Revenue"
          value={formatCurrency((revenueBreakdown?.premiumListingRevenue || 0) + (revenueBreakdown?.marketingBoostRevenue || 0))}
          change={15.3}
          icon={Crown}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <StatCard
          title="Total Transactions"
          value={revenueMetrics?.totalTransactions || 0}
          change={-2.1}
          icon={Activity}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
      </div>
      
      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Monthly revenue over the past year</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart data={chartData} />
              </CardContent>
            </Card>
            
            {/* Category Breakdown */}
            <CategoryBreakdown categories={categoryBreakdown} />
          </div>
          
          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopPerformers performers={topBusinesses} title="Top Businesses" />
            <TopPerformers performers={topCategories} title="Top Categories" />
          </div>
        </TabsContent>
        
        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead className="text-right">Provider</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.slice(0, 20).map((transaction) => (
                        <TransactionRow key={transaction.id} transaction={transaction} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Revenue Summary',
                description: 'Monthly revenue breakdown by source',
                icon: DollarSign,
              },
              {
                title: 'Transaction Detail',
                description: 'Detailed transaction log with filters',
                icon: FileText,
              },
              {
                title: 'Payout Report',
                description: 'Provider payouts and pending balances',
                icon: CreditCard,
              },
              {
                title: 'Tax Summary',
                description: 'Tax documentation and summaries',
                icon: FileText,
              },
              {
                title: 'Commission Report',
                description: 'Commission rates and collected fees',
                icon: PieChart,
              },
              {
                title: 'Premium Revenue',
                description: 'Revenue from premium listings and boosts',
                icon: Crown,
              },
            ].map((report, index) => {
              const Icon = report.icon;
              return (
                <Card key={index} className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{report.title}</CardTitle>
                    </div>
                    <CardDescription>{report.description}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  );
};

export default RevenueDashboard;
