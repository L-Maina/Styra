'use client';

import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import {
  useCommissionStore,
  useTransactionStore,
  usePayoutStore,
  usePremiumListingsStore,
  useDiscountCodesStore,
  useRevenueStore,
  useMonetizationStore,
} from '@/store/monetization';
import type {
  PlatformTransaction,
  TransactionBreakdown,
  Payout,
  PayoutMethod,
  PremiumListing,
  DiscountCode,
  EscrowAccount,
  RevenueBreakdown,
  RevenueMetrics,
} from '@/types/monetization';
import type { Booking, Payment } from '@/types';

// ============================================
// CONTEXT TYPES
// ============================================

interface MonetizationContextValue {
  // Commission
  commissionRate: number;
  calculateCommission: (amount: number, businessId?: string, category?: string) => number;
  getEffectiveRate: (businessId?: string, category?: string) => number;
  
  // Transactions
  transactions: PlatformTransaction[];
  escrowAccounts: EscrowAccount[];
  pendingEscrow: EscrowAccount[];
  createTransaction: (
    bookingId: string,
    businessId: string,
    userId: string,
    amount: number,
    paymentMethod: string,
    breakdown: TransactionBreakdown
  ) => PlatformTransaction;
  
  // Escrow
  releaseEscrow: (escrowId: string) => void;
  refundEscrow: (escrowId: string, reason: string) => void;
  
  // Payouts
  payouts: Payout[];
  requestPayout: (businessId: string, amount: number, method: PayoutMethod) => Payout | null;
  getProviderEarnings: (businessId: string) => {
    totalEarned: number;
    pendingBalance: number;
    availableBalance: number;
    totalCommissionPaid: number;
  };
  
  // Premium Listings
  premiumListings: PremiumListing[];
  purchasePromotedListing: (
    businessId: string,
    boostLevel: number,
    duration: number,
    price: number
  ) => PremiumListing;
  purchaseFeaturedListing: (
    businessId: string,
    section: 'HOMEPAGE' | 'CATEGORY' | 'SEARCH',
    duration: number,
    price: number
  ) => PremiumListing;
  purchaseMarketingBoost: (
    businessId: string,
    channels: ('EMAIL' | 'SOCIAL' | 'PUSH')[],
    price: number
  ) => PremiumListing;
  
  // Discount Codes
  discountCodes: DiscountCode[];
  validateDiscountCode: (
    code: string,
    userId: string,
    amount: number,
    businessId?: string,
    category?: string
  ) => { valid: boolean; discount?: { discountAmount: number }; error?: string };
  applyDiscountCode: (
    code: string,
    userId: string,
    amount: number
  ) => { breakdown: TransactionBreakdown };
  
  // Revenue
  revenueMetrics: RevenueMetrics | null;
  revenueBreakdown: RevenueBreakdown | null;
  calculateRevenueMetrics: () => RevenueMetrics;
  calculateRevenueBreakdown: (
    period: RevenueBreakdown['period'],
    startDate: Date,
    endDate: Date
  ) => RevenueBreakdown;
  
  // Booking Payment
  processBookingPayment: (
    bookingId: string,
    businessId: string,
    userId: string,
    amount: number,
    paymentMethod: string,
    category?: string,
    discountCode?: string
  ) => { transaction: PlatformTransaction; breakdown: TransactionBreakdown };
  
  // Loading states
  isLoading: boolean;
}

const MonetizationContext = createContext<MonetizationContextValue | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface MonetizationProviderProps {
  children: React.ReactNode;
  defaultCommissionRate?: number;
}

