'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  CreditCard,
  Shield,
  ArrowRightLeft,
  Gift,
  Banknote,
  Landmark,
  Smartphone,
  CircleDot,
} from 'lucide-react';
import {
  GlassCard,
  GlassBadge,
  Skeleton,
} from '@/components/ui/custom/glass-components';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  currency: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'PROCESSING';
  date: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface WalletData {
  balance: number;
  pendingBalance: number;
  heldBalance: number;
  currency: string;
  recentTransactions: Transaction[];
}

export interface WalletSummary {
  totalEarnings: number;
  totalPending: number;
  totalHeld: number;
  totalWithdrawn: number;
  thisMonth: number;
  lastMonth: number;
  monthlyChange: number;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  method: 'MPESA' | 'PAYSTACK' | 'BANK_TRANSFER';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  reference?: string;
  estimatedArrival?: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface PayoutSummary {
  totalPaid: number;
  totalPending: number;
  totalInTransit: number;
  availableForWithdrawal: number;
}

export interface MonthlyEarnings {
  month: string;
  earnings: number;
  payouts: number;
}

// ============================================
// ANIMATED COUNTER HOOK
// ============================================

function useAnimatedCounter(target: number, duration: number = 1200, enabled: boolean = true) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);
  const isInitial = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    const start = prevTarget.current;
    const end = target;
    const diff = end - start;

    // For the very first render, set immediately (no animation)
    if (isInitial.current) {
      isInitial.current = false;
      prevTarget.current = end;
      const rafId = requestAnimationFrame(() => setCount(end));
      return () => cancelAnimationFrame(rafId);
    }

    if (Math.abs(diff) < 0.01) {
      prevTarget.current = end;
      return;
    }

    const startTime = performance.now();
    let rafId: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(start + diff * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        prevTarget.current = end;
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);

  return count;
}

// ============================================
// FORMAT HELPERS
// ============================================

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// ============================================
// TRANSACTION TYPE HELPERS
// ============================================

const transactionTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  SERVICE_COMPLETED: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-500/15', label: 'Service Payment' },
  ESCROW_DEPOSIT: { icon: Shield, color: 'text-teal-600', bgColor: 'bg-teal-500/15', label: 'Escrow Deposit' },
  ESCROW_RELEASE: { icon: Shield, color: 'text-teal-500', bgColor: 'bg-teal-500/15', label: 'Escrow Release' },
  PAYOUT: { icon: Banknote, color: 'text-blue-600', bgColor: 'bg-blue-500/15', label: 'Payout' },
  PAYOUT_FAILED: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500/15', label: 'Payout Failed' },
  REFUND: { icon: ArrowRightLeft, color: 'text-orange-600', bgColor: 'bg-orange-500/15', label: 'Refund' },
  PLATFORM_FEE: { icon: CreditCard, color: 'text-purple-600', bgColor: 'bg-purple-500/15', label: 'Platform Fee' },
  PAYMENT_RECEIVED: { icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-500/15', label: 'Payment Received' },
  PROMOTION_CREDIT: { icon: Gift, color: 'text-pink-600', bgColor: 'bg-pink-500/15', label: 'Promo Credit' },
  ADJUSTMENT: { icon: RefreshCw, color: 'text-slate-600', bgColor: 'bg-slate-500/15', label: 'Adjustment' },
};

export function getTransactionTypeConfig(type: string) {
  return transactionTypeConfig[type] || { icon: CircleDot, color: 'text-slate-600', bgColor: 'bg-slate-500/15', label: type.replace(/_/g, ' ') };
}

// ============================================
// BALANCE CARD
// ============================================

interface BalanceCardProps {
  label: string;
  amount: number;
  currency?: string;
  icon?: React.ReactNode;
  trend?: number; // percentage change
  colorClass?: string;
  iconBgClass?: string;
  loading?: boolean;
  delay?: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  label,
  amount,
  currency = 'USD',
  icon,
  trend,
  colorClass = 'from-emerald-500 to-teal-600',
  iconBgClass = 'bg-emerald-500/15',
  loading = false,
  delay = 0,
}) => {
  const animatedAmount = useAnimatedCounter(amount, 1000, !loading);
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const isNeutral = trend === undefined || trend === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1, ease: 'easeOut' }}
    >
      <GlassCard variant="default" className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBgClass)}>
            {icon || <Wallet className="h-5 w-5 text-emerald-600" />}
          </div>
          {!isNeutral && (
            <div className={cn(
              'flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full',
              isPositive ? 'text-emerald-700 bg-emerald-500/10' : 'text-red-700 bg-red-500/10'
            )}>
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {isPositive ? '+' : ''}{trend?.toFixed(1)}%
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="text" className="h-8 w-28" />
            <Skeleton variant="text" className="h-4 w-20" />
          </div>
        ) : (
          <>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight">
              {formatCurrency(animatedAmount, currency)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
          </>
        )}
      </GlassCard>
    </motion.div>
  );
};

// ============================================
// FINANCIAL STAT
// ============================================

interface FinancialStatProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  colorClass?: string;
  loading?: boolean;
  delay?: number;
}

