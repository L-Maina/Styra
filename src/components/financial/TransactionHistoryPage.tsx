'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightLeft,
  Filter,
  RefreshCw,
  ChevronDown,
  ListFilter,
  Search,
  Inbox,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import api from '@/lib/api-client';
import {
  TransactionItem,
  ErrorState,
  EmptyState,
  SectionSkeleton,
  getTransactionTypeConfig,
  formatDate,
  type Transaction,
} from './FinancialComponents';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface TransactionHistoryPageProps {
  onBack?: () => void;
}

type TransactionType = 'ALL' | 'SERVICE_COMPLETED' | 'ESCROW_DEPOSIT' | 'ESCROW_RELEASE' | 'PAYOUT' | 'PAYOUT_FAILED' | 'REFUND' | 'PLATFORM_FEE' | 'PAYMENT_RECEIVED' | 'PROMOTION_CREDIT' | 'ADJUSTMENT';
type TransactionStatus = 'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED' | 'PROCESSING';
type TransactionPeriod = 'week' | 'month' | 'quarter' | 'year';

interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TransactionSummary {
  totalCount: number;
  totalCredits: number;
  totalDebits: number;
  netAmount: number;
}

// ============================================
// FILTER OPTIONS
// ============================================

const typeFilters: { value: TransactionType; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'PAYMENT_RECEIVED', label: 'Payments' },
  { value: 'ESCROW_DEPOSIT', label: 'Escrow In' },
  { value: 'ESCROW_RELEASE', label: 'Escrow Out' },
  { value: 'SERVICE_COMPLETED', label: 'Service Completed' },
  { value: 'PAYOUT', label: 'Payouts' },
  { value: 'PAYOUT_FAILED', label: 'Failed Payouts' },
  { value: 'REFUND', label: 'Refunds' },
  { value: 'PLATFORM_FEE', label: 'Platform Fees' },
];

const statusFilters: { value: TransactionStatus; label: string }[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'FAILED', label: 'Failed' },
];

const periodFilters: { value: TransactionPeriod; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

// ============================================
// CUSTOM SELECT COMPONENT
// ============================================

const FilterSelect: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, options, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 rounded-lg border border-input bg-background text-sm',
          'hover:bg-muted/50 transition-colors',
          isOpen && 'ring-2 ring-primary/30'
        )}
      >
        <span className="truncate max-w-[100px] sm:max-w-none">
          {options.find(o => o.value === value)?.label || value}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 z-30 min-w-[160px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left transition-colors',
                  value === option.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/50'
                )}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// TRANSACTION HISTORY PAGE COMPONENT
// ============================================

export const TransactionHistoryPage: React.FC<TransactionHistoryPageProps> = () => {
  // Filters
  const [typeFilter, setTypeFilter] = useState<TransactionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus>('ALL');
  const [periodFilter, setPeriodFilter] = useState<TransactionPeriod>('month');

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch transactions
  const fetchTransactions = useCallback(async (pageNum: number, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params: Record<string, string | number> = {
        page: pageNum,
        limit,
        period: periodFilter,
      };
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.request<PaginatedTransactions>('/transactions', { params });

      if (pageNum === 1) {
        setTransactions(res.data.data || []);
      } else {
        setTransactions(prev => [...prev, ...(res.data.data || [])]);
      }
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [typeFilter, statusFilter, periodFilter]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.request<TransactionSummary>('/transactions/summary');
      setSummary(res.data);
    } catch {
      // Summary is supplementary, don't block on failure
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTransactions(1);
    fetchSummary();
  }, [fetchTransactions, fetchSummary]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    fetchTransactions(1);
  }, [typeFilter, statusFilter, periodFilter]);

  // Load more
  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      fetchTransactions(page + 1);
    }
  };

  // Refresh
  const handleRefresh = () => {
    fetchTransactions(1, true);
    fetchSummary();
  };

  const activeFilterCount = [typeFilter !== 'ALL', statusFilter !== 'ALL', periodFilter !== 'month'].filter(Boolean).length;

  // Error state
  if (error && transactions.length === 0) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <h2 className="text-xl font-semibold">Transaction History</h2>
        </FadeIn>
        <GlassCard variant="default" className="p-6">
          <ErrorState message={error} onRetry={handleRefresh} />
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Transaction History</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? 'Loading...' : `${total} transaction${total !== 1 ? 's' : ''} found`}
            </p>
          </div>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </GlassButton>
        </div>
      </FadeIn>

      {/* Summary Cards */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Credits', value: summary?.totalCredits, color: 'text-emerald-600' },
            { label: 'Total Debits', value: summary?.totalDebits, color: 'text-red-600' },
            { label: 'Net Amount', value: summary?.netAmount, color: summary && summary.netAmount >= 0 ? 'text-emerald-600' : 'text-red-600' },
          ].map((item) => (
            <GlassCard key={item.label} variant="default" className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={cn('text-base sm:text-lg font-bold', item.color)}>
                {item.value !== undefined && item.value !== null
                  ? `${item.value >= 0 ? '+' : ''}$${item.value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'
                }
              </p>
            </GlassCard>
          ))}
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.15}>
        <GlassCard variant="default" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <GlassBadge variant="primary" className="ml-1">{activeFilterCount} active</GlassBadge>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setTypeFilter('ALL');
                  setStatusFilter('ALL');
                  setPeriodFilter('month');
                }}
                className="text-xs text-primary hover:underline ml-auto"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              value={typeFilter}
              options={typeFilters}
              onChange={(v) => setTypeFilter(v as TransactionType)}
            />
            <FilterSelect
              value={statusFilter}
              options={statusFilters}
              onChange={(v) => setStatusFilter(v as TransactionStatus)}
            />
            <FilterSelect
              value={periodFilter}
              options={periodFilters}
              onChange={(v) => setPeriodFilter(v as TransactionPeriod)}
            />
          </div>
        </GlassCard>
      </FadeIn>

      {/* Transaction List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <GlassCard variant="default" className="p-5">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {loading ? (
                <SectionSkeleton rows={8} />
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="h-8 w-8 text-muted-foreground" />}
                  title="No transactions found"
                  description={activeFilterCount > 0
                    ? 'Try adjusting your filters to see more results'
                    : 'Transactions will appear here when you receive payments or make withdrawals'
                  }
                  action={activeFilterCount > 0 ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setTypeFilter('ALL');
                      setStatusFilter('ALL');
                      setPeriodFilter('month');
                    },
                  } : undefined}
                />
              ) : (
                <>
                  <div className="divide-y divide-border/50">
                    {transactions.map((txn, i) => (
                      <motion.div
                        key={txn.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      >
                        <TransactionItem transaction={txn} />
                      </motion.div>
                    ))}
                  </div>

                  {/* Load More */}
                  {page < totalPages && (
                    <div className="mt-4 pt-4 border-t border-border/50 text-center">
                      <GlassButton
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        isLoading={loadingMore}
                      >
                        Load More ({transactions.length} of {total})
                      </GlassButton>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-border/30 text-center">
                    <p className="text-xs text-muted-foreground">
                      Showing {transactions.length} of {total} transactions
                    </p>
                  </div>
                </>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
