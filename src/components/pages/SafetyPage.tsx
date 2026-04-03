'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  Eye,
  UserCheck,
  FileWarning,
  HeartHandshake,
  Lock,
  Phone,
  BadgeCheck,
  Building2,
  Users,
  MessageSquare,
  Ban,
  FileText,
  Umbrella,
  X,
  Send,
  UserX,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  Clock,
  DollarSign,
  Star,
  LogIn,
  ChevronRight
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GradientText,
  FadeIn,
  GlassBadge
} from '@/components/ui/custom/glass-components';
import { useAuthStore } from '@/store';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';

interface SafetyPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

interface BlockedUserItem {
  id: string;
  blockedId: string;
  reason: string | null;
  createdAt: Date;
  blockedUser: {
    id: string;
    name: string | null;
    avatar: string | null;
    email: string | null;
  } | null;
}

const verificationSteps = [
  {
    icon: UserCheck,
    title: 'Identity Verification',
    description: 'All service providers undergo identity verification using government-issued ID.',
  },
  {
    icon: BadgeCheck,
    title: 'License Verification',
    description: 'We verify professional licenses and certifications for regulated services.',
  },
  {
    icon: Building2,
    title: 'Business Verification',
    description: 'Business addresses and registration documents are verified.',
  },
  {
    icon: Eye,
    title: 'Background Checks',
    description: 'Criminal background checks are conducted for all service providers.',
  },
];

const safetyGuidelines = [
  {
    icon: CheckCircle2,
    title: 'Verified Providers Only',
    description: 'Only book with providers who have completed our verification process. Look for the verified badge.',
  },
  {
    icon: MessageSquare,
    title: 'Communicate Through Platform',
    description: 'Keep all communication on our platform for your protection. We can assist if issues arise.',
  },
  {
    icon: Lock,
    title: 'Secure Payments',
    description: 'Never pay outside the platform. All payments are protected and traceable.',
  },
  {
    icon: Users,
    title: 'Check Reviews',
    description: 'Read reviews from other customers before booking. Look for consistent positive feedback.',
  },
  {
    icon: Phone,
    title: 'Share Your Location',
    description: 'Consider sharing your appointment location with a friend or family member.',
  },
  {
    icon: AlertTriangle,
    title: 'Trust Your Instincts',
    description: 'If something feels wrong, cancel the appointment. Your safety comes first.',
  },
];

const reportCategories = [
  'Inappropriate behavior',
  'Service quality issues',
  'Safety concerns',
  'Harassment or discrimination',
  'Fraud or scam',
  'Privacy violation',
  'Other',
];

const blockReasons = [
  'Inappropriate messages',
  'Harassment',
  'No-show at appointment',
  'Unprofessional behavior',
  'Safety concerns',
  'Fraudulent activity',
  'Personal preference',
  'Other',
];

const insuranceFeatures = [
  {
    icon: HeartHandshake,
    title: 'Service Protection',
    description: 'Coverage for service-related issues up to $1,000 per incident.',
    details: [
      'Protection against unsatisfactory services',
      'Coverage for service cancellation by provider',
      'Reimbursement for damaged property during service',
      'Protection against overcharging',
    ],
  },
  {
    icon: Umbrella,
    title: 'Liability Coverage',
    description: 'Service providers carry professional liability insurance.',
    details: [
      'Up to $1M in liability coverage per provider',
      'Protection against bodily injury claims',
      'Property damage coverage during appointments',
      'Professional negligence protection',
    ],
  },
  {
    icon: FileText,
    title: 'Easy Claims',
    description: 'Simple claims process through our support team.',
    details: [
      '24/7 online claim submission',
      'Average response time under 48 hours',
      'Dedicated claims specialist assigned',
      'Transparent claim tracking',
    ],
  },
];

const protectionPlans = [
  {
    name: 'Basic Protection',
    price: 'Free',
    features: [
      'Standard service protection up to $500',
      'Basic liability coverage',
      'Email support for claims',
      '7-day claim processing',
    ],
  },
  {
    name: 'Enhanced Protection',
    price: '$4.99/mo',
    features: [
      'Service protection up to $2,000',
      'Enhanced liability coverage',
      'Priority support with live chat',
      '48-hour claim processing',
      'Refund guarantee for canceled appointments',
    ],
    featured: true,
  },
  {
    name: 'Premium Protection',
    price: '$9.99/mo',
    features: [
      'Unlimited service protection',
      'Premium liability coverage up to $5M',
      '24/7 dedicated support hotline',
      'Same-day claim processing',
      'Full refund guarantee',
      'Legal assistance coverage',
    ],
  },
];