export const FinancialStat: React.FC<FinancialStatProps> = ({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  colorClass = 'from-emerald-500 to-teal-600',
  loading = false,
  delay = 0,
}) => {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1, ease: 'easeOut' }}
    >
      <GlassCard variant="default" className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0', colorClass)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="space-y-1.5">
                <Skeleton variant="text" className="h-5 w-16" />
                <Skeleton variant="text" className="h-3 w-24" />
              </div>
            ) : (
              <>
                <p className="text-lg font-bold truncate">{value}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {change !== undefined && (
                    <span className={cn(
                      'text-xs font-medium',
                      isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {isPositive ? '+' : ''}{change}%
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

// ============================================
// TRANSACTION ITEM
// ============================================

interface TransactionItemProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
  loading?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onClick,
  loading = false,
}) => {
  const config = getTransactionTypeConfig(transaction.type);
  const Icon = config.icon;
  const isCredit = transaction.amount > 0;

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton variant="text" className="h-4 w-32" />
          <Skeleton variant="text" className="h-3 w-20" />
        </div>
        <div className="text-right space-y-1.5">
          <Skeleton variant="text" className="h-4 w-16 ml-auto" />
          <Skeleton variant="text" className="h-3 w-12 ml-auto" />
        </div>
      </div>
    );
  }

  const statusVariant = transaction.status === 'COMPLETED'
    ? 'success'
    : transaction.status === 'PENDING'
      ? 'warning'
      : transaction.status === 'PROCESSING'
        ? 'primary'
        : 'destructive';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg transition-colors',
        onClick ? 'cursor-pointer hover:bg-muted/50' : ''
      )}
      onClick={() => onClick?.(transaction)}
    >
      {/* Icon */}
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', config.bgColor)}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{transaction.description || config.label}</p>
          {transaction.status !== 'COMPLETED' && (
            <GlassBadge variant={statusVariant} className="text-[10px] px-1.5 py-0 shrink-0">
              {transaction.status === 'PROCESSING' ? 'Processing' : transaction.status.charAt(0) + transaction.status.slice(1).toLowerCase()}
            </GlassBadge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(transaction.date)}</p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={cn(
          'font-semibold text-sm',
          isCredit ? 'text-emerald-600' : 'text-red-600'
        )}>
          {isCredit ? '+' : ''}{formatCurrency(transaction.amount, transaction.currency)}
        </p>
        {transaction.reference && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[100px]">
            {transaction.reference}
          </p>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// PAYOUT STATUS BADGE
// ============================================

interface PayoutStatusBadgeProps {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  className?: string;
}

const payoutStatusConfig = {
  PENDING: { variant: 'warning' as const, label: 'Pending', icon: Clock },
  PROCESSING: { variant: 'primary' as const, label: 'Processing', icon: RefreshCw },
  COMPLETED: { variant: 'success' as const, label: 'Completed', icon: CheckCircle2 },
  FAILED: { variant: 'destructive' as const, label: 'Failed', icon: XCircle },
};

export const PayoutStatusBadge: React.FC<PayoutStatusBadgeProps> = ({ status, className }) => {
  const config = payoutStatusConfig[status] || payoutStatusConfig.PENDING;
  const Icon = config.icon;

  return (
    <GlassBadge variant={config.variant} className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </GlassBadge>
  );
};

// ============================================
// EARNINGS CHART
// ============================================

interface EarningsChartProps {
  data: MonthlyEarnings[];
  loading?: boolean;
  height?: number;
}

export const EarningsChart: React.FC<EarningsChartProps> = ({
  data,
  loading = false,
  height = 280,
}) => {
  if (loading) {
    return (
      <div className="w-full" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="space-y-3 text-center">
            <Skeleton variant="rectangular" className="h-48 w-full max-w-md rounded-lg mx-auto" />
            <Skeleton variant="text" className="h-4 w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No earnings data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val: number) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === 'earnings' ? 'Earnings' : 'Payouts',
            ]}
          />
          <Bar
            dataKey="earnings"
            name="earnings"
            fill="url(#earningsGradient)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
          <Line
            type="monotone"
            dataKey="payouts"
            name="payouts"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <defs>
            <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        {icon || <Wallet className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
        >
          {action.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
};

// ============================================
// PAYOUT METHOD ICON
// ============================================

interface PayoutMethodIconProps {
  method: string;
  className?: string;
}

export const PayoutMethodIcon: React.FC<PayoutMethodIconProps> = ({ method, className }) => {
  const config: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    MPESA: { icon: Smartphone, label: 'M-Pesa', color: 'text-green-600' },
    PAYSTACK: { icon: CreditCard, label: 'Paystack', color: 'text-teal-600' },
    BANK_TRANSFER: { icon: Landmark, label: 'Bank Transfer', color: 'text-blue-600' },
  };
  const c = config[method] || config.BANK_TRANSFER;
  const Icon = c.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', c.color, className)} />
      <span className="text-sm">{c.label}</span>
    </div>
  );
};

// ============================================
// ERROR STATE
// ============================================

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Failed to load data',
  onRetry,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <h3 className="text-base font-semibold mb-1">Something went wrong</h3>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </motion.div>
  );
};

// ============================================
// SECTION SKELETON
// ============================================

export const SectionSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" className="h-4 w-32" />
            <Skeleton variant="text" className="h-3 w-20" />
          </div>
          <Skeleton variant="text" className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
};
