// Styra Monetization Types

// ============================================
// COMMISSION RATES
// ============================================

export type CommissionRateType = 'FLAT' | 'PERCENTAGE' | 'TIERED';

export interface CommissionTier {
  minAmount: number;
  maxAmount: number | null; // null means no upper limit
  rate: number; // percentage
}

export interface CommissionConfig {
  id: string;
  name: string;
  type: CommissionRateType;
  rate: number; // 5-25 percentage
  flatFee?: number; // for flat rate type
  tiers?: CommissionTier[]; // for tiered type
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionSettings {
  defaultRate: number; // 5-25 percentage
  minimumCommission: number; // minimum fee per transaction
  maximumCommission?: number; // optional cap
  categoryRates: Record<string, number>; // override by service category
  businessRates: Record<string, number>; // override by specific business
  promotionalRates: PromotionalRate[];
}

export interface PromotionalRate {
  id: string;
  name: string;
  rate: number;
  startDate: Date;
  endDate: Date;
  applicableTo: 'ALL' | 'NEW_BUSINESSES' | 'SPECIFIC';
  businessIds?: string[];
  isActive: boolean;
}

// ============================================
// PLATFORM TRANSACTION TYPES
// ============================================

export type PlatformTransactionType = 
  | 'BOOKING_COMMISSION'
  | 'PREMIUM_LISTING'
  | 'MARKETING_BOOST'
  | 'SUBSCRIPTION'
  | 'TIP_PROCESSING'
  | 'REFUND'
  | 'CHARGEBACK'
  | 'PAYOUT'
  | 'ADJUSTMENT';

export type TransactionStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export type EscrowStatus = 
  | 'HELD'
  | 'RELEASED'
  | 'PARTIALLY_RELEASED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface PlatformTransaction {
  id: string;
  type: PlatformTransactionType;
  bookingId?: string;
  businessId?: string;
  userId?: string;
  amount: number;
  platformFee: number;
  providerAmount: number;
  tip?: number;
  currency: string;
  status: TransactionStatus;
  escrowStatus?: EscrowStatus;
  escrowReleaseDate?: Date;
  paymentMethod: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface TransactionBreakdown {
  subtotal: number;
  platformCommission: number;
  commissionPercentage: number;
  processingFee: number;
  tip: number;
  tax?: number;
  discount?: number;
  discountCode?: string;
  total: number;
  providerPayout: number;
}

// ============================================
// PAYOUT STATUS AND METHODS
// ============================================

export type PayoutMethod = 'BANK_TRANSFER' | 'PAYPAL' | 'MPESA' | 'STRIPE';

export type PayoutStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ON_HOLD';

export type PayoutFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL';

export interface PayoutAccount {
  id: string;
  businessId: string;
  method: PayoutMethod;
  isPrimary: boolean;
  accountDetails: BankAccountDetails | PayPalDetails | MpesaDetails | StripeDetails;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccountDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string; // last 4 digits stored
  routingNumber?: string;
  swiftCode?: string;
  country: string;
}

export interface PayPalDetails {
  email: string;
}

export interface MpesaDetails {
  phoneNumber: string;
  accountName: string;
}

export interface StripeDetails {
  accountId: string;
  onboardingComplete: boolean;
}

export interface PayoutPreferences {
  businessId: string;
  frequency: PayoutFrequency;
  minimumAmount: number;
  autoPayout: boolean;
  payoutDay?: number; // day of week (0-6) or month (1-31)
  preferredMethod: PayoutMethod;
  taxId?: string;
  taxFormSubmitted: boolean;
}

export interface Payout {
  id: string;
  businessId: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  status: PayoutStatus;
  transactionIds: string[];
  referenceNumber?: string;
  estimatedArrival?: Date;
  processedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  fees: number;
  netAmount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutSummary {
  totalEarned: number;
  totalCommissionPaid: number;
  pendingBalance: number;
  availableBalance: number;
  lastPayout?: Payout;
  nextPayoutDate?: Date;
  nextPayoutAmount?: number;
}

// ============================================
// PREMIUM LISTING TYPES
// ============================================

export type PremiumListingType = 'PROMOTED' | 'FEATURED' | 'MARKETING_BOOST';

export type PremiumStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export interface PremiumListing {
  id: string;
  businessId: string;
  type: PremiumListingType;
  status: PremiumStatus;
  startDate: Date;
  endDate: Date;
  price: number;
  currency: string;
  features: PremiumFeature[];
  analytics?: PremiumAnalytics;
  autoRenew: boolean;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PremiumFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  used?: number;
}

export interface PromotedListing extends PremiumListing {
  type: 'PROMOTED';
  boostLevel: number; // 1-5 for search ranking boost
  targetCategories?: string[];
  targetLocations?: string[];
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface FeaturedListing extends PremiumListing {
  type: 'FEATURED';
  position: number; // position in featured section
  section: 'HOMEPAGE' | 'CATEGORY' | 'SEARCH';
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface MarketingBoostListing extends PremiumListing {
  type: 'MARKETING_BOOST';
  channels: ('EMAIL' | 'SOCIAL' | 'PUSH')[];
  targetAudience?: {
    locations?: string[];
    ageRange?: [number, number];
    interests?: string[];
  };
  scheduledDate?: Date;
  sentCount: number;
  openRate?: number;
  clickRate?: number;
}

export interface PremiumAnalytics {
  views: number;
  clicks: number;
  bookings: number;
  revenue: number;
  previousPeriod?: {
    views: number;
    clicks: number;
    bookings: number;
    revenue: number;
  };
}

// ============================================
// DISCOUNT CODES
// ============================================

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SERVICE';

export type DiscountScope = 'PLATFORM' | 'CATEGORY' | 'BUSINESS' | 'SERVICE';

export interface DiscountCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  applicableIds?: string[]; // business, category, or service IDs
  minimumPurchase?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppliedDiscount {
  codeId: string;
  code: string;
  type: DiscountType;
  value: number;
  discountAmount: number;
}

// ============================================
// REVENUE BREAKDOWN TYPES
// ============================================

export interface RevenueBreakdown {
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  startDate: Date;
  endDate: Date;
  totalRevenue: number;
  commissionRevenue: number;
  premiumListingRevenue: number;
  marketingBoostRevenue: number;
  subscriptionRevenue: number;
  refundAmount: number;
  netRevenue: number;
  transactions: PlatformTransaction[];
}

export interface RevenueMetrics {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  commissionRate: number;
  grossMargin: number;
  revenueGrowth: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

export interface RevenueByCategory {
  category: string;
  transactionCount: number;
  totalVolume: number;
  commissionRevenue: number;
  averageOrderValue: number;
  growth: number;
}

export interface RevenueByBusiness {
  businessId: string;
  businessName: string;
  transactionCount: number;
  totalVolume: number;
  commissionRevenue: number;
  premiumSpending: number;
  netRevenue: number;
  growth: number;
}

// ============================================
// SUBSCRIPTION PLANS (Future)
// ============================================

export type SubscriptionPlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface SubscriptionPlan {
  id: string;
  name: string;
  type: SubscriptionPlanType;
  price: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: SubscriptionFeature[];
  commissionDiscount: number; // discount on commission rate
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface BusinessSubscription {
  id: string;
  businessId: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'TRIAL';
  startDate: Date;
  endDate?: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// FINANCIAL REPORTS
// ============================================

export type ReportType = 
  | 'REVENUE_SUMMARY'
  | 'TRANSACTION_DETAIL'
  | 'PAYOUT_REPORT'
  | 'TAX_SUMMARY'
  | 'COMMISSION_REPORT';

export interface FinancialReport {
  id: string;
  type: ReportType;
  period: RevenueBreakdown['period'];
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedBy: string;
  data: Record<string, unknown>;
  downloadUrl?: string;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
}

export interface ReportFilter {
  type: ReportType;
  period: RevenueBreakdown['period'];
  startDate?: Date;
  endDate?: Date;
  businessId?: string;
  category?: string;
}

// ============================================
// ESCROW MANAGEMENT
// ============================================

export interface EscrowAccount {
  id: string;
  bookingId: string;
  businessId: string;
  customerId: string;
  totalAmount: number;
  platformFee: number;
  providerAmount: number;
  status: EscrowStatus;
  heldAt: Date;
  releaseScheduledAt?: Date;
  releasedAt?: Date;
  refundReason?: string;
  disputeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowReleaseRule {
  id: string;
  name: string;
  description: string;
  trigger: 'SERVICE_COMPLETION' | 'AUTO_RELEASE' | 'MANUAL_APPROVAL' | 'DISPUTE_RESOLUTION';
  delayHours: number; // delay after trigger
  isActive: boolean;
  conditions?: Record<string, unknown>;
}

// ============================================
// TOP PERFORMERS
// ============================================

export interface TopPerformer {
  id: string;
  name: string;
  type: 'BUSINESS' | 'CATEGORY';
  revenue: number;
  transactions: number;
  growth: number;
  rating?: number;
  avatar?: string;
}

export interface TopPerformersList {
  businesses: TopPerformer[];
  categories: TopPerformer[];
  period: RevenueBreakdown['period'];
}