export const MonetizationProvider: React.FC<MonetizationProviderProps> = ({
  children,
  defaultCommissionRate = 15,
}) => {
  // Initialize stores
  const {
    settings: commissionSettings,
    calculateCommission: calcCommission,
    getEffectiveRate,
    setDefaultRate,
  } = useCommissionStore();
  
  const {
    transactions,
    escrowAccounts,
    createBookingTransaction,
    releaseEscrow: releaseEscrowFn,
    refundEscrow: refundEscrowFn,
    getPendingEscrow,
    isLoading: transactionLoading,
  } = useTransactionStore();
  
  const {
    payouts,
    requestPayout: requestPayoutFn,
    isLoading: payoutLoading,
  } = usePayoutStore();
  
  const {
    listings: premiumListings,
    purchasePromotedListing: buyPromoted,
    purchaseFeaturedListing: buyFeatured,
    purchaseMarketingBoost: buyMarketingBoost,
    isLoading: premiumLoading,
  } = usePremiumListingsStore();
  
  const {
    codes: discountCodes,
    validateCode,
    applyCode,
  } = useDiscountCodesStore();
  
  const {
    metrics: revenueMetrics,
    breakdown: revenueBreakdown,
    calculateMetrics,
    calculateBreakdown,
    isLoading: revenueLoading,
  } = useRevenueStore();
  
  const {
    processBookingPayment: processPayment,
    getProviderEarnings,
    initialize,
    isInitialized,
  } = useMonetizationStore();
  
  // Initialize on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
      if (commissionSettings.defaultRate !== defaultCommissionRate) {
        setDefaultRate(defaultCommissionRate);
      }
    }
  }, [isInitialized, initialize, defaultCommissionRate, setDefaultRate, commissionSettings.defaultRate]);
  
  // Auto-release escrow for completed services
  useEffect(() => {
    const checkEscrowReleases = () => {
      const pending = getPendingEscrow();
      const now = new Date();
      
      pending.forEach((escrow) => {
        if (escrow.releaseScheduledAt && new Date(escrow.releaseScheduledAt) <= now) {
          releaseEscrowFn(escrow.id);
        }
      });
    };
    
    // Check every minute
    const interval = setInterval(checkEscrowReleases, 60000);
    return () => clearInterval(interval);
  }, [getPendingEscrow, releaseEscrowFn]);
  
  // Wrap functions with useCallback for performance
  const calculateCommission = useCallback(
    (amount: number, businessId?: string, category?: string) => 
      calcCommission(amount, businessId, category),
    [calcCommission]
  );
  
  const createTransaction = useCallback(
    (
      bookingId: string,
      businessId: string,
      userId: string,
      amount: number,
      paymentMethod: string,
      breakdown: TransactionBreakdown
    ) => createBookingTransaction(bookingId, businessId, userId, amount, paymentMethod, breakdown),
    [createBookingTransaction]
  );
  
  const releaseEscrow = useCallback(
    (escrowId: string) => releaseEscrowFn(escrowId),
    [releaseEscrowFn]
  );
  
  const refundEscrow = useCallback(
    (escrowId: string, reason: string) => refundEscrowFn(escrowId, reason),
    [refundEscrowFn]
  );
  
  const requestPayout = useCallback(
    (businessId: string, amount: number, method: PayoutMethod) => 
      requestPayoutFn(businessId, amount, method),
    [requestPayoutFn]
  );
  
  const purchasePromotedListing = useCallback(
    (businessId: string, boostLevel: number, duration: number, price: number) =>
      buyPromoted(businessId, boostLevel, duration, price) as PremiumListing,
    [buyPromoted]
  );
  
  const purchaseFeaturedListing = useCallback(
    (
      businessId: string,
      section: 'HOMEPAGE' | 'CATEGORY' | 'SEARCH',
      duration: number,
      price: number
    ) => buyFeatured(businessId, section, duration, price) as PremiumListing,
    [buyFeatured]
  );
  
  const purchaseMarketingBoost = useCallback(
    (
      businessId: string,
      channels: ('EMAIL' | 'SOCIAL' | 'PUSH')[],
      price: number
    ) => buyMarketingBoost(businessId, channels, price) as PremiumListing,
    [buyMarketingBoost]
  );
  
  const validateDiscountCode = useCallback(
    (
      code: string,
      userId: string,
      amount: number,
      businessId?: string,
      category?: string
    ) => {
      const result = validateCode(code, userId, amount, businessId, category);
      return {
        valid: result.valid,
        discount: result.discount ? { discountAmount: result.discount.discountAmount } : undefined,
        error: result.error,
      };
    },
    [validateCode]
  );
  
  const applyDiscountCode = useCallback(
    (code: string, userId: string, amount: number) => applyCode(code, userId, amount),
    [applyCode]
  );
  
  const calculateRevenueMetrics = useCallback(() => calculateMetrics(), [calculateMetrics]);
  
  const calculateRevenueBreakdown = useCallback(
    (period: RevenueBreakdown['period'], startDate: Date, endDate: Date) =>
      calculateBreakdown(period, startDate, endDate),
    [calculateBreakdown]
  );
  
  const processBookingPayment = useCallback(
    (
      bookingId: string,
      businessId: string,
      userId: string,
      amount: number,
      paymentMethod: string,
      category?: string,
      discountCode?: string
    ) => processPayment(bookingId, businessId, userId, amount, paymentMethod, category, discountCode),
    [processPayment]
  );
  
  const isLoading = transactionLoading || payoutLoading || premiumLoading || revenueLoading;
  
  const pendingEscrow = useMemo(() => getPendingEscrow(), [getPendingEscrow, escrowAccounts]);
  
  const contextValue: MonetizationContextValue = {
    commissionRate: commissionSettings.defaultRate,
    calculateCommission,
    getEffectiveRate,
    transactions,
    escrowAccounts,
    pendingEscrow,
    createTransaction,
    releaseEscrow,
    refundEscrow,
    payouts,
    requestPayout,
    getProviderEarnings,
    premiumListings,
    purchasePromotedListing,
    purchaseFeaturedListing,
    purchaseMarketingBoost,
    discountCodes,
    validateDiscountCode,
    applyDiscountCode,
    revenueMetrics,
    revenueBreakdown,
    calculateRevenueMetrics,
    calculateRevenueBreakdown,
    processBookingPayment,
    isLoading,
  };
  
  return (
    <MonetizationContext.Provider value={contextValue}>
      {children}
    </MonetizationContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useMonetization = () => {
  const context = useContext(MonetizationContext);
  if (!context) {
    throw new Error('useMonetization must be used within a MonetizationProvider');
  }
  return context;
};

// ============================================
// COMMISSION CALCULATOR COMPONENT
// ============================================

interface CommissionCalculatorProps {
  amount: number;
  businessId?: string;
  category?: string;
  onCalculate?: (breakdown: TransactionBreakdown) => void;
}

export const CommissionCalculator: React.FC<CommissionCalculatorProps> = ({
  amount,
  businessId,
  category,
  onCalculate,
}) => {
  const { calculateCommission, getEffectiveRate } = useMonetization();
  
  const rate = getEffectiveRate(businessId, category);
  const commission = calculateCommission(amount, businessId, category);
  const providerAmount = amount - commission;
  
  const breakdown: TransactionBreakdown = {
    subtotal: amount,
    platformCommission: commission,
    commissionPercentage: rate,
    processingFee: 0,
    tip: 0,
    total: amount,
    providerPayout: providerAmount,
  };
  
  useEffect(() => {
    onCalculate?.(breakdown);
  }, [amount, businessId, category]);
  
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Service Amount</span>
        <span className="font-medium">${amount.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Platform Fee ({rate}%)</span>
        <span className="font-medium text-red-500">-${commission.toFixed(2)}</span>
      </div>
      <div className="flex justify-between border-t pt-2">
        <span className="font-semibold">Provider Receives</span>
        <span className="font-bold text-green-600">${providerAmount.toFixed(2)}</span>
      </div>
    </div>
  );
};

// ============================================
// ESCROW STATUS COMPONENT
// ============================================

interface EscrowStatusIndicatorProps {
  escrow: EscrowAccount;
  onRelease?: () => void;
  onRefund?: () => void;
}

export const EscrowStatusIndicator: React.FC<EscrowStatusIndicatorProps> = ({
  escrow,
  onRelease,
  onRefund,
}) => {
  const statusConfig = {
    HELD: { label: 'In Escrow', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
    RELEASED: { label: 'Released', color: 'bg-green-500', textColor: 'text-green-600' },
    PARTIALLY_RELEASED: { label: 'Partial', color: 'bg-blue-500', textColor: 'text-blue-600' },
    REFUNDED: { label: 'Refunded', color: 'bg-red-500', textColor: 'text-red-600' },
    DISPUTED: { label: 'Disputed', color: 'bg-orange-500', textColor: 'text-orange-600' },
  };
  
  const config = statusConfig[escrow.status];
  
  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <div>
          <p className="text-sm font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">
            ${escrow.providerAmount.toFixed(2)} to provider
          </p>
        </div>
      </div>
      {escrow.status === 'HELD' && (
        <div className="flex gap-2">
          {onRelease && (
            <button
              onClick={onRelease}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Release
            </button>
          )}
          {onRefund && (
            <button
              onClick={onRefund}
              className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Refund
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// TRANSACTION SUMMARY COMPONENT
// ============================================

interface TransactionSummaryProps {
  transaction: PlatformTransaction;
  showDetails?: boolean;
}

export const TransactionSummary: React.FC<TransactionSummaryProps> = ({
  transaction,
  showDetails = false,
}) => {
  const typeConfig = {
    BOOKING_COMMISSION: { label: 'Booking', icon: '💰' },
    PREMIUM_LISTING: { label: 'Premium Listing', icon: '⭐' },
    MARKETING_BOOST: { label: 'Marketing', icon: '🚀' },
    SUBSCRIPTION: { label: 'Subscription', icon: '📋' },
    TIP_PROCESSING: { label: 'Tip', icon: '💝' },
    REFUND: { label: 'Refund', icon: '↩️' },
    CHARGEBACK: { label: 'Chargeback', icon: '⚠️' },
    PAYOUT: { label: 'Payout', icon: '💸' },
    ADJUSTMENT: { label: 'Adjustment', icon: '⚙️' },
  };
  
  const statusConfig = {
    PENDING: { label: 'Pending', color: 'text-yellow-600' },
    PROCESSING: { label: 'Processing', color: 'text-blue-600' },
    COMPLETED: { label: 'Completed', color: 'text-green-600' },
    FAILED: { label: 'Failed', color: 'text-red-600' },
    CANCELLED: { label: 'Cancelled', color: 'text-gray-600' },
    REFUNDED: { label: 'Refunded', color: 'text-orange-600' },
    DISPUTED: { label: 'Disputed', color: 'text-purple-600' },
  };
  
  const config = typeConfig[transaction.type];
  const status = statusConfig[transaction.status];
  
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <span className="font-medium">{config.label}</span>
        </div>
        <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Total Amount</p>
          <p className="font-semibold">${transaction.amount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Platform Fee</p>
          <p className="font-semibold text-green-600">${transaction.platformFee.toFixed(2)}</p>
        </div>
        {transaction.tip && transaction.tip > 0 && (
          <div>
            <p className="text-muted-foreground">Tip</p>
            <p className="font-semibold">${transaction.tip.toFixed(2)}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Provider Amount</p>
          <p className="font-semibold">${transaction.providerAmount.toFixed(2)}</p>
        </div>
      </div>
      
      {showDetails && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Transaction ID</span>
            <span className="font-mono">{transaction.id}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Date</span>
            <span>{new Date(transaction.createdAt).toLocaleString()}</span>
          </div>
          {transaction.transactionId && (
            <div className="flex justify-between mt-1">
              <span>Reference</span>
              <span className="font-mono">{transaction.transactionId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// EXPORTS
// ============================================

export default MonetizationProvider;
