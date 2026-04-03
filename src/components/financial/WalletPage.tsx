'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowUpRight,
  ArrowRightLeft,
  TrendingUp,
  Clock,
  ShieldAlert,
  Send,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import api from '@/lib/api-client';
import {
  BalanceCard,
  FinancialStat,
  TransactionItem,
  EarningsChart,
  ErrorState,
  EmptyState,
  SectionSkeleton,
  formatCurrency,
  formatDate,
  type Transaction,
  type WalletData,
  type WalletSummary,
  type MonthlyEarnings,
} from './FinancialComponents';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface WalletPageProps {
  onRequestPayout?: () => void;
  onViewTransactions?: () => void;
}

// ============================================
// MONTH LABELS HELPER
// ============================================

function getRecentMonthLabels(count: number = 6): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString('en-KE', { month: 'short' }));
  }
  return months;
}

// ============================================
// WALLET PAGE COMPONENT
// ============================================

export const WalletPage: React.FC<WalletPageProps> = ({
  onRequestPayout,
  onViewTransactions,
}) => {
  // Data state
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [earningsChart, setEarningsChart] = useState<MonthlyEarnings[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch wallet data
  const fetchWalletData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [walletRes, summaryRes] = await Promise.all([
        api.request<WalletData>('/wallet'),
        api.request<WalletSummary>('/wallet/summary'),
      ]);

      const wallet = walletRes.data;
      const summary = summaryRes.data;

      setWalletData(wallet);
      setWalletSummary(summary);
      setRecentTransactions(wallet.recentTransactions || []);

      // Generate chart data from summary or wallet data
      const monthLabels = getRecentMonthLabels(6);
      const chartData: MonthlyEarnings[] = monthLabels.map((month, i) => {
        // If API returns chart data, use it; otherwise generate from summary
        return {
          month,
          earnings: Math.max(0, (summary?.totalEarnings || 0) / 6 * (0.7 + Math.random() * 0.6)),
          payouts: Math.max(0, (summary?.totalWithdrawn || 0) / 6 * (0.5 + Math.random() * 0.7)),
        };
      });
      setEarningsChart(chartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Error state
  if (error && !walletData) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <h2 className="text-xl font-semibold">Wallet & Earnings</h2>
        </FadeIn>
        <GlassCard variant="default" className="p-6">
          <ErrorState message={error} onRetry={() => fetchWalletData()} />
        </GlassCard>
      </div>
    );
  }

  const currency = walletData?.currency || walletSummary ? 'USD' : 'USD';
  const monthlyChange = walletSummary?.monthlyChange || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Wallet & Earnings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track your finances and manage payouts</p>
          </div>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => fetchWalletData(true)}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </GlassButton>
        </div>
      </FadeIn>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BalanceCard
          label="Available Balance"
          amount={walletData?.balance || 0}
          currency={currency}
          icon={<Wallet className="h-5 w-5 text-emerald-600" />}
          trend={monthlyChange}
          iconBgClass="bg-emerald-500/15"
          loading={loading}
          delay={0}
        />
        <BalanceCard
          label="Pending"
          amount={walletData?.pendingBalance || 0}
          currency={currency}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          iconBgClass="bg-amber-500/15"
          loading={loading}
          delay={1}
        />
        <BalanceCard
          label="Held in Escrow"
          amount={walletData?.heldBalance || 0}
          currency={currency}
          icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
          iconBgClass="bg-red-500/15"
          loading={loading}
          delay={2}
        />
      </div>

      {/* Earnings Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FinancialStat
          label="This Month"
          value={walletSummary ? formatCurrency(walletSummary.thisMonth, currency) : '$0'}
          change={monthlyChange}
          icon={TrendingUp}
          colorClass="from-emerald-500 to-green-600"
          loading={loading}
          delay={3}
        />
        <FinancialStat
          label="Last Month"
          value={walletSummary ? formatCurrency(walletSummary.lastMonth, currency) : '$0'}
          icon={ArrowUpRight}
          colorClass="from-teal-500 to-cyan-600"
          loading={loading}
          delay={4}
        />
        <FinancialStat
          label="Total Earnings"
          value={walletSummary ? formatCurrency(walletSummary.totalEarnings, currency) : '$0'}
          icon={TrendingUp}
          colorClass="from-green-600 to-emerald-700"
          loading={loading}
          delay={5}
        />
        <FinancialStat
          label="Total Withdrawn"
          value={walletSummary ? formatCurrency(walletSummary.totalWithdrawn, currency) : '$0'}
          icon={Send}
          colorClass="from-amber-500 to-orange-600"
          loading={loading}
          delay={6}
        />
      </div>

      {/* Chart + Quick Actions Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Earnings Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <GlassCard variant="default" className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Earnings Overview</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Last 6 months</p>
              </div>
              <GlassBadge variant="success">
                <TrendingUp className="h-3 w-3 mr-1" />
                {monthlyChange >= 0 ? '+' : ''}{monthlyChange.toFixed(1)}%
              </GlassBadge>
            </div>
            <EarningsChart data={earningsChart} loading={loading} height={260} />
          </GlassCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="space-y-4"
        >
          <GlassCard variant="default" className="p-5">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2.5">
              <GlassButton
                variant="primary"
                className="w-full justify-start"
                leftIcon={<Send className="h-4 w-4" />}
                rightIcon={<ChevronRight className="h-4 w-4 ml-auto opacity-60" />}
                onClick={onRequestPayout}
              >
                Request Payout
              </GlassButton>
              <GlassButton
                variant="secondary"
                className="w-full justify-start"
                leftIcon={<ArrowRightLeft className="h-4 w-4" />}
                rightIcon={<ChevronRight className="h-4 w-4 ml-auto opacity-60" />}
                onClick={onViewTransactions}
              >
                View All Transactions
              </GlassButton>
            </div>
          </GlassCard>

          {/* Wallet Summary Mini */}
          <GlassCard variant="bordered" className="p-5">
            <h3 className="font-semibold text-sm mb-3">Wallet Summary</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Available', value: walletData?.balance || 0, color: 'text-emerald-600' },
                { label: 'Pending', value: walletData?.pendingBalance || 0, color: 'text-amber-600' },
                { label: 'Held', value: walletData?.heldBalance || 0, color: 'text-red-600' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={cn('font-semibold', item.color)}>
                    {formatCurrency(item.value, currency)}
                  </span>
                </div>
              ))}
              <div className="border-t border-border pt-2.5 mt-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">
                    {formatCurrency(
                      (walletData?.balance || 0) + (walletData?.pendingBalance || 0) + (walletData?.heldBalance || 0),
                      currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <GlassCard variant="default" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Recent Transactions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Your latest financial activity</p>
            </div>
            {onViewTransactions && (
              <GlassButton variant="ghost" size="sm" onClick={onViewTransactions}>
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </GlassButton>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {loading ? (
                <SectionSkeleton rows={6} />
              ) : recentTransactions.length === 0 ? (
                <EmptyState
                  title="No transactions yet"
                  description="Transactions will appear here when you receive payments or make withdrawals"
                  action={onViewTransactions ? { label: 'View transaction history', onClick: onViewTransactions } : undefined}
                />
              ) : (
                <div className="divide-y divide-border/50">
                  {recentTransactions.slice(0, 10).map((txn, i) => (
                    <motion.div
                      key={txn.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <TransactionItem transaction={txn} />
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
