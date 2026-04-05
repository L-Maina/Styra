'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  DollarSign,
  MessageSquare,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  Eye,
  Send,
  X,
  Info,
  FileCheck,
  ArrowRight,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GradientText,
  FadeIn,
  GlassBadge,
  GlassModal
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';

interface InsuranceClaimsPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

type UserType = 'customer' | 'provider';
type ClaimStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid';

interface ClaimData {
  id: string;
  type: string;
  description: string;
  amount: number;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  businessName?: string;
  customerName?: string;
}

interface PlanInfo {
  plan: 'basic' | 'enhanced' | 'premium';
  name: string;
  price: string;
  maxClaimAmount: number;
  maxClaimsPerMonth: number;
  processingTime: string;
  reviewTime: string;
  features: string[];
}

const claimTypes = {
  customer: [
    { value: 'service_dispute', label: 'Service Dispute' },
    { value: 'refund_request', label: 'Refund Request' },
    { value: 'quality_issue', label: 'Quality Issue' },
    { value: 'safety_concern', label: 'Safety Concern' },
    { value: 'billing_error', label: 'Billing Error' },
    { value: 'other', label: 'Other' },
  ],
  provider: [
    { value: 'no_show', label: 'Customer No-Show' },
    { value: 'damage', label: 'Property Damage' },
    { value: 'payment_dispute', label: 'Payment Dispute' },
    { value: 'harassment', label: 'Harassment Report' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'other', label: 'Other' },
  ],
};

const statusColors: Record<ClaimStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const statusLabels: Record<ClaimStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

const planIcons: Record<string, typeof Shield> = {
  basic: Shield,
  enhanced: Zap,
  premium: Crown,
};

const planBadgeVariant: Record<string, 'default' | 'primary' | 'success'> = {
  basic: 'default',
  enhanced: 'primary',
  premium: 'success',
};

