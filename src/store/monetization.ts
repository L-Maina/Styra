import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CommissionSettings,
  PlatformTransaction,
  Payout,
  PayoutAccount,
  PayoutPreferences,
  PayoutSummary,
  PremiumListing,
  PromotedListing,
  FeaturedListing,
  MarketingBoostListing,
  DiscountCode,
  RevenueBreakdown,
  RevenueMetrics,
  RevenueByCategory,
  RevenueByBusiness,
  EscrowAccount,
  TopPerformersList,
  TransactionBreakdown,
  AppliedDiscount,
  PayoutMethod,
  PayoutStatus,
  PremiumListingType,
  PremiumStatus,
  TransactionStatus,
  EscrowStatus,
} from '@/types/monetization';

// ============================================
// COMMISSION SETTINGS STORE
// ============================================

interface CommissionState {
  settings: CommissionSettings;
  isLoading: boolean;
  
  // Actions
  setSettings: (settings: Partial<CommissionSettings>) => void;
  setDefaultRate: (rate: number) => void;
  setCategoryRate: (category: string, rate: number) => void;
  removeCategoryRate: (category: string) => void;
  setBusinessRate: (businessId: string, rate: number) => void;
  removeBusinessRate: (businessId: string) => void;
  setLoading: (loading: boolean) => void;
  
  // Computed helpers
  getEffectiveRate: (businessId?: string, category?: string) => number;
  calculateCommission: (amount: number, businessId?: string, category?: string) => number;
}

const defaultCommissionSettings: CommissionSettings = {
  defaultRate: 15, // 15% default commission
  minimumCommission: 0.50, // minimum $0.50 commission
  maximumCommission: 100, // maximum $100 commission
  categoryRates: {},
  businessRates: {},
  promotionalRates: [],
};

