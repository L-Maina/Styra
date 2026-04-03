'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  RefreshCw,
  Banknote,
  Clock,
  Truck,
  Wallet,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Info,
  Copy,
  ExternalLink,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassModal,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import api from '@/lib/api-client';
import {
  PayoutStatusBadge,
  PayoutMethodIcon,
  ErrorState,
  EmptyState,
  SectionSkeleton,
  formatCurrency,
  formatDate,
  type Payout,
  type PayoutSummary,
} from './FinancialComponents';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface PayoutManagementPageProps {
  onRequestPayoutOpen?: () => void;
}

type PayoutStatusFilter = 'ALL' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface PaginatedPayouts {
  data: Payout[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// COUNTDOWN HELPER
// ============================================

function getEstimatedArrivalText(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return 'Processing';
  if (diffHours < 1) return 'Less than 1 hour';
  if (diffHours < 24) return `${diffHours}h remaining`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} remaining`;
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

// ============================================
// PAYOUT REQUEST MODAL
// ============================================

interface PayoutRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  currency: string;
  onSuccess: () => void;
}

const payoutMethods = [
  { value: 'MPESA', label: 'M-Pesa', description: 'Instant to mobile wallet', minAmount: 50, fee: 0 },
  { value: 'PAYSTACK', label: 'Paystack', description: 'Bank transfer (1-3 business days)', minAmount: 100, fee: 0 },
] as const;

const PayoutRequestModal: React.FC<PayoutRequestModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  currency,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'MPESA' | 'PAYSTACK'>('MPESA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  const numericAmount = parseFloat(amount) || 0;
  const selectedMethod = payoutMethods.find(m => m.value === method)!;
  const isValid = numericAmount >= selectedMethod.minAmount && numericAmount <= availableBalance;

  const handleAmountChange = (val: string) => {
    // Allow only valid decimal numbers
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      setAmount(val);
    }
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await api.request('/payouts/trigger', {
        method: 'POST',
        body: JSON.stringify({
          amount: numericAmount,
          method,
        }),
      });

      toast.success('Payout requested successfully!', {
        description: `${formatCurrency(numericAmount, currency)} will be sent via ${selectedMethod.label}`,
      });
      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      // Error toast already shown by api client
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setMethod('MPESA');
    setStep('input');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'input' ? 'Request Payout' : 'Confirm Payout'}
      size="md"
    >
      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-5"
          >
            {/* Available Balance */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-700">Available for withdrawal</span>
                <span className="font-bold text-emerald-700">{formatCurrency(availableBalance, currency)}</span>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium mb-2 block">Amount ({currency})</label>
              <GlassInput
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                leftIcon={<span className="text-muted-foreground font-medium">{currency === 'USD' ? '$' : currency}</span>}
                error={
                  numericAmount > 0 && numericAmount < selectedMethod.minAmount
                    ? `Minimum amount is ${formatCurrency(selectedMethod.minAmount, currency)}`
                    : numericAmount > availableBalance
                      ? 'Amount exceeds available balance'
                      : undefined
                }
              />
              {numericAmount > 0 && numericAmount <= availableBalance && (
                <div className="flex items-center gap-2 mt-2">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setAmount((availableBalance * pct).toFixed(2))}
                      className="text-xs px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount(availableBalance.toFixed(2))}
                    className="text-xs px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            {/* Method Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Payout Method</label>
              <div className="space-y-2">
                {payoutMethods.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value as 'MPESA' | 'PAYSTACK')}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                      method === m.value
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-muted/30'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      method === m.value ? 'border-primary' : 'border-muted-foreground/40'
                    )}>
                      {method === m.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <PayoutMethodIcon method={m.value} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.description}
                        {m.minAmount > 0 && ` • Min ${formatCurrency(m.minAmount, currency)}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p>Payout fee: <span className="font-medium text-foreground">{selectedMethod.fee === 0 ? 'Free' : formatCurrency(selectedMethod.fee, currency)}</span></p>
                <p className="mt-0.5">Estimated processing time: {selectedMethod.value === 'MPESA' ? 'Instant' : '1-3 business days'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <GlassButton variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </GlassButton>
              <GlassButton
                variant="primary"
                className="flex-1"
                disabled={!isValid}
                onClick={() => setStep('confirm')}
                rightIcon={<span className="ml-auto">→</span>}
              >
                Review Request
              </GlassButton>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-5"
          >
            {/* Confirmation Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-bold text-lg">{formatCurrency(numericAmount, currency)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Method</span>
                <PayoutMethodIcon method={method} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Fee</span>
                <span className="text-sm font-medium">{selectedMethod.fee === 0 ? 'Free' : formatCurrency(selectedMethod.fee, currency)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground">You&apos;ll receive</span>
                <span className="font-bold text-lg text-emerald-600">
                  {formatCurrency(numericAmount - selectedMethod.fee, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Processing time</span>
                <span className="text-sm font-medium">{selectedMethod.value === 'MPESA' ? 'Instant' : '1-3 business days'}</span>
              </div>
            </div>

            {/* Warning for large amounts */}
            {numericAmount > 500 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  For payouts over {formatCurrency(500, currency)}, our team may verify the request for security purposes.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <GlassButton
                variant="outline"
                className="flex-1"
                onClick={() => setStep('input')}
                disabled={isSubmitting}
              >
                Back
              </GlassButton>
              <GlassButton
                variant="primary"
                className="flex-1"
                isLoading={isSubmitting}
                onClick={handleSubmit}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Confirm Payout
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassModal>
  );
};

// ============================================
// PAYOUT MANAGEMENT PAGE COMPONENT
// ============================================

export const PayoutManagementPage: React.FC<PayoutManagementPageProps> = () => {
  // Data
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>('ALL');

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
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Fetch payouts
  const fetchPayouts = useCallback(async (pageNum: number, isRefresh = false) => {
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
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.request<PaginatedPayouts>('/payouts', { params });

      if (pageNum === 1) {
        setPayouts(res.data.data || []);
      } else {
        setPayouts(prev => [...prev, ...(res.data.data || [])]);
      }
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.request<PayoutSummary>('/payouts/summary');
      setSummary(res.data);
    } catch {
      // Summary is supplementary
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPayouts(1);
    fetchSummary();
  }, [fetchPayouts, fetchSummary]);

  // Reset on filter change
  useEffect(() => {
    fetchPayouts(1);
  }, [statusFilter]);

  // Load more
  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      fetchPayouts(page + 1);
    }
  };

  // Refresh
  const handleRefresh = () => {
    fetchPayouts(1, true);
    fetchSummary();
  };

  // Payout success handler
  const handlePayoutSuccess = () => {
    fetchPayouts(1, true);
    fetchSummary();
  };

  // Copy reference
  const handleCopyReference = (ref: string) => {
    navigator.clipboard.writeText(ref).then(() => {
      toast.success('Reference copied');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  const currency = summary ? 'USD' : 'USD';

  // Error state
  if (error && payouts.length === 0) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <h2 className="text-xl font-semibold">Payouts</h2>
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
            <h2 className="text-xl font-semibold">Payouts</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your withdrawals and payout history
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              isLoading={refreshing}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => setShowPayoutModal(true)}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Request Payout
            </GlassButton>
          </div>
        </div>
      </FadeIn>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Paid Out',
            value: summary?.totalPaid,
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'from-emerald-500 to-green-600',
            iconBg: 'bg-emerald-500/15',
          },
          {
            label: 'Pending',
            value: summary?.totalPending,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'from-amber-500 to-orange-500',
            iconBg: 'bg-amber-500/15',
          },
          {
            label: 'In Transit',
            value: summary?.totalInTransit,
            icon: Truck,
            color: 'text-blue-600',
            bg: 'from-blue-500 to-indigo-500',
            iconBg: 'bg-blue-500/15',
          },
          {
            label: 'Available',
            value: summary?.availableForWithdrawal,
            icon: Wallet,
            color: 'text-teal-600',
            bg: 'from-teal-500 to-cyan-600',
            iconBg: 'bg-teal-500/15',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * i }}
          >
            <GlassCard variant="default" className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.iconBg)}>
                  <card.icon className={cn('h-4 w-4', card.color)} />
                </div>
              </div>
              {loading ? (
                <div className="space-y-1">
                  <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <p className={cn('text-lg sm:text-xl font-bold', card.color)}>
                    {card.value !== undefined ? formatCurrency(card.value, currency) : '$0.00'}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </>
              )}
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground mr-1">Show:</span>
          {(['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as PayoutStatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                statusFilter === status
                  ? 'gradient-bg text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Payout History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <GlassCard variant="default" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Payout History</h3>
            <span className="text-xs text-muted-foreground">
              {loading ? '' : `${payouts.length}${total > payouts.length ? ` of ${total}` : ''} payout${payouts.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block max-h-[500px] overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {loading ? (
                <SectionSkeleton rows={5} />
              ) : payouts.length === 0 ? (
                <EmptyState
                  icon={<Banknote className="h-8 w-8 text-muted-foreground" />}
                  title="No payouts yet"
                  description="Request a payout to withdraw your earnings"
                  action={{
                    label: 'Request your first payout',
                    onClick: () => setShowPayoutModal(true),
                  }}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Method</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Reference</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {payouts.map((payout, i) => (
                      <motion.tr
                        key={payout.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <p className="font-medium">{formatDate(payout.createdAt)}</p>
                          {payout.status === 'PROCESSING' && payout.estimatedArrival && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-0.5">
                              <CalendarClock className="h-3 w-3" />
                              {getEstimatedArrivalText(payout.estimatedArrival)}
                            </div>
                          )}
                          {payout.status === 'PENDING' && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                              <Clock className="h-3 w-3" />
                              Awaiting processing
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold">{formatCurrency(payout.amount, payout.currency)}</span>
                        </td>
                        <td className="py-3 px-3">
                          <PayoutMethodIcon method={payout.method} />
                        </td>
                        <td className="py-3 px-3">
                          <PayoutStatusBadge status={payout.status} />
                          {payout.status === 'FAILED' && payout.failureReason && (
                            <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate">{payout.failureReason}</p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {payout.reference ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono text-muted-foreground">
                                {payout.reference.length > 12
                                  ? `${payout.reference.slice(0, 8)}...`
                                  : payout.reference}
                              </span>
                              <button
                                onClick={() => handleCopyReference(payout.reference!)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy reference"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {payout.status === 'COMPLETED' && payout.completedAt && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(payout.completedAt)}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden max-h-[500px] overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {loading ? (
                <SectionSkeleton rows={5} />
              ) : payouts.length === 0 ? (
                <EmptyState
                  icon={<Banknote className="h-8 w-8 text-muted-foreground" />}
                  title="No payouts yet"
                  description="Request a payout to withdraw your earnings"
                  action={{
                    label: 'Request your first payout',
                    onClick: () => setShowPayoutModal(true),
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout, i) => (
                    <motion.div
                      key={payout.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PayoutMethodIcon method={payout.method} />
                          <span className="font-semibold">{formatCurrency(payout.amount, payout.currency)}</span>
                        </div>
                        <PayoutStatusBadge status={payout.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(payout.createdAt)}</span>
                        {payout.reference && (
                          <button
                            onClick={() => handleCopyReference(payout.reference!)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            <span className="font-mono">{payout.reference.slice(0, 8)}...</span>
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {/* Countdown for pending/processing */}
                      {(payout.status === 'PENDING' || payout.status === 'PROCESSING') && (
                        <div className={cn(
                          'flex items-center gap-1 mt-2 text-xs',
                          payout.status === 'PROCESSING' ? 'text-blue-600' : 'text-amber-600'
                        )}>
                          {payout.status === 'PROCESSING' && payout.estimatedArrival ? (
                            <>
                              <CalendarClock className="h-3 w-3" />
                              <span>{getEstimatedArrivalText(payout.estimatedArrival)}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              <span>Awaiting processing</span>
                            </>
                          )}
                        </div>
                      )}
                      {/* Failed reason */}
                      {payout.status === 'FAILED' && payout.failureReason && (
                        <p className="text-xs text-red-500 mt-2">{payout.failureReason}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Load More */}
          {!loading && payouts.length > 0 && page < totalPages && (
            <div className="mt-4 pt-4 border-t border-border/50 text-center">
              <GlassButton
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                isLoading={loadingMore}
              >
                Load More ({payouts.length} of {total})
              </GlassButton>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Payout Request Modal */}
      <PayoutRequestModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        availableBalance={summary?.availableForWithdrawal || 0}
        currency={currency}
        onSuccess={handlePayoutSuccess}
      />
    </div>
  );
};