export const SafetyPage: React.FC<SafetyPageProps> = ({ onBack, onNavigate }) => {
  const { user, isAuthenticated } = useAuthStore();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showBlockUserModal, setShowBlockUserModal] = useState(false);
  const [showProtectionModal, setShowProtectionModal] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState<'report' | 'block'>('report');
  const [selectedPlan, setSelectedPlan] = useState<typeof protectionPlans[0] | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [reportForm, setReportForm] = useState({
    category: '',
    description: '',
    userId: '',
    date: '',
  });
  const [blockForm, setBlockForm] = useState({
    userId: '',
    reason: '',
    customReason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Handle protection plan selection
  const handlePlanSelect = (plan: typeof protectionPlans[0]) => {
    if (plan.price === 'Free') {
      return; // Already on free plan
    }
    
    if (!isAuthenticated) {
      setSelectedPlan(plan);
      setShowProtectionModal(true);
      return;
    }
    
    setSelectedPlan(plan);
    setShowProtectionModal(true);
  };

  // Handle protection plan upgrade
  const handlePlanUpgrade = () => {
    if (!isAuthenticated) {
      setShowProtectionModal(false);
      onNavigate?.('login');
      return;
    }
    
    // For authenticated users, navigate to payment
    setShowProtectionModal(false);
    onNavigate?.('payment');
  };

  // Fetch blocked users from database
  const fetchBlockedUsers = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingBlocked(true);
    try {
      const response = await fetch(`/api/blocked-users?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data.blockedUsers || []);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    } finally {
      setIsLoadingBlocked(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchBlockedUsers();
    }
  }, [isAuthenticated, user?.id, fetchBlockedUsers]);

  // Handle report submission
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'REPORT',
          category: reportForm.category,
          message: reportForm.description,
          userId: user?.id,
          metadata: JSON.stringify({
            reportedUserId: reportForm.userId,
            incidentDate: reportForm.date,
          }),
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setReportForm({ category: '', description: '', userId: '', date: '' });
        setTimeout(() => {
          setShowReportModal(false);
          setSubmitStatus('idle');
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle block user submission
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !blockForm.userId) return;
    
    const finalReason = blockForm.reason === 'Other' ? blockForm.customReason : blockForm.reason;
    if (!finalReason.trim()) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Block the user
      const blockResponse = await fetch('/api/blocked-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          blockedId: blockForm.userId,
          reason: finalReason,
        }),
      });

      if (blockResponse.ok) {
        // Notify admin about the block
        await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'REPORT',
            category: 'User Blocked',
            message: `User ${user.name || user.email} blocked user ${blockForm.userId}. Reason: ${finalReason}`,
            userId: user.id,
            metadata: JSON.stringify({
              blockAction: true,
              blockedUserId: blockForm.userId,
              reason: finalReason,
            }),
          }),
        });

        setSubmitStatus('success');
        setBlockForm({ userId: '', reason: '', customReason: '' });
        fetchBlockedUsers();
        setTimeout(() => {
          setShowBlockUserModal(false);
          setSubmitStatus('idle');
        }, 2000);
      } else {
        const errorData = await blockResponse.json();
        console.error('Block failed:', errorData);
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Block error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle unblock user
  const handleUnblock = async (blockedId: string) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch('/api/blocked-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          blockedId,
        }),
      });

      if (response.ok) {
        setBlockedUsers(prev => prev.filter(u => u.blockedId !== blockedId));
      }
    } catch (error) {
      console.error('Unblock error:', error);
    }
  };

  // Auth-protected action handlers
  const handleReportClick = () => {
    if (!isAuthenticated) {
      setAuthPromptAction('report');
      setShowAuthPrompt(true);
      return;
    }
    setShowReportModal(true);
  };

  const handleBlockClick = () => {
    if (!isAuthenticated) {
      setAuthPromptAction('block');
      setShowAuthPrompt(true);
      return;
    }
    setShowBlockUserModal(true);
  };

  const handleManageBlockedClick = () => {
    if (!isAuthenticated) {
      setAuthPromptAction('block');
      setShowAuthPrompt(true);
      return;
    }
    setShowBlockedModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <motion.div 
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Shield className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold mb-4">
            Your Safety Is Our <GradientText>Priority</GradientText>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            We&apos;ve built multiple layers of protection to ensure every Styra experience 
            is safe, secure, and trustworthy.
          </p>
        </FadeIn>

        {/* Trust & Verification */}
        <FadeIn delay={0.1}>
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Trust & Verification</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {verificationSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard hover glow className="text-center h-full">
                    <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <step.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Safety Guidelines */}
        <FadeIn delay={0.2}>
          <GlassCard variant="bordered" className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">Safety Guidelines</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safetyGuidelines.map((guideline, index) => (
                <motion.div
                  key={guideline.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-4 p-3 rounded-xl hover:bg-surface/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <guideline.icon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{guideline.title}</h3>
                    <p className="text-sm text-muted-foreground">{guideline.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>

        {/* Reporting System */}
        <FadeIn delay={0.3}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <GlassCard variant="elevated" glow className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <FileWarning className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-xl font-semibold">Report an Issue</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  If you experience any safety issues or policy violations, report them immediately. 
                  Our trust and safety team reviews all reports within 24 hours.
                </p>
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Common Report Categories:</h4>
                  <div className="flex flex-wrap gap-2">
                    {reportCategories.slice(0, 4).map((category) => (
                      <GlassBadge key={category} variant="default">
                        {category}
                      </GlassBadge>
                    ))}
                  </div>
                </div>
                <GlassButton 
                  variant="primary" 
                  leftIcon={<AlertTriangle className="h-4 w-4" />}
                  onClick={handleReportClick}
                  className="w-full sm:w-auto"
                >
                  File a Report
                </GlassButton>
              </div>
            </GlassCard>

            <GlassCard variant="elevated" glow className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Ban className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="text-xl font-semibold">Block a User</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  You can block any user from contacting you or booking appointments. 
                  Blocked users won&apos;t be able to see your profile or interact with you.
                </p>
                <ul className="space-y-2 mb-4 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Reason required for blocking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Admin notified for serious concerns
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    You can unblock at any time
                  </li>
                </ul>
                <div className="flex flex-wrap gap-3">
                  <GlassButton 
                    variant="primary"
                    onClick={handleBlockClick}
                  >
                    Block a User
                  </GlassButton>
                  <GlassButton 
                    variant="outline"
                    onClick={handleManageBlockedClick}
                  >
                    Manage Blocked ({blockedUsers.length})
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          </div>
        </FadeIn>

        {/* Insurance & Protection */}
        <FadeIn delay={0.4}>
          <GlassCard variant="gradient" glow className="mb-12 overflow-hidden" hover={false}>
            {/* Subtle gradient accent overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/8 pointer-events-none z-0" />
            <div className="relative z-10 p-6 md:p-8">
              <div className="text-center mb-8">
                <motion.div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Star className="h-4 w-4 text-primary-light" />
                  <span className="text-foreground text-sm font-medium">Protected by Styra</span>
                </motion.div>
                <h2 className="text-3xl font-bold mb-2">
                  <GradientText>Insurance & Protection</GradientText>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  We&apos;ve partnered with leading insurance providers to protect both customers and service providers.
                </p>
              </div>

              {/* Insurance Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {insuranceFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass-button rounded-2xl p-6 border border-white/10 hover:border-white/15 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mb-4">
                      <feature.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="font-semibold text-foreground text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                    <ul className="space-y-2">
                      {feature.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>

              {/* Protection Plans */}
              <div className="rounded-2xl p-6 border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
                <h3 className="text-xl font-semibold mb-6 text-center">Choose Your Protection Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {protectionPlans.map((plan, index) => (
                    <motion.div
                      key={plan.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative rounded-2xl p-6 border transition-all duration-300 text-foreground ${
                        plan.featured 
                          ? 'gradient-border bg-white/[0.04] hover:bg-white/[0.07] border-primary/30'
                          : 'bg-surface/40 border-border/50 hover:bg-surface/60 hover:border-border'
                      }`}
                    >
                      {plan.featured && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 gradient-bg rounded-full text-xs font-medium text-white shadow-glow-sm">
                          Most Popular
                        </div>
                      )}
                      <h4 className="font-semibold text-foreground text-lg mb-1">{plan.name}</h4>
                      <p className={`text-2xl font-bold mb-4 ${plan.featured ? 'gradient-text' : 'text-foreground'}`}>{plan.price}</p>
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <GlassButton 
                        variant={plan.featured ? 'primary' : 'outline'}
                        className="w-full text-foreground"
                        onClick={() => handlePlanSelect(plan)}
                      >
                        {plan.price === 'Free' ? 'Current Plan' : 'Upgrade'}
                      </GlassButton>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Link to Claims Page */}
        <FadeIn delay={0.42}>
          <div className="flex justify-center mb-12">
            <GlassButton 
              variant="outline" 
              onClick={() => onNavigate?.('insurance-claims')}
              rightIcon={<ChevronRight className="h-4 w-4" />}
              className="text-foreground"
            >
              Already have an issue? File an Insurance Claim
            </GlassButton>
          </div>
        </FadeIn>

        {/* Additional Insurance Info */}
        <FadeIn delay={0.45}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <GlassCard hover className="text-center" onClick={() => onNavigate?.('insurance-claims')}>
              <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4">
                <Clock className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Quick Claim Resolution</h3>
              <p className="text-sm text-muted-foreground">
                Most claims are processed within 48 hours. Our dedicated team ensures fair and fast resolution.
              </p>
            </GlassCard>
            <GlassCard hover className="text-center">
              <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Refund Guarantee</h3>
              <p className="text-sm text-muted-foreground">
                Not satisfied with your service? Get a full or partial refund based on our satisfaction policy.
              </p>
            </GlassCard>
            <GlassCard hover className="text-center">
              <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4">
                <FileCheck className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Documentation Support</h3>
              <p className="text-sm text-muted-foreground">
                We help you gather and submit all necessary documentation for claims and disputes.
              </p>
            </GlassCard>
          </div>
        </FadeIn>

        {/* Safety Promise */}
        <FadeIn delay={0.5}>
          <GlassCard glow className="mb-12">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <motion.div 
                className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center flex-shrink-0 shadow-glow"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Shield className="h-8 w-8 text-white" />
              </motion.div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Our Safety Promise</h2>
                <p className="text-muted-foreground mb-4">
                  At Styra, your safety is not just a policy—it&apos;s our promise. We continuously 
                  invest in security measures, verification processes, and support systems to ensure 
                  you can book with confidence.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium">24/7 Safety Support</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium">Zero Tolerance Policy</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium">Full Refund Guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Emergency Contact */}
        <FadeIn delay={0.6}>
          <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-600 dark:text-red-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">For Immediate Safety Concerns</h3>
            <p className="text-muted-foreground mb-4">
              Contact our 24/7 safety hotline for urgent assistance
            </p>
            <a 
              href="tel:+254712345678" 
              className="inline-flex items-center gap-2 text-2xl font-bold gradient-text hover:opacity-80 transition-opacity"
            >
              <Phone className="h-6 w-6" />
              +254 712 345 678
            </a>
          </div>
        </FadeIn>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-modal rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-red-500/5 to-orange-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">File a Report</h2>
                    <p className="text-xs text-muted-foreground">All reports are reviewed within 24 hours</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {submitStatus === 'success' ? (
                  <div className="text-center py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </motion.div>
                    <h3 className="text-lg font-semibold mb-2">Report Submitted</h3>
                    <p className="text-muted-foreground">
                      Our safety team will review your report within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleReportSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category *</label>
                      <select
                        value={reportForm.category}
                        onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                        className="w-full p-3 rounded-xl border border-input bg-surface/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      >
                        <option value="">Select a category</option>
                        {reportCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">User ID (if known)</label>
                      <GlassInput
                        placeholder="Enter user ID or leave blank"
                        value={reportForm.userId}
                        onChange={(e) => setReportForm({ ...reportForm, userId: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Date of Incident</label>
                      <GlassInput
                        type="date"
                        value={reportForm.date}
                        onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description *</label>
                      <textarea
                        placeholder="Please describe what happened in detail..."
                        value={reportForm.description}
                        onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                        className="w-full min-h-[120px] p-3 rounded-xl border border-input bg-surface/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        required
                      />
                    </div>

                    {submitStatus === 'error' && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Failed to submit report. Please try again.</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <GlassButton
                        variant="ghost"
                        type="button"
                        onClick={() => setShowReportModal(false)}
                      >
                        Cancel
                      </GlassButton>
                      <GlassButton
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                        rightIcon={<Send className="h-4 w-4" />}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                      </GlassButton>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block User Modal */}
      <AnimatePresence>
        {showBlockUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBlockUserModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-modal rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-orange-500/5 to-red-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Ban className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Block a User</h2>
                    <p className="text-xs text-muted-foreground">A reason is required for all blocks</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlockUserModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {submitStatus === 'success' ? (
                  <div className="text-center py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </motion.div>
                    <h3 className="text-lg font-semibold mb-2">User Blocked</h3>
                    <p className="text-muted-foreground">
                      The user has been blocked and admin has been notified.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleBlockSubmit} className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-700 dark:text-amber-400">Important</p>
                        <p className="text-amber-600/80 dark:text-amber-500/80">Blocking a user will prevent them from contacting you or booking appointments. Admin will be notified for serious concerns.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">User ID to Block *</label>
                      <GlassInput
                        placeholder="Enter the user ID you want to block"
                        value={blockForm.userId}
                        onChange={(e) => setBlockForm({ ...blockForm, userId: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Reason for Blocking *</label>
                      <select
                        value={blockForm.reason}
                        onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                        className="w-full p-3 rounded-xl border border-input bg-surface/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      >
                        <option value="">Select a reason</option>
                        {blockReasons.map((reason) => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                    </div>

                    {blockForm.reason === 'Other' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Please Specify *</label>
                        <textarea
                          placeholder="Please describe your reason..."
                          value={blockForm.customReason}
                          onChange={(e) => setBlockForm({ ...blockForm, customReason: e.target.value })}
                          className="w-full min-h-[80px] p-3 rounded-xl border border-input bg-surface/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                          required
                        />
                      </div>
                    )}

                    {submitStatus === 'error' && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Failed to block user. Please ensure all fields are filled.</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <GlassButton
                        variant="ghost"
                        type="button"
                        onClick={() => setShowBlockUserModal(false)}
                      >
                        Cancel
                      </GlassButton>
                      <GlassButton
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                        rightIcon={<Ban className="h-4 w-4" />}
                      >
                        {isSubmitting ? 'Blocking...' : 'Block User'}
                      </GlassButton>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked Users Modal */}
      <AnimatePresence>
        {showBlockedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBlockedModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-modal rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-slate-500/5 to-slate-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 flex items-center justify-center">
                    <UserX className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Blocked Users</h2>
                    <p className="text-xs text-muted-foreground">{blockedUsers.length} users blocked</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlockedModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                {isLoadingBlocked ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Ban className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Blocked Users</h3>
                    <p className="text-muted-foreground text-sm">
                      You haven&apos;t blocked any users yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((block) => (
                      <motion.div
                        key={block.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors bg-surface/30"
                      >
                        <img
                          src={block.blockedUser?.avatar || `https://ui-avatars.com/api/?name=${block.blockedUser?.name || 'User'}&background=6C4EFF&color=fff`}
                          alt={block.blockedUser?.name || 'User'}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{block.blockedUser?.name || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {block.reason || 'No reason provided'}
                          </p>
                        </div>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnblock(block.blockedId)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Unblock
                        </GlassButton>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border/50 bg-muted/20">
                <p className="text-xs text-muted-foreground text-center">
                  Blocked users cannot see your profile or book appointments with you.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Protection Plan Modal */}
      <AnimatePresence>
        {showProtectionModal && selectedPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowProtectionModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-modal rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-primary/5 to-secondary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Upgrade Protection</h2>
                    <p className="text-xs text-muted-foreground">{selectedPlan.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProtectionModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {!isAuthenticated ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <LogIn className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
                    <p className="text-muted-foreground mb-4">
                      Create an account or sign in to upgrade your protection plan.
                    </p>
                    <div className="flex flex-col gap-3">
                      <GlassButton 
                        variant="primary" 
                        className="w-full"
                        onClick={() => handlePlanUpgrade()}
                        leftIcon={<LogIn className="h-4 w-4" />}
                      >
                        Sign In / Sign Up
                      </GlassButton>
                      <GlassButton 
                        variant="ghost" 
                        className="w-full"
                        onClick={() => setShowProtectionModal(false)}
                      >
                        Maybe Later
                      </GlassButton>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{selectedPlan.name}</span>
                        <span className="text-2xl font-bold gradient-text">{selectedPlan.price}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedPlan.features[0]}</p>
                    </div>
                    
                    <h4 className="font-medium mb-3">What&apos;s included:</h4>
                    <ul className="space-y-2 mb-6">
                      {selectedPlan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex gap-3">
                      <GlassButton
                        variant="ghost"
                        className="flex-1"
                        onClick={() => setShowProtectionModal(false)}
                      >
                        Cancel
                      </GlassButton>
                      <GlassButton
                        variant="primary"
                        className="flex-1"
                        onClick={handlePlanUpgrade}
                        rightIcon={<ChevronRight className="h-4 w-4" />}
                      >
                        Proceed to Payment
                      </GlassButton>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action={authPromptAction}
        onSignIn={() => {
          setShowAuthPrompt(false);
          onNavigate?.('login');
        }}
        onSignUp={() => {
          setShowAuthPrompt(false);
          onNavigate?.('register');
        }}
      />

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(108, 78, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(108, 78, 255, 0.3);
        }
      `}</style>
    </div>
  );
};

export default SafetyPage;