export const useCommissionStore = create<CommissionState>()(
  persist(
    (set, get) => ({
      settings: defaultCommissionSettings,
      isLoading: false,
      
      setSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      setDefaultRate: (rate) => set((state) => ({
        settings: { ...state.settings, defaultRate: Math.min(25, Math.max(5, rate)) }
      })),
      
      setCategoryRate: (category, rate) => set((state) => ({
        settings: {
          ...state.settings,
          categoryRates: { ...state.settings.categoryRates, [category]: rate }
        }
      })),
      
      removeCategoryRate: (category) => set((state) => {
        const { [category]: _, ...rest } = state.settings.categoryRates;
        return { settings: { ...state.settings, categoryRates: rest } };
      }),
      
      setBusinessRate: (businessId, rate) => set((state) => ({
        settings: {
          ...state.settings,
          businessRates: { ...state.settings.businessRates, [businessId]: rate }
        }
      })),
      
      removeBusinessRate: (businessId) => set((state) => {
        const { [businessId]: _, ...rest } = state.settings.businessRates;
        return { settings: { ...state.settings, businessRates: rest } };
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      getEffectiveRate: (businessId, category) => {
        const { settings } = get();
        
        // Check business-specific rate first
        if (businessId && settings.businessRates[businessId]) {
          return settings.businessRates[businessId];
        }
        
        // Check category rate
        if (category && settings.categoryRates[category]) {
          return settings.categoryRates[category];
        }
        
        // Return default rate
        return settings.defaultRate;
      },
      
      calculateCommission: (amount, businessId, category) => {
        const { settings, getEffectiveRate } = get();
        const rate = getEffectiveRate(businessId, category);
        let commission = (amount * rate) / 100;
        
        // Apply minimum
        if (commission < settings.minimumCommission) {
          commission = settings.minimumCommission;
        }
        
        // Apply maximum if set
        if (settings.maximumCommission && commission > settings.maximumCommission) {
          commission = settings.maximumCommission;
        }
        
        return Math.round(commission * 100) / 100;
      },
    }),
    {
      name: 'styra-commission',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// ============================================
// TRANSACTION MANAGEMENT STORE
// ============================================

interface TransactionState {
  transactions: PlatformTransaction[];
  escrowAccounts: EscrowAccount[];
  isLoading: boolean;
  
  // Actions
  setTransactions: (transactions: PlatformTransaction[]) => void;
  addTransaction: (transaction: PlatformTransaction) => void;
  updateTransaction: (id: string, data: Partial<PlatformTransaction>) => void;
  setEscrowAccounts: (accounts: EscrowAccount[]) => void;
  addEscrowAccount: (account: EscrowAccount) => void;
  updateEscrowAccount: (id: string, data: Partial<EscrowAccount>) => void;
  setLoading: (loading: boolean) => void;
  
  // Transaction operations
  createBookingTransaction: (
    bookingId: string,
    businessId: string,
    userId: string,
    amount: number,
    paymentMethod: string,
    breakdown: TransactionBreakdown
  ) => PlatformTransaction;
  
  releaseEscrow: (escrowId: string) => void;
  refundEscrow: (escrowId: string, reason: string) => void;
  
  // Queries
  getTransactionsByBusiness: (businessId: string) => PlatformTransaction[];
  getTransactionsByDateRange: (startDate: Date, endDate: Date) => PlatformTransaction[];
  getPendingEscrow: (businessId?: string) => EscrowAccount[];
}

export const useTransactionStore = create<TransactionState>()((set, get) => ({
  transactions: [],
  escrowAccounts: [],
  isLoading: false,
  
  setTransactions: (transactions) => set({ transactions }),
  
  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions]
  })),
  
  updateTransaction: (id, data) => set((state) => ({
    transactions: state.transactions.map((t) =>
      t.id === id ? { ...t, ...data, updatedAt: new Date() } : t
    )
  })),
  
  setEscrowAccounts: (accounts) => set({ escrowAccounts: accounts }),
  
  addEscrowAccount: (account) => set((state) => ({
    escrowAccounts: [account, ...state.escrowAccounts]
  })),
  
  updateEscrowAccount: (id, data) => set((state) => ({
    escrowAccounts: state.escrowAccounts.map((e) =>
      e.id === id ? { ...e, ...data, updatedAt: new Date() } : e
    )
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  createBookingTransaction: (bookingId, businessId, userId, amount, paymentMethod, breakdown) => {
    const { settings } = useCommissionStore.getState();
    
    const transaction: PlatformTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'BOOKING_COMMISSION',
      bookingId,
      businessId,
      userId,
      amount,
      platformFee: breakdown.platformCommission,
      providerAmount: breakdown.providerPayout,
      tip: breakdown.tip,
      currency: 'KES',
      status: 'COMPLETED',
      escrowStatus: 'HELD',
      paymentMethod,
      transactionId: `STY-${Date.now().toString(36).toUpperCase()}`,
      description: `Booking commission for booking ${bookingId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    };
    
    // Create escrow account
    const escrow: EscrowAccount = {
      id: `esc-${Date.now()}`,
      bookingId,
      businessId,
      customerId: userId,
      totalAmount: amount,
      platformFee: breakdown.platformCommission,
      providerAmount: breakdown.providerPayout,
      status: 'HELD',
      heldAt: new Date(),
      releaseScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state) => ({
      transactions: [transaction, ...state.transactions],
      escrowAccounts: [escrow, ...state.escrowAccounts]
    }));
    
    return transaction;
  },
  
  releaseEscrow: (escrowId) => {
    set((state) => ({
      escrowAccounts: state.escrowAccounts.map((e) =>
        e.id === escrowId
          ? { ...e, status: 'RELEASED' as EscrowStatus, releasedAt: new Date(), updatedAt: new Date() }
          : e
      ),
      transactions: state.transactions.map((t) =>
        t.escrowStatus === 'HELD' && t.bookingId === state.escrowAccounts.find(e => e.id === escrowId)?.bookingId
          ? { ...t, escrowStatus: 'RELEASED' as EscrowStatus, escrowReleaseDate: new Date(), updatedAt: new Date() }
          : t
      )
    }));
  },
  
  refundEscrow: (escrowId, reason) => {
    set((state) => ({
      escrowAccounts: state.escrowAccounts.map((e) =>
        e.id === escrowId
          ? { ...e, status: 'REFUNDED' as EscrowStatus, refundReason: reason, updatedAt: new Date() }
          : e
      ),
      transactions: state.transactions.map((t) =>
        t.escrowStatus === 'HELD' && t.bookingId === state.escrowAccounts.find(e => e.id === escrowId)?.bookingId
          ? { ...t, status: 'REFUNDED' as TransactionStatus, escrowStatus: 'REFUNDED' as EscrowStatus, updatedAt: new Date() }
          : t
      )
    }));
  },
  
  getTransactionsByBusiness: (businessId) => {
    return get().transactions.filter((t) => t.businessId === businessId);
  },
  
  getTransactionsByDateRange: (startDate, endDate) => {
    return get().transactions.filter((t) => {
      const date = new Date(t.createdAt);
      return date >= startDate && date <= endDate;
    });
  },
  
  getPendingEscrow: (businessId) => {
    const { escrowAccounts } = get();
    if (businessId) {
      return escrowAccounts.filter((e) => e.businessId === businessId && e.status === 'HELD');
    }
    return escrowAccounts.filter((e) => e.status === 'HELD');
  },
}));

// ============================================
// PAYOUT MANAGEMENT STORE
// ============================================

interface PayoutState {
  payouts: Payout[];
  payoutAccounts: PayoutAccount[];
  payoutPreferences: Record<string, PayoutPreferences>;
  payoutSummary: Record<string, PayoutSummary>;
  isLoading: boolean;
  
  // Actions
  setPayouts: (payouts: Payout[]) => void;
  addPayout: (payout: Payout) => void;
  updatePayout: (id: string, data: Partial<Payout>) => void;
  setPayoutAccounts: (accounts: PayoutAccount[]) => void;
  addPayoutAccount: (account: PayoutAccount) => void;
  updatePayoutAccount: (id: string, data: Partial<PayoutAccount>) => void;
  setPayoutPreferences: (businessId: string, preferences: PayoutPreferences) => void;
  setPayoutSummary: (businessId: string, summary: PayoutSummary) => void;
  setLoading: (loading: boolean) => void;
  
  // Payout operations
  requestPayout: (
    businessId: string,
    amount: number,
    method: PayoutMethod
  ) => Payout;
  
  processPayout: (payoutId: string) => void;
  completePayout: (payoutId: string, referenceNumber: string) => void;
  failPayout: (payoutId: string, reason: string) => void;
  
  // Queries
  getPayoutsByBusiness: (businessId: string) => Payout[];
  getPendingPayouts: () => Payout[];
}

export const usePayoutStore = create<PayoutState>()(
  persist(
    (set, get) => ({
      payouts: [],
      payoutAccounts: [],
      payoutPreferences: {},
      payoutSummary: {},
      isLoading: false,
      
      setPayouts: (payouts) => set({ payouts }),
      
      addPayout: (payout) => set((state) => ({
        payouts: [payout, ...state.payouts]
      })),
      
      updatePayout: (id, data) => set((state) => ({
        payouts: state.payouts.map((p) =>
          p.id === id ? { ...p, ...data, updatedAt: new Date() } : p
        )
      })),
      
      setPayoutAccounts: (accounts) => set({ payoutAccounts: accounts }),
      
      addPayoutAccount: (account) => set((state) => ({
        payoutAccounts: [...state.payoutAccounts, account]
      })),
      
      updatePayoutAccount: (id, data) => set((state) => ({
        payoutAccounts: state.payoutAccounts.map((a) =>
          a.id === id ? { ...a, ...data, updatedAt: new Date() } : a
        )
      })),
      
      setPayoutPreferences: (businessId, preferences) => set((state) => ({
        payoutPreferences: { ...state.payoutPreferences, [businessId]: preferences }
      })),
      
      setPayoutSummary: (businessId, summary) => set((state) => ({
        payoutSummary: { ...state.payoutSummary, [businessId]: summary }
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      requestPayout: (businessId, amount, method) => {
        const payout: Payout = {
          id: `payout-${Date.now()}`,
          businessId,
          amount,
          currency: 'KES',
          method,
          status: 'PENDING' as PayoutStatus,
          transactionIds: [],
          estimatedArrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 business days
          fees: method === 'BANK_TRANSFER' ? 1.50 : 0,
          netAmount: amount - (method === 'BANK_TRANSFER' ? 1.50 : 0),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          payouts: [payout, ...state.payouts]
        }));
        
        return payout;
      },
      
      processPayout: (payoutId) => {
        set((state) => ({
          payouts: state.payouts.map((p) =>
            p.id === payoutId
              ? { ...p, status: 'PROCESSING' as PayoutStatus, processedAt: new Date(), updatedAt: new Date() }
              : p
          )
        }));
      },
      
      completePayout: (payoutId, referenceNumber) => {
        set((state) => ({
          payouts: state.payouts.map((p) =>
            p.id === payoutId
              ? {
                  ...p,
                  status: 'COMPLETED' as PayoutStatus,
                  referenceNumber,
                  completedAt: new Date(),
                  updatedAt: new Date()
                }
              : p
          )
        }));
      },
      
      failPayout: (payoutId, reason) => {
        set((state) => ({
          payouts: state.payouts.map((p) =>
            p.id === payoutId
              ? { ...p, status: 'FAILED' as PayoutStatus, failureReason: reason, updatedAt: new Date() }
              : p
          )
        }));
      },
      
      getPayoutsByBusiness: (businessId) => {
        return get().payouts.filter((p) => p.businessId === businessId);
      },
      
      getPendingPayouts: () => {
        return get().payouts.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
      },
    }),
    {
      name: 'styra-payouts',
      partialize: (state) => ({
        payouts: state.payouts,
        payoutAccounts: state.payoutAccounts,
        payoutPreferences: state.payoutPreferences,
      }),
    }
  )
);

// ============================================
// PREMIUM LISTINGS STORE
// ============================================

interface PremiumListingsState {
  listings: PremiumListing[];
  promotedListings: PromotedListing[];
  featuredListings: FeaturedListing[];
  marketingBoosts: MarketingBoostListing[];
  isLoading: boolean;
  
  // Actions
  setListings: (listings: PremiumListing[]) => void;
  addListing: (listing: PremiumListing) => void;
  updateListing: (id: string, data: Partial<PremiumListing>) => void;
  cancelListing: (id: string) => void;
  setLoading: (loading: boolean) => void;
  
  // Premium operations
  purchasePromotedListing: (
    businessId: string,
    boostLevel: number,
    duration: number,
    price: number
  ) => PromotedListing;
  
  purchaseFeaturedListing: (
    businessId: string,
    section: 'HOMEPAGE' | 'CATEGORY' | 'SEARCH',
    duration: number,
    price: number
  ) => FeaturedListing;
  
  purchaseMarketingBoost: (
    businessId: string,
    channels: ('EMAIL' | 'SOCIAL' | 'PUSH')[],
    price: number
  ) => MarketingBoostListing;
  
  updateAnalytics: (id: string, analytics: Partial<PremiumListing['analytics']>) => void;
  
  // Queries
  getListingsByBusiness: (businessId: string) => PremiumListing[];
  getActiveListings: (type?: PremiumListingType) => PremiumListing[];
  getExpiringListings: (days: number) => PremiumListing[];
}

const defaultPremiumFeatures = [
  { id: 'boost', name: 'Search Boost', description: 'Boost in search rankings', included: true },
  { id: 'badge', name: 'Premium Badge', description: 'Premium badge on profile', included: true },
  { id: 'analytics', name: 'Analytics', description: 'Access to analytics dashboard', included: true },
  { id: 'priority', name: 'Priority Support', description: 'Priority customer support', included: false },
];

export const usePremiumListingsStore = create<PremiumListingsState>()(
  persist(
    (set, get) => ({
      listings: [],
      promotedListings: [],
      featuredListings: [],
      marketingBoosts: [],
      isLoading: false,
      
      setListings: (listings) => set({ listings }),
      
      addListing: (listing) => set((state) => ({
        listings: [listing, ...state.listings]
      })),
      
      updateListing: (id, data) => set((state) => ({
        listings: state.listings.map((l) =>
          l.id === id ? { ...l, ...data, updatedAt: new Date() } : l
        )
      })),
      
      cancelListing: (id) => set((state) => ({
        listings: state.listings.map((l) =>
          l.id === id ? { ...l, status: 'CANCELLED' as PremiumStatus, updatedAt: new Date() } : l
        )
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      purchasePromotedListing: (businessId, boostLevel, duration, price) => {
        const listing: PromotedListing = {
          id: `promo-${Date.now()}`,
          businessId,
          type: 'PROMOTED',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
          price,
          currency: 'KES',
          features: defaultPremiumFeatures,
          autoRenew: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          boostLevel,
          impressions: 0,
          clicks: 0,
          conversions: 0,
        };
        
        set((state) => ({
          listings: [listing, ...state.listings],
          promotedListings: [listing, ...state.promotedListings]
        }));
        
        return listing;
      },
      
      purchaseFeaturedListing: (businessId, section, duration, price) => {
        const listing: FeaturedListing = {
          id: `feat-${Date.now()}`,
          businessId,
          type: 'FEATURED',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
          price,
          currency: 'KES',
          features: defaultPremiumFeatures.map(f => ({ ...f, included: true })),
          autoRenew: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          position: Math.floor(Math.random() * 10) + 1,
          section,
          impressions: 0,
          clicks: 0,
          conversions: 0,
        };
        
        set((state) => ({
          listings: [listing, ...state.listings],
          featuredListings: [listing, ...state.featuredListings]
        }));
        
        return listing;
      },
      
      purchaseMarketingBoost: (businessId, channels, price) => {
        const listing: MarketingBoostListing = {
          id: `mkt-${Date.now()}`,
          businessId,
          type: 'MARKETING_BOOST',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          price,
          currency: 'KES',
          features: defaultPremiumFeatures,
          autoRenew: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          channels,
          sentCount: 0,
        };
        
        set((state) => ({
          listings: [listing, ...state.listings],
          marketingBoosts: [listing, ...state.marketingBoosts]
        }));
        
        return listing;
      },
      
      updateAnalytics: (id, analytics) => set((state) => ({
        listings: state.listings.map((l) =>
          l.id === id
            ? { ...l, analytics: { ...l.analytics, ...analytics } as PremiumListing['analytics'] }
            : l
        )
      })),
      
      getListingsByBusiness: (businessId) => {
        return get().listings.filter((l) => l.businessId === businessId);
      },
      
      getActiveListings: (type) => {
        const { listings } = get();
        const active = listings.filter((l) => l.status === 'ACTIVE' && new Date(l.endDate) > new Date());
        if (type) {
          return active.filter((l) => l.type === type);
        }
        return active;
      },
      
      getExpiringListings: (days) => {
        const { listings } = get();
        const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return listings.filter((l) =>
          l.status === 'ACTIVE' && new Date(l.endDate) <= threshold && new Date(l.endDate) > new Date()
        );
      },
    }),
    {
      name: 'styra-premium-listings',
    }
  )
);

// ============================================
// DISCOUNT CODES STORE
// ============================================

interface DiscountCodesState {
  codes: DiscountCode[];
  isLoading: boolean;
  
  // Actions
  setCodes: (codes: DiscountCode[]) => void;
  addCode: (code: DiscountCode) => void;
  updateCode: (id: string, data: Partial<DiscountCode>) => void;
  deleteCode: (id: string) => void;
  deactivateCode: (id: string) => void;
  setLoading: (loading: boolean) => void;
  
  // Validation
  validateCode: (
    code: string,
    userId: string,
    amount: number,
    businessId?: string,
    category?: string
  ) => { valid: boolean; discount?: AppliedDiscount; error?: string };
  
  applyCode: (
    code: string,
    userId: string,
    amount: number
  ) => { breakdown: TransactionBreakdown; appliedDiscount?: AppliedDiscount };
  
  // Queries
  getActiveCodes: () => DiscountCode[];
  getCodesByBusiness: (businessId: string) => DiscountCode[];
}

export const useDiscountCodesStore = create<DiscountCodesState>()(
  persist(
    (set, get) => ({
      codes: [],
      isLoading: false,
      
      setCodes: (codes) => set({ codes }),
      
      addCode: (code) => set((state) => ({
        codes: [code, ...state.codes]
      })),
      
      updateCode: (id, data) => set((state) => ({
        codes: state.codes.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date() } : c
        )
      })),
      
      deleteCode: (id) => set((state) => ({
        codes: state.codes.filter((c) => c.id !== id)
      })),
      
      deactivateCode: (id) => set((state) => ({
        codes: state.codes.map((c) =>
          c.id === id ? { ...c, isActive: false, updatedAt: new Date() } : c
        )
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      validateCode: (code, userId, amount, businessId, category) => {
        const { codes } = get();
        const upperCode = code.toUpperCase();
        
        const discountCode = codes.find((c) => c.code === upperCode);
        
        if (!discountCode) {
          return { valid: false, error: 'Invalid discount code' };
        }
        
        if (!discountCode.isActive) {
          return { valid: false, error: 'This code is no longer active' };
        }
        
        const now = new Date();
        if (now < new Date(discountCode.startDate) || now > new Date(discountCode.endDate)) {
          return { valid: false, error: 'This code has expired' };
        }
        
        if (discountCode.usageLimit && discountCode.usageCount >= discountCode.usageLimit) {
          return { valid: false, error: 'This code has reached its usage limit' };
        }
        
        if (discountCode.minimumPurchase && amount < discountCode.minimumPurchase) {
          return { valid: false, error: `Minimum purchase of $${discountCode.minimumPurchase} required` };
        }
        
        // Check scope
        if (discountCode.scope === 'BUSINESS' && businessId) {
          if (!discountCode.applicableIds?.includes(businessId)) {
            return { valid: false, error: 'This code is not valid for this business' };
          }
        }
        
        if (discountCode.scope === 'CATEGORY' && category) {
          if (!discountCode.applicableIds?.includes(category)) {
            return { valid: false, error: 'This code is not valid for this category' };
          }
        }
        
        // Calculate discount
        let discountAmount = 0;
        if (discountCode.type === 'PERCENTAGE') {
          discountAmount = (amount * discountCode.value) / 100;
          if (discountCode.maximumDiscount) {
            discountAmount = Math.min(discountAmount, discountCode.maximumDiscount);
          }
        } else if (discountCode.type === 'FIXED_AMOUNT') {
          discountAmount = Math.min(discountCode.value, amount);
        } else if (discountCode.type === 'FREE_SERVICE') {
          discountAmount = amount;
        }
        
        return {
          valid: true,
          discount: {
            codeId: discountCode.id,
            code: discountCode.code,
            type: discountCode.type,
            value: discountCode.value,
            discountAmount: Math.round(discountAmount * 100) / 100,
          },
        };
      },
      
      applyCode: (code, userId, amount) => {
        const { codes, validateCode } = get();
        const result = validateCode(code, userId, amount);
        
        const breakdown: TransactionBreakdown = {
          subtotal: amount,
          platformCommission: 0,
          commissionPercentage: 15,
          processingFee: 0,
          tip: 0,
          total: amount,
          providerPayout: amount,
        };
        
        if (result.valid && result.discount) {
          // Update usage count
          set((state) => ({
            codes: state.codes.map((c) =>
              c.code === code.toUpperCase()
                ? { ...c, usageCount: c.usageCount + 1 }
                : c
            )
          }));
          
          breakdown.discount = result.discount.discountAmount;
          breakdown.discountCode = result.discount.code;
          breakdown.total = amount - result.discount.discountAmount;
          breakdown.providerPayout = breakdown.total;
        }
        
        // Calculate commission
        const { calculateCommission } = useCommissionStore.getState();
        breakdown.platformCommission = calculateCommission(breakdown.total);
        breakdown.providerPayout = breakdown.total - breakdown.platformCommission;
        
        return { breakdown, appliedDiscount: result.discount };
      },
      
      getActiveCodes: () => {
        const { codes } = get();
        const now = new Date();
        return codes.filter((c) =>
          c.isActive && now >= new Date(c.startDate) && now <= new Date(c.endDate)
        );
      },
      
      getCodesByBusiness: (businessId) => {
        const { codes } = get();
        return codes.filter((c) =>
          c.scope === 'BUSINESS' && c.applicableIds?.includes(businessId)
        );
      },
    }),
    {
      name: 'styra-discount-codes',
    }
  )
);

// ============================================
// REVENUE TRACKING STORE
// ============================================

interface RevenueState {
  metrics: RevenueMetrics | null;
  breakdown: RevenueBreakdown | null;
  byCategory: RevenueByCategory[];
  byBusiness: RevenueByBusiness[];
  topPerformers: TopPerformersList | null;
  isLoading: boolean;
  
  // Actions
  setMetrics: (metrics: RevenueMetrics) => void;
  setBreakdown: (breakdown: RevenueBreakdown) => void;
  setByCategory: (data: RevenueByCategory[]) => void;
  setByBusiness: (data: RevenueByBusiness[]) => void;
  setTopPerformers: (data: TopPerformersList) => void;
  setLoading: (loading: boolean) => void;
  
  // Calculations
  calculateMetrics: () => RevenueMetrics;
  calculateBreakdown: (
    period: RevenueBreakdown['period'],
    startDate: Date,
    endDate: Date
  ) => RevenueBreakdown;
  
  // Export
  exportReport: (type: string, format: 'csv' | 'pdf') => void;
}

export const useRevenueStore = create<RevenueState>()((set, get) => ({
  metrics: null,
  breakdown: null,
  byCategory: [],
  byBusiness: [],
  topPerformers: null,
  isLoading: false,
  
  setMetrics: (metrics) => set({ metrics }),
  setBreakdown: (breakdown) => set({ breakdown }),
  setByCategory: (data) => set({ byCategory: data }),
  setByBusiness: (data) => set({ byBusiness: data }),
  setTopPerformers: (data) => set({ topPerformers: data }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  calculateMetrics: () => {
    const { transactions } = useTransactionStore.getState();
    const { listings } = usePremiumListingsStore.getState();
    
    const completedTransactions = transactions.filter(t => t.status === 'COMPLETED');
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.platformFee, 0);
    const premiumRevenue = listings.reduce((sum, l) => sum + l.price, 0);
    
    const metrics: RevenueMetrics = {
      totalRevenue: totalRevenue + premiumRevenue,
      totalTransactions: completedTransactions.length,
      averageTransactionValue: completedTransactions.length > 0
        ? totalRevenue / completedTransactions.length
        : 0,
      commissionRate: 15,
      grossMargin: 85,
      revenueGrowth: 0,
      monthlyRecurringRevenue: premiumRevenue / 12,
      annualRecurringRevenue: premiumRevenue,
    };
    
    set({ metrics });
    return metrics;
  },
  
  calculateBreakdown: (period, startDate, endDate) => {
    const { transactions } = useTransactionStore.getState();
    const { listings } = usePremiumListingsStore.getState();
    
    const filteredTransactions = transactions.filter(t => {
      const date = new Date(t.createdAt);
      return date >= startDate && date <= endDate && t.status === 'COMPLETED';
    });
    
    const commissionRevenue = filteredTransactions
      .filter(t => t.type === 'BOOKING_COMMISSION')
      .reduce((sum, t) => sum + t.platformFee, 0);
    
    const premiumListingRevenue = listings
      .filter(l => {
        const date = new Date(l.createdAt);
        return date >= startDate && date <= endDate;
      })
      .reduce((sum, l) => sum + l.price, 0);
    
    const marketingBoostRevenue = listings
      .filter(l => l.type === 'MARKETING_BOOST')
      .reduce((sum, l) => {
        const date = new Date(l.createdAt);
        return date >= startDate && date <= endDate ? sum + l.price : sum;
      }, 0);
    
    const refundAmount = filteredTransactions
      .filter(t => t.type === 'REFUND')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const breakdown: RevenueBreakdown = {
      period,
      startDate,
      endDate,
      totalRevenue: commissionRevenue + premiumListingRevenue + marketingBoostRevenue,
      commissionRevenue,
      premiumListingRevenue,
      marketingBoostRevenue,
      subscriptionRevenue: 0,
      refundAmount,
      netRevenue: commissionRevenue + premiumListingRevenue + marketingBoostRevenue - refundAmount,
      transactions: filteredTransactions,
    };
    
    set({ breakdown });
    return breakdown;
  },
  
  exportReport: (type, format) => {
    const { breakdown, metrics, byCategory, byBusiness } = get();
    console.log(`Exporting ${type} report in ${format} format`, {
      breakdown,
      metrics,
      byCategory,
      byBusiness
    });
    // In real implementation, this would generate and download the file
  },
}));

// ============================================
// MAIN MONETIZATION STORE (Combined)
// ============================================

interface MonetizationState {
  isInitialized: boolean;
  
  // Initialize all stores with data
  initialize: () => void;
  
  // Convenience methods that span multiple stores
  processBookingPayment: (
    bookingId: string,
    businessId: string,
    userId: string,
    amount: number,
    paymentMethod: string,
    category?: string,
    discountCode?: string
  ) => { transaction: PlatformTransaction; breakdown: TransactionBreakdown };
  
  getProviderEarnings: (businessId: string) => {
    totalEarned: number;
    pendingBalance: number;
    availableBalance: number;
    totalCommissionPaid: number;
  };
  
  requestProviderPayout: (
    businessId: string,
    amount: number,
    method: PayoutMethod
  ) => Payout | null;
}

export const useMonetizationStore = create<MonetizationState>()((set, get) => ({
  isInitialized: false,
  
  initialize: () => {
    // Initialize with sample data if needed
    set({ isInitialized: true });
  },
  
  processBookingPayment: (bookingId, businessId, userId, amount, paymentMethod, category, discountCode) => {
    const { calculateCommission, getEffectiveRate } = useCommissionStore.getState();
    const { createBookingTransaction } = useTransactionStore.getState();
    
    // Calculate breakdown
    const commissionPercentage = getEffectiveRate(businessId, category);
    const platformCommission = calculateCommission(amount, businessId, category);
    
    let breakdown: TransactionBreakdown = {
      subtotal: amount,
      platformCommission,
      commissionPercentage,
      processingFee: 0,
      tip: 0,
      total: amount,
      providerPayout: amount - platformCommission,
    };
    
    // Apply discount if provided
    if (discountCode) {
      const { applyCode } = useDiscountCodesStore.getState();
      const result = applyCode(discountCode, userId, amount);
      breakdown = result.breakdown;
    }
    
    // Create transaction
    const transaction = createBookingTransaction(
      bookingId,
      businessId,
      userId,
      breakdown.total,
      paymentMethod,
      breakdown
    );
    
    return { transaction, breakdown };
  },
  
  getProviderEarnings: (businessId) => {
    const { transactions, escrowAccounts } = useTransactionStore.getState();
    const { payouts } = usePayoutStore.getState();
    
    const businessTransactions = transactions.filter(t => t.businessId === businessId);
    const businessEscrow = escrowAccounts.filter(e => e.businessId === businessId);
    const businessPayouts = payouts.filter(p => p.businessId === businessId);
    
    const totalEarned = businessTransactions
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + t.providerAmount, 0);
    
    const pendingBalance = businessEscrow
      .filter(e => e.status === 'HELD')
      .reduce((sum, e) => sum + e.providerAmount, 0);
    
    const totalPayouts = businessPayouts
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalCommissionPaid = businessTransactions
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + t.platformFee, 0);
    
    return {
      totalEarned,
      pendingBalance,
      availableBalance: totalEarned - pendingBalance - totalPayouts,
      totalCommissionPaid,
    };
  },
  
  requestProviderPayout: (businessId, amount, method) => {
    const earnings = get().getProviderEarnings(businessId);
    
    if (earnings.availableBalance < amount) {
      return null;
    }
    
    const { requestPayout } = usePayoutStore.getState();
    return requestPayout(businessId, amount, method);
  },
}));