export const InsuranceClaimsPage: React.FC<InsuranceClaimsPageProps> = ({ onBack, onNavigate }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [selectedClaim, setSelectedClaim] = useState<ClaimData | null>(null);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newClaim, setNewClaim] = useState({
    type: '',
    description: '',
    amount: '',
    bookingId: '',
    attachments: [] as File[],
  });

  // Admin detection — admins are not allowed to file claims (blocked at API level too)
  const isAdmin = user?.roles?.includes('ADMIN');

  // Determine user type based on user's role
  const userType: UserType = user?.role === 'BUSINESS_OWNER' ? 'provider' : 'customer';
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/claims', {
        credentials: 'include',
      });
      if (res.ok) {
        const response = await res.json();
        const fetchedClaims: ClaimData[] = response?.data?.data ?? response?.data ?? response?.claims ?? [];
        setClaims(fetchedClaims);
      } else if (res.status === 401) {
        setClaims([]);
      } else {
        setError('Failed to load claims. Please try again later.');
        setClaims([]);
      }
    } catch {
      setError('Unable to connect to the server. Please check your connection.');
      setClaims([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProtectionPlan = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/protection-plan', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPlanInfo(data.data ?? data);
      }
    } catch {
      // Fallback to basic
      setPlanInfo({
        plan: 'basic',
        name: 'Basic Protection',
        price: 'Free',
        maxClaimAmount: 500,
        maxClaimsPerMonth: 5,
        processingTime: '7 days',
        reviewTime: '48 hours',
        features: [],
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchClaims();
    fetchProtectionPlan();
  }, [fetchClaims, fetchProtectionPlan]);

  const handleNewClaimClick = () => {
    setShowNewClaimModal(true);
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user?.id) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: newClaim.type,
          description: newClaim.description,
          amount: parseFloat(newClaim.amount),
          bookingId: newClaim.bookingId || undefined,
          incidentDate: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        fetchClaims();
        fetchProtectionPlan();
        setTimeout(() => {
          setShowNewClaimModal(false);
          setNewClaim({ type: '', description: '', amount: '', bookingId: '', attachments: [] });
          setSubmitStatus('idle');
        }, 2000);
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Claim submission failed:', errData?.error);
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Claim submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewClaim(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...Array.from(e.target.files || [])]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setNewClaim(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const isUpgradeAvailable = planInfo && planInfo.plan === 'basic';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Liquid Glass Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Page Header */}
        <FadeIn className="mb-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              <GradientText>Insurance Claims</GradientText>
            </h1>
            <p className="text-muted-foreground">Submit and track your claims</p>
            {isAdmin && (
              <GlassBadge variant="default" className="mt-3">
                <Eye className="h-3 w-3 mr-1" />
                View Only
              </GlassBadge>
            )}
          </div>
        </FadeIn>
        
        {/* Admin Restriction - Show view-only notice for admin users */}
        {isAuthenticated && isAdmin ? (
          <FadeIn delay={0.1}>
            <GlassCard variant="elevated" className="max-w-lg mx-auto text-center p-8">
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
                <Eye className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <GlassBadge variant="default" className="mb-4">Admin View</GlassBadge>
              <h2 className="text-xl font-semibold mb-3">View Only — Claims Not Available</h2>
              <p className="text-muted-foreground mb-6">
                Admin accounts cannot file insurance claims. This page is for customers and
                service providers only. Use the admin dashboard to manage claims.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <GlassButton
                  variant="outline"
                  onClick={() => onNavigate?.('admin')}
                  leftIcon={<Building2 className="h-4 w-4" />}
                >
                  Go to Admin Dashboard
                </GlassButton>
                <GlassButton
                  variant="outline"
                  onClick={() => onNavigate?.('home')}
                >
                  Go Home
                </GlassButton>
              </div>
            </GlassCard>
          </FadeIn>
        ) : !isAuthenticated ? (
          <FadeIn delay={0.1}>
            <GlassCard variant="elevated" className="max-w-lg mx-auto text-center p-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-3">Sign In Required</h2>
              <p className="text-muted-foreground mb-6">
                You need to be signed in to view and manage your insurance claims. 
                Create an account or sign in to access this feature.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <GlassButton 
                  variant="primary" 
                  onClick={() => onNavigate?.('login')}
                  leftIcon={<User className="h-4 w-4" />}
                >
                  Sign In / Sign Up
                </GlassButton>
                <GlassButton 
                  variant="outline" 
                  onClick={() => onNavigate?.('home')}
                >
                  Go Home
                </GlassButton>
              </div>
            </GlassCard>
          </FadeIn>
        ) : (
          <>
            {/* User Type Badge + Plan Badge */}
            <FadeIn className="mb-6">
              <div className="flex justify-center gap-3 flex-wrap">
                <GlassBadge 
                  variant="primary" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  {userType === 'customer' ? (
                    <>
                      <User className="h-4 w-4" />
                      Customer Claims
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4" />
                      Provider Claims
                    </>
                  )}
                </GlassBadge>
                {planInfo && (
                  <GlassBadge 
                    variant={planBadgeVariant[planInfo.plan]}
                    className="flex items-center gap-2 px-4 py-2"
                  >
                    {React.createElement(planIcons[planInfo.plan], { className: 'h-4 w-4' })}
                    {planInfo.name}
                    {isUpgradeAvailable && (
                      <ArrowRight className="h-3 w-3 opacity-50" />
                    )}
                  </GlassBadge>
                )}
              </div>
            </FadeIn>

            {/* ===== CURRENT PROTECTION PLAN CARD ===== */}
            {planInfo && (
              <FadeIn delay={0.05}>
                <GlassCard 
                  variant={planInfo.plan !== 'basic' ? 'gradient' : 'elevated'} 
                  glow={planInfo.plan !== 'basic'} 
                  className="mb-8 overflow-hidden relative"
                  hover={false}
                >
                  {isUpgradeAvailable && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/8 pointer-events-none z-0" />
                  )}
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'w-14 h-14 rounded-xl flex items-center justify-center',
                          planInfo.plan === 'premium' 
                            ? 'gradient-bg shadow-glow' 
                            : planInfo.plan === 'enhanced' 
                              ? 'bg-primary/15' 
                              : 'bg-muted/50'
                        )}>
                          {React.createElement(planIcons[planInfo.plan], { 
                            className: cn('h-7 w-7', planInfo.plan === 'basic' ? 'text-muted-foreground' : 'text-primary-light') 
                          })}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{planInfo.name}</h3>
                            <span className="text-sm text-muted-foreground">• {planInfo.price}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Up to <span className="font-medium text-foreground">${planInfo.maxClaimAmount.toLocaleString()}</span> per claim • {planInfo.processingTime} processing • {planInfo.maxClaimsPerMonth} claims/month
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isUpgradeAvailable ? (
                          <GlassButton
                            variant="primary"
                            onClick={() => onNavigate?.('safety')}
                            rightIcon={<ArrowRight className="h-4 w-4" />}
                          >
                            Upgrade Your Plan
                          </GlassButton>
                        ) : (
                          <GlassButton
                            variant="outline"
                            onClick={() => onNavigate?.('safety')}
                            rightIcon={<Eye className="h-4 w-4" />}
                          >
                            View Plans
                          </GlassButton>
                        )}
                      </div>
                    </div>

                    {/* Quick feature pills */}
                    {planInfo.features.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {planInfo.features.slice(0, 3).map((feature) => (
                          <span 
                            key={feature} 
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground"
                          >
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </GlassCard>
              </FadeIn>
            )}

            {/* Info Card */}
            <FadeIn delay={0.1}>
              <GlassCard variant="bordered" className="mb-8 border-primary/20 bg-primary/5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Info className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {userType === 'customer' ? 'Customer Protection' : 'Provider Protection'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {userType === 'customer' 
                        ? `Styra protects your bookings. If something goes wrong with your service, file a claim for a refund or compensation. Your ${planInfo?.name || 'Basic'} plan covers claims up to $${planInfo?.maxClaimAmount.toLocaleString() || '500'} with ${planInfo?.processingTime || '7-day'} processing.`
                        : `As a provider, you're protected against no-shows, property damage, and payment disputes. Your ${planInfo?.name || 'Basic'} plan covers up to $${planInfo?.maxClaimAmount.toLocaleString() || '500'} per claim.`}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </FadeIn>

            {/* Loading State */}
            {isLoading && (
              <FadeIn delay={0.2}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  {[...Array(4)].map((_, i) => (
                    <GlassCard key={i} className="p-4 animate-pulse">
                      <div className="h-8 w-16 bg-muted rounded mx-auto mb-2" />
                      <div className="h-4 w-20 bg-muted rounded mx-auto" />
                    </GlassCard>
                  ))}
                </div>
                <GlassCard variant="bordered" className="overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <div className="h-5 w-28 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="p-12 text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading claims...</p>
                  </div>
                </GlassCard>
              </FadeIn>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <FadeIn delay={0.2}>
                <GlassCard variant="bordered" className="mb-8 border-red-200 dark:border-red-900/30">
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Something went wrong</h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <GlassButton
                      variant="outline"
                      onClick={fetchClaims}
                    >
                      Try Again
                    </GlassButton>
                  </div>
                </GlassCard>
              </FadeIn>
            )}

            {/* Stats Cards & Claims List */}
            {!isLoading && !error && (
              <>
                {/* Stats Cards */}
                <FadeIn delay={0.2}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <GlassCard className="text-center p-4">
                      <div className="text-2xl font-bold gradient-text">{claims.length}</div>
                      <div className="text-sm text-muted-foreground">Total Claims</div>
                    </GlassCard>
                    <GlassCard className="text-center p-4">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {claims.filter(c => c.status === 'pending' || c.status === 'under_review').length}
                      </div>
                      <div className="text-sm text-muted-foreground">In Progress</div>
                    </GlassCard>
                    <GlassCard className="text-center p-4">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {claims.filter(c => c.status === 'approved' || c.status === 'paid').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Approved</div>
                    </GlassCard>
                    <GlassCard className="text-center p-4">
                      <div className="text-2xl font-bold text-foreground">
                        ${claims.filter(c => c.status === 'approved' || c.status === 'paid').reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Recovered</div>
                    </GlassCard>
                  </div>
                </FadeIn>

                {/* Claims List */}
                <FadeIn delay={0.3}>
                  <GlassCard variant="bordered" className="overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground">Your Claims</h2>
                      {!isAdmin && (
                        <GlassButton
                          variant="primary"
                          size="sm"
                          onClick={handleNewClaimClick}
                          leftIcon={<FileText className="h-4 w-4" />}
                        >
                          File a Claim
                        </GlassButton>
                      )}
                      {isAdmin && (
                        <GlassBadge variant="default" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Admin — View Only
                        </GlassBadge>
                      )}
                    </div>
                    
                    {claims.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Claims Filed</h3>
                        <p className="text-muted-foreground mb-2">
                          {userType === 'customer' 
                            ? "You haven't filed any insurance claims yet."
                            : "No provider claims have been filed yet."}
                        </p>
                        {isUpgradeAvailable && (
                          <p className="text-sm text-primary mb-4">
                            You're on the Basic plan — claims are limited to ${planInfo?.maxClaimAmount.toLocaleString()}. 
                            <button 
                              onClick={() => onNavigate?.('safety')}
                              className="underline hover:no-underline ml-1"
                            >
                              Upgrade for better coverage
                            </button>
                          </p>
                        )}
                        {!isUpgradeAvailable && <div className="mb-4" />}
                        {!isAdmin && (
                          <GlassButton
                            variant="primary"
                            onClick={handleNewClaimClick}
                            leftIcon={<FileText className="h-4 w-4" />}
                          >
                            File a Claim
                          </GlassButton>
                        )}
                        {isAdmin && (
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            Admin accounts cannot file claims.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {claims.map((claim) => (
                          <motion.div
                            key={claim.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => setSelectedClaim(claim)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  'w-10 h-10 rounded-lg flex items-center justify-center',
                                  claim.status === 'approved' || claim.status === 'paid' 
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : claim.status === 'rejected'
                                    ? 'bg-red-100 dark:bg-red-900/30'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30'
                                )}>
                                  {claim.status === 'approved' || claim.status === 'paid' ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : claim.status === 'rejected' ? (
                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  ) : (
                                    <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{claim.id}</span>
                                    <GlassBadge className={cn('text-xs', statusColors[claim.status])}>
                                      {statusLabels[claim.status]}
                                    </GlassBadge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {claim.type} • {userType === 'customer' ? claim.businessName : claim.customerName}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-foreground">${claim.amount}</div>
                                <div className="text-xs text-muted-foreground">{claim.createdAt}</div>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {claim.description}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </FadeIn>
              </>
            )}

            {/* Coverage Information — Now plan-aware */}
            <FadeIn delay={0.4} className="mt-8">
              <GlassCard variant="elevated" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Your Coverage
                  </h2>
                  {isUpgradeAvailable && (
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate?.('safety')}
                      leftIcon={<Sparkles className="h-3 w-3" />}
                    >
                      Upgrade
                    </GlassButton>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">What's Covered</h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                        Service quality disputes
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                        Provider no-shows
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                        Billing errors
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                        Safety concerns
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Your Plan Limits</h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Up to ${planInfo?.maxClaimAmount.toLocaleString() || '500'} per incident
                      </li>
                      <li className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        {planInfo?.maxClaimsPerMonth || 5} claims per month
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        File within 7 days of incident
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Processing Time</h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Initial review: {planInfo?.reviewTime || '48 hours'}
                      </li>
                      <li className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        Processing: {planInfo?.processingTime || '7 days'}
                      </li>
                      <li className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Payout: 3-5 business days
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Upgrade CTA for basic users */}
                {isUpgradeAvailable && (
                  <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/15 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground text-sm">Need higher coverage?</h4>
                      <p className="text-sm text-muted-foreground">
                        Upgrade to Enhanced ($4.99/mo) for $2,000/claim or Premium ($9.99/mo) for unlimited coverage and same-day processing.
                      </p>
                    </div>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate?.('safety')}
                      rightIcon={<ArrowRight className="h-4 w-4" />}
                    >
                      View Plans
                    </GlassButton>
                  </div>
                )}
              </GlassCard>
            </FadeIn>

            {/* Contact Support */}
            <FadeIn delay={0.5} className="mt-8">
              <div className="text-center">
                <p className="text-muted-foreground mb-3">Need help with your claim?</p>
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <a 
                    href="mailto:claims@styra.app" 
                    className="flex items-center gap-2 text-primary hover:underline transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    claims@styra.app
                  </a>
                  <a 
                    href="tel:+254712345678" 
                    className="flex items-center gap-2 text-primary hover:underline transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    +254 712 345 678
                  </a>
                </div>
              </div>
            </FadeIn>
          </>
        )}
      </div>

      {/* New Claim Modal */}
      <GlassModal
        isOpen={showNewClaimModal}
        onClose={() => {
          setShowNewClaimModal(false);
          setSubmitStatus('idle');
        }}
        title="File a New Claim"
        description={
          userType === 'customer' 
            ? 'Submit a claim for a service issue or dispute'
            : 'Submit a claim for provider-related issues'
        }
        size="lg"
      >
        <form onSubmit={handleSubmitClaim} className="space-y-4">
          {/* Status Messages */}
          <AnimatePresence>
            {submitStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3"
              >
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">Claim submitted successfully!</p>
                  <p className="text-sm text-green-600 dark:text-green-500">We'll review your claim within {planInfo?.reviewTime || '48 hours'}.</p>
                </div>
              </motion.div>
            )}
            {submitStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
              >
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Submission failed</p>
                  <p className="text-sm text-red-600 dark:text-red-500">Please check your inputs and try again.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Plan limit reminder for basic users */}
          {isUpgradeAvailable && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">Basic Plan Limits</p>
                <p className="text-amber-600/80 dark:text-amber-500/80">
                  Your claim is limited to ${planInfo?.maxClaimAmount.toLocaleString() || '500'} on the Basic plan. 
                  <button 
                    type="button"
                    onClick={() => { setShowNewClaimModal(false); onNavigate?.('safety'); }}
                    className="underline hover:no-underline ml-1"
                  >
                    Upgrade your plan
                  </button> for higher limits.
                </p>
              </div>
            </div>
          )}

          {/* Claim Type */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Claim Type *</label>
            <select
              value={newClaim.type}
              onChange={(e) => setNewClaim(prev => ({ ...prev, type: e.target.value }))}
              required
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select claim type</option>
              {claimTypes[userType].map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Booking ID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Booking ID (if applicable)</label>
            <GlassInput
              placeholder="e.g., BK-12345"
              value={newClaim.bookingId}
              onChange={(e) => setNewClaim(prev => ({ ...prev, bookingId: e.target.value }))}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Claim Amount ($) * 
              <span className="text-xs text-muted-foreground font-normal ml-2">
                Max: ${planInfo?.maxClaimAmount.toLocaleString() || '500'}
              </span>
            </label>
            <GlassInput
              type="number"
              placeholder="0.00"
              value={newClaim.amount}
              onChange={(e) => setNewClaim(prev => ({ ...prev, amount: e.target.value }))}
              required
              max={planInfo?.maxClaimAmount || 500}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Description *</label>
            <textarea
              placeholder="Please describe your issue in detail..."
              value={newClaim.description}
              onChange={(e) => setNewClaim(prev => ({ ...prev, description: e.target.value }))}
              required
              minLength={50}
              className="w-full min-h-[120px] p-4 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">Minimum 50 characters</p>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Attachments (optional)</label>
            <div className="border-2 border-dashed border-input rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="claim-attachments"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="claim-attachments" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop files or <span className="text-primary">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Images or PDFs, max 5MB each</p>
              </label>
            </div>
            {newClaim.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {newClaim.attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setShowNewClaimModal(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={submitStatus === 'success' || isSubmitting}
              rightIcon={isSubmitting ? undefined : <Send className="h-4 w-4" />}
              isLoading={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Claim'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Claim Detail Modal */}
      <GlassModal
        isOpen={!!selectedClaim}
        onClose={() => setSelectedClaim(null)}
        title={`Claim ${selectedClaim?.id}`}
        description={selectedClaim?.type}
        size="lg"
      >
        {selectedClaim && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  statusColors[selectedClaim.status]
                )}>
                  {selectedClaim.status === 'approved' || selectedClaim.status === 'paid' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : selectedClaim.status === 'rejected' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{statusLabels[selectedClaim.status]}</p>
                  <p className="text-xs text-muted-foreground">Last updated: {selectedClaim.updatedAt}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">${selectedClaim.amount}</p>
                <p className="text-xs text-muted-foreground">Claimed amount</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <p className="text-sm text-foreground mt-1">{selectedClaim.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Created</label>
                  <p className="text-sm text-foreground mt-1">{selectedClaim.createdAt}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {userType === 'customer' ? 'Business' : 'Customer'}
                  </label>
                  <p className="text-sm text-foreground mt-1">
                    {userType === 'customer' ? selectedClaim.businessName : selectedClaim.customerName}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Claim Timeline</h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Claim Submitted</p>
                    <p className="text-xs text-muted-foreground">{selectedClaim.createdAt}</p>
                  </div>
                </div>
                {selectedClaim.status !== 'pending' && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Under Review</p>
                      <p className="text-xs text-muted-foreground">Expected resolution: {planInfo?.processingTime || '7 days'}</p>
                    </div>
                  </div>
                )}
                {(selectedClaim.status === 'approved' || selectedClaim.status === 'paid') && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Approved</p>
                      <p className="text-xs text-muted-foreground">Your claim has been approved</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-border">
              <GlassButton
                variant="ghost"
                onClick={() => setSelectedClaim(null)}
              >
                Close
              </GlassButton>
              <GlassButton
                variant="outline"
                leftIcon={<MessageSquare className="h-4 w-4" />}
                onClick={() => {
                  setSelectedClaim(null);
                  onNavigate?.('support');
                }}
              >
                Contact Support
              </GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
};

export default InsuranceClaimsPage;
