'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Megaphone, 
  Target, 
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Building2,
  Globe,
  BarChart3,
  Zap,
  Star,
  CheckCircle,
  X,
  ChevronRight,
  LogIn,
  CreditCard,
  Wallet,
  Smartphone,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/store';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GradientText,
  FadeIn,
  GlassBadge
} from '@/components/ui/custom/glass-components';
import { toast } from 'sonner';

interface AdvertisePageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

// Payment method types
type PaymentMethodType = 'card' | 'paypal' | 'mpesa';

// Liquid Glass Modal Component - defined outside main component
const LiquidGlassModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ isOpen, onClose, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        
        {/* Modal Content - Liquid Glass Style */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`relative w-full ${sizeClasses[size]} rounded-2xl shadow-2xl overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Liquid glass base layer */}
          <div className="absolute inset-0 glass-modal rounded-2xl" />
          
          {/* Glass reflection */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/3 dark:from-white/10 rounded-t-2xl" />
          
          {/* Outer glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-3xl blur-xl opacity-50" />
          
          {/* Content */}
          <div className="relative z-10 text-foreground">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const audienceStats = [
  { value: '500K+', label: 'Monthly Active Users', icon: Users },
  { value: '50K+', label: 'Daily Bookings', icon: ShoppingCart },
  { value: '25-45', label: 'Primary Age Group', icon: Target },
  { value: '85%', label: 'Mobile Users', icon: Globe },
];

const adOptions = [
  {
    id: 'featured',
    name: 'Featured Listing',
    description: 'Appear at the top of search results in your category. Perfect for businesses looking to increase visibility.',
    shortDescription: 'Top search placement for your business',
    price: '$199/month',
    priceValue: 199,
    icon: Star,
    color: '#6C4EFF',
    features: [
      'Top placement in search results',
      'Featured badge on profile',
      'Priority in map view',
      'Basic analytics dashboard',
      'Email support',
    ],
    highlighted_feature: '3x more profile views',
    popular: false,
  },
  {
    id: 'premium',
    name: 'Premium Package',
    description: 'Maximum visibility with banner ads, featured placement, and dedicated support. Best value for growing businesses.',
    shortDescription: 'Full-suite advertising solution',
    price: '$399/month',
    priceValue: 399,
    icon: Crown,
    color: '#3ABEFF',
    features: [
      'Everything in Featured Listing',
      'Banner ads on homepage',
      'Sponsored content opportunities',
      'Advanced analytics & reporting',
      'A/B testing for ads',
      'Dedicated account manager',
      'Priority support',
    ],
    highlighted_feature: '5x average ROI',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Solutions',
    description: 'Custom advertising solutions for large brands with multi-location support and dedicated campaign management.',
    shortDescription: 'Tailored for large organizations',
    price: 'Custom Pricing',
    priceValue: 0,
    icon: Rocket,
    color: '#10b981',
    features: [
      'Everything in Premium Package',
      'Custom campaign development',
      'Cross-platform promotion',
      'API integration',
      'Custom reporting',
      'Marketing consultation',
      'Multi-location support',
    ],
    highlighted_feature: 'Unlimited potential',
    popular: false,
  },
];

const advertisingFormats = [
  {
    icon: BarChart3,
    title: 'Search Ads',
    description: 'Appear when customers search for services you offer',
    stats: '15% avg. CTR',
    color: '#6C4EFF',
  },
  {
    icon: Eye,
    title: 'Profile Boost',
    description: 'Enhanced visibility for your business profile',
    stats: '3x more views',
    color: '#3ABEFF',
  },
  {
    icon: Zap,
    title: 'Sponsored Content',
    description: 'Featured articles and blog posts about your services',
    stats: '8% engagement',
    color: '#10b981',
  },
  {
    icon: Star,
    title: 'Promoted Reviews',
    description: 'Highlight your best reviews to attract customers',
    stats: '25% more bookings',
    color: '#f59e0b',
  },
];

const roiStats = [
  { label: 'Avg. Return on Investment', value: '3x', icon: DollarSign },
  { label: 'Average Click Rate', value: '15%', icon: MousePointer },
  { label: 'Conversion Rate', value: '8%', icon: ShoppingCart },
];

const successStories = [
  {
    business: 'Elite Cuts & Style',
    quote: 'Our bookings increased by 280% after switching to the Premium Package. Best investment we\'ve made!',
    owner: 'Marcus Williams',
    increase: '280%',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
    plan: 'Premium',
  },
  {
    business: 'Serenity Spa',
    quote: 'The ROI is incredible. We reached customers we never could have found on our own.',
    owner: 'Jennifer Chen',
    increase: '195%',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=50&h=50&fit=crop&crop=face',
    plan: 'Featured',
  },
];

// Import icons that are used but not imported yet
import { 
  Crown,
  Rocket,
  Eye,
  MousePointer,
  ShoppingCart
} from 'lucide-react';

export const AdvertisePage: React.FC<AdvertisePageProps> = ({ onBack, onNavigate }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  // Check if user is a provider
  const hasProviderRole = user?.roles?.includes('BUSINESS_OWNER') || user?.role === 'BUSINESS_OWNER';
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const selectedPlanData = adOptions.find(p => p.id === selectedPlan);

  const handleGetStarted = (planId: string) => {
    if (!isAuthenticated) {
      setSelectedPlan(planId);
      setShowSignInPrompt(true);
      return;
    }
    
    if (!hasProviderRole) {
      setSelectedPlan(planId);
      setShowOnboardingPrompt(true);
      return;
    }
    
    // Logged-in provider - go directly to payment
    setSelectedPlan(planId);
    setShowPaymentModal(true);
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16);
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  const isFormValid = () => {
    if (paymentMethod === 'card') {
      return (
        cardNumber.replace(/\s/g, '').length >= 15 &&
        expiry.length === 5 &&
        cvv.length >= 3 &&
        cardName.length >= 2 &&
        billingAddress.length >= 5
      );
    }
    return true;
  };

  const handlePayment = async () => {
    if (!isFormValid()) {
      toast.error('Please fill in all payment details');
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setIsProcessing(false);
    setShowPaymentModal(false);
    setShowSuccessModal(true);
    
    toast.success('Payment successful! Your advertising plan is now active.');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Liquid Glass Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <motion.div 
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Megaphone className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold mb-4">
            Advertise with <GradientText>Styra</GradientText>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Connect with millions of customers actively searching for grooming services. 
            Grow your business with targeted advertising.
          </p>
        </FadeIn>

        {/* Audience Stats */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {audienceStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <GlassCard 
                  variant="elevated" 
                  className="text-center relative overflow-hidden"
                  glow
                >
                  <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary-light" />
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Advertising Formats */}
        <FadeIn delay={0.2}>
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Advertising Formats</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {advertisingFormats.map((format, index) => (
                <motion.div
                  key={format.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard hover className="text-center h-full group relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${format.color}20` }}
                    >
                      <format.icon className="h-6 w-6" style={{ color: format.color }} />
                    </div>
                    <h3 className="font-semibold mb-2">{format.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{format.description}</p>
                    <GlassBadge variant="success" className="text-xs">
                      {format.stats}
                    </GlassBadge>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Pricing Packages */}
        <FadeIn delay={0.3}>
          <h2 className="text-2xl font-bold mb-6 text-center">Choose Your Package</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-stretch">
            {adOptions.map((option, index) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="h-full"
              >
                <GlassCard 
                  variant={option.popular ? 'gradient' : 'elevated'}
                  hover
                  glow={option.popular}
                  className={`h-full relative overflow-hidden flex flex-col ${selectedPlan === option.id ? 'ring-2 ring-primary' : ''}`}
                >
                  {option.popular && (
                    <div className="absolute top-0 right-0 z-20">
                      <div className="gradient-bg text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl flex items-center gap-1.5 shadow-glow-sm">
                        <Crown className="h-3 w-3" />
                        MOST POPULAR
                      </div>
                    </div>
                  )}


                  
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${option.color}15` }}
                      >
                        <option.icon 
                          className="h-6 w-6" 
                          style={{ color: option.color }} 
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold">
                          {option.name}
                        </h3>
                        <p className="text-xs truncate text-muted-foreground">
                          {option.shortDescription}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm mb-4 text-muted-foreground">
                      {option.description}
                    </p>

                    <div className="mb-4 p-4 rounded-xl backdrop-blur-sm bg-muted/30">
                      <div className="text-3xl font-bold gradient-text">
                        {option.price}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {option.priceValue > 0 ? 'billed monthly' : 'contact for pricing'}
                      </div>
                    </div>

                    <div className="mb-4 p-3 rounded-lg border bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">
                          {option.highlighted_feature}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-6 flex-grow">
                      {option.features.slice(0, 5).map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                          <span className="text-sm text-muted-foreground">
                            {feature}
                          </span>
                        </li>
                      ))}
                      {option.features.length > 5 && (
                        <li className="text-sm text-muted-foreground">
                          +{option.features.length - 5} more features
                        </li>
                      )}
                    </ul>

                    {/* Button at bottom */}
                    <GlassButton 
                      variant={option.popular ? 'primary' : 'outline'} 
                      className="w-full mt-auto"
                      onClick={() => handleGetStarted(option.id)}
                      rightIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      Get Started
                    </GlassButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* ROI Section */}
        <FadeIn delay={0.4}>
          <GlassCard variant="bordered" className="mb-12 relative overflow-hidden">
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute -left-10 -top-10 w-32 h-32 bg-secondary/5 rounded-full blur-2xl" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
              <div>
                <h2 className="text-2xl font-bold mb-4">Why Advertise with Us?</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/5 hover:bg-green-500/10 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Target className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Targeted Reach</h3>
                      <p className="text-sm text-muted-foreground">
                        Connect with customers actively searching for your services in your area
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/5 hover:bg-green-500/10 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">High ROI</h3>
                      <p className="text-sm text-muted-foreground">
                        Average advertisers see 3x return on their investment within 90 days
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/5 hover:bg-green-500/10 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Real-time Analytics</h3>
                      <p className="text-sm text-muted-foreground">
                        Track your campaign performance with detailed insights and reporting
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                  {roiStats.map((stat, index) => (
                    <motion.div 
                      key={stat.label} 
                      className="glass-card rounded-xl p-4 text-center hover:bg-[var(--glass-bg-hover)] transition-all duration-300"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Success Stories */}
        <FadeIn delay={0.45}>
          <h2 className="text-2xl font-bold mb-6 text-center">Success Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {successStories.map((story, index) => (
              <motion.div
                key={story.business}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover className="relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <GlassBadge variant="success" className="text-sm">+{story.increase} bookings</GlassBadge>
                    </div>
                    <div className="flex items-start gap-4 mb-4 pr-24">
                      <img
                        src={story.avatar}
                        alt={story.owner}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20"
                      />
                      <div>
                        <h3 className="font-semibold">{story.business}</h3>
                        <p className="text-sm text-muted-foreground">{story.owner}</p>
                        <GlassBadge variant="primary" className="mt-1 text-xs">{story.plan} Plan</GlassBadge>
                      </div>
                    </div>
                    <p className="text-muted-foreground italic relative">&ldquo;{story.quote}&rdquo;</p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Contact Info */}
        <FadeIn delay={0.6}>
          <div className="mt-8 text-center">
            <p className="text-muted-foreground mb-3">
              Prefer to talk? Reach our advertising team directly:
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a 
                href="mailto:ads@styra.app" 
                className="flex items-center gap-2 text-primary hover:underline hover:text-primary/80 transition-colors"
              >
                <Globe className="h-4 w-4" />
                ads@styra.app
              </a>
              <a 
                href="tel:+254712345678" 
                className="flex items-center gap-2 text-primary hover:underline hover:text-primary/80 transition-colors"
              >
                <Building2 className="h-4 w-4" />
                +254 712 345 678
              </a>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Sign In Prompt Modal */}
      <LiquidGlassModal
        isOpen={showSignInPrompt}
        onClose={() => setShowSignInPrompt(false)}
        size="md"
      >
        <div className="p-6">
          {/* Close button */}
          <button
            onClick={() => setShowSignInPrompt(false)}
            className="absolute right-4 top-4 rounded-lg p-1 hover:bg-muted transition-colors z-20"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground">
              You need to be signed in to subscribe to an advertising plan.
            </p>
          </div>
          
          {selectedPlanData && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border mb-6">
              <p className="text-sm text-muted-foreground">Selected Plan:</p>
              <p className="font-semibold">{selectedPlanData.name} - {selectedPlanData.price}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <GlassButton 
              variant="primary" 
              className="w-full"
              onClick={() => {
                setShowSignInPrompt(false);
                onNavigate?.('login');
              }}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Sign In / Sign Up
            </GlassButton>
            <GlassButton 
              variant="ghost" 
              className="w-full"
              onClick={() => setShowSignInPrompt(false)}
            >
              Maybe Later
            </GlassButton>
          </div>
        </div>
      </LiquidGlassModal>

      {/* Onboarding Prompt Modal */}
      <LiquidGlassModal
        isOpen={showOnboardingPrompt}
        onClose={() => setShowOnboardingPrompt(false)}
        size="md"
      >
        <div className="p-6">
          <button
            onClick={() => setShowOnboardingPrompt(false)}
            className="absolute right-4 top-4 rounded-lg p-1 hover:bg-muted transition-colors z-20"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Become a Partner</h2>
            <p className="text-muted-foreground">
              You need to register as a service provider to advertise on Styra.
            </p>
          </div>
          
          {selectedPlanData && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border mb-6">
              <p className="text-sm text-muted-foreground">Selected Plan:</p>
              <p className="font-semibold">{selectedPlanData.name} - {selectedPlanData.price}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <GlassButton 
              variant="primary" 
              className="w-full"
              onClick={() => {
                setShowOnboardingPrompt(false);
                onNavigate?.('onboarding');
              }}
              leftIcon={<Building2 className="h-4 w-4" />}
            >
              Start Onboarding
            </GlassButton>
            <GlassButton 
              variant="ghost" 
              className="w-full"
              onClick={() => setShowOnboardingPrompt(false)}
            >
              Maybe Later
            </GlassButton>
          </div>
        </div>
      </LiquidGlassModal>

      {/* Payment Modal */}
      <LiquidGlassModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        size="xl"
      >
        <div className="p-6">
          <button
            onClick={() => setShowPaymentModal(false)}
            className="absolute right-4 top-4 rounded-lg p-1 hover:bg-muted transition-colors z-20"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Complete Your Subscription</h2>
            <p className="text-muted-foreground">Subscribe to your advertising plan</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left - Plan Summary */}
            <div>
              {selectedPlanData && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${selectedPlanData.color}20` }}
                    >
                      <selectedPlanData.icon className="h-6 w-6" style={{ color: selectedPlanData.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedPlanData.name}</h3>
                      <p className="text-2xl font-bold gradient-text">{selectedPlanData.price}</p>
                    </div>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {selectedPlanData.features.slice(0, 3).map(feature => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Payment Summary */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <h4 className="font-medium mb-3">Payment Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subscription</span>
                    <span>{selectedPlanData?.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing cycle</span>
                    <span>Monthly</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-medium">Total due today</span>
                    <span className="text-xl font-bold gradient-text">{selectedPlanData?.price}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Payment Form */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Method
              </h4>

              {/* Payment Method Selection */}
              <div className="space-y-2 mb-4">
                {[
                  { type: 'card' as PaymentMethodType, icon: CreditCard, label: 'Card', color: 'from-blue-500 to-purple-600' },
                  { type: 'paypal' as PaymentMethodType, icon: Wallet, label: 'PayPal', color: 'from-[#0070ba] to-[#003087]' },
                  { type: 'mpesa' as PaymentMethodType, icon: Smartphone, label: 'M-Pesa', color: 'from-green-500 to-green-600' },
                ].map(({ type, icon: Icon, label, color }) => (
                  <button
                    key={type}
                    onClick={() => setPaymentMethod(type)}
                    className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                      paymentMethod === type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-10 h-6 rounded-lg bg-gradient-to-r ${color} flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium">{label}</span>
                    <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === type ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {paymentMethod === type && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                ))}
              </div>

              {/* Card Form */}
              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Card Number</label>
                    <GlassInput
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      leftIcon={<CreditCard className="h-4 w-4" />}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Expiry</label>
                      <GlassInput
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">CVV</label>
                      <GlassInput
                        type="password"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="•••"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cardholder Name</label>
                    <GlassInput
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      placeholder="JOHN DOE"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Billing Address</label>
                    <GlassInput
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="123 Main St, City, State"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'paypal' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    You will be redirected to PayPal to complete your payment securely.
                  </p>
                </div>
              )}

              {paymentMethod === 'mpesa' && (
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Enter your M-Pesa number on the next screen to receive a payment prompt.
                  </p>
                </div>
              )}

              {/* Security Notice */}
              <div className="flex items-center gap-2 mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <Lock className="h-4 w-4 text-primary" />
                <span>Secure payment with SSL encryption</span>
              </div>

              {/* Pay Button */}
              <GlassButton
                variant="primary"
                className="w-full mt-4"
                size="lg"
                onClick={handlePayment}
                disabled={!isFormValid()}
                isLoading={isProcessing}
              >
                {isProcessing ? 'Processing...' : `Subscribe ${selectedPlanData?.price}`}
              </GlassButton>
            </div>
          </div>
        </div>
      </LiquidGlassModal>

      {/* Success Modal */}
      <LiquidGlassModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        size="md"
      >
        <div className="p-6 text-center">
          <button
            onClick={() => setShowSuccessModal(false)}
            className="absolute right-4 top-4 rounded-lg p-1 hover:bg-muted transition-colors z-20"
          >
            <X className="h-5 w-5" />
          </button>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center mx-auto mb-4 shadow-glow"
          >
            <CheckCircle className="h-10 w-10 text-white" />
          </motion.div>

          <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
          <p className="text-muted-foreground mb-6">
            Your advertising plan is now active. Start reaching more customers today!
          </p>

          {selectedPlanData && (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 mb-6 text-left">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${selectedPlanData.color}20` }}
                >
                  <selectedPlanData.icon className="h-5 w-5" style={{ color: selectedPlanData.color }} />
                </div>
                <div>
                  <p className="font-semibold">{selectedPlanData.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlanData.price}/month</p>
                </div>
                <GlassBadge variant="success" className="ml-auto">Active</GlassBadge>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <GlassButton
              variant="outline"
              className="flex-1"
              onClick={() => setShowSuccessModal(false)}
            >
              Browse Ads
            </GlassButton>
            <GlassButton
              variant="primary"
              className="flex-1"
              onClick={() => {
                setShowSuccessModal(false);
                onNavigate?.('dashboard');
              }}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              View Dashboard
            </GlassButton>
          </div>
        </div>
      </LiquidGlassModal>
    </div>
  );
};

export default AdvertisePage;
