'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  Crown,
  Check,
  TrendingUp,
  Eye,
  MousePointer,
  Calendar,
  DollarSign,
  Zap,
  Share2,
  Mail,
  Target,
  Shield,
  Rocket,
  ChevronRight,
  Info,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================
// TYPES
// ============================================

export type PremiumTier = 'featured' | 'premium' | 'verified';

export interface PremiumBadgeProps {
  tier: PremiumTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export interface PromotedListingCardProps {
  id: string;
  name: string;
  category: string;
  image?: string;
  rating: number;
  reviewCount: number;
  description: string;
  tier: PremiumTier;
  sponsored?: boolean;
  onUpgrade?: () => void;
  onView?: () => void;
}

export interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: PremiumTier;
  onSelectTier?: (tier: PremiumTier) => void;
}

export interface MarketingBoostProps {
  onBoost?: (options: BoostOptions) => void;
  isActive?: boolean;
}

export interface BoostOptions {
  spotlight: boolean;
  socialMedia: boolean;
  emailBlast: boolean;
}

export interface AnalyticsPreviewProps {
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
  tier?: PremiumTier;
}

// ============================================
// PREMIUM BADGE COMPONENT
// ============================================

const tierConfig = {
  featured: {
    label: 'Featured',
    colors: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500',
    textColor: 'text-white',
    glowColor: 'shadow-amber-500/50',
    icon: Crown,
    bgOpacity: 'bg-amber-500/20',
    border: 'border-amber-400/50',
  },
  premium: {
    label: 'Premium',
    colors: 'bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500',
    textColor: 'text-white',
    glowColor: 'shadow-purple-500/50',
    icon: Crown,
    bgOpacity: 'bg-purple-500/20',
    border: 'border-purple-400/50',
  },
  verified: {
    label: 'Verified',
    colors: 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500',
    textColor: 'text-white',
    glowColor: 'shadow-emerald-500/50',
    icon: Shield,
    bgOpacity: 'bg-emerald-500/20',
    border: 'border-emerald-400/50',
  },
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-base gap-2',
};

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  tier,
  size = 'md',
  showLabel = true,
  className,
}) => {
  const config = tierConfig[tier];
  const Icon = config.icon;
  const isFeatured = tier === 'featured';

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center rounded-full font-semibold backdrop-blur-sm',
        'border shadow-lg',
        config.colors,
        config.textColor,
        sizes[size],
        isFeatured && 'animate-pulse-subtle',
        className
      )}
      style={isFeatured ? {
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.4), 0 0 40px rgba(245, 158, 11, 0.2)',
      } : undefined}
    >
      <Icon className={cn(
        size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
      )} />
      {showLabel && <span>{config.label}</span>}
      
      {/* Animated glow ring for featured */}
      {isFeatured && (
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(245, 158, 11, 0.4)',
              '0 0 0 8px rgba(245, 158, 11, 0)',
            ],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}
    </motion.span>
  );
};

// ============================================
// PROMOTED LISTING CARD COMPONENT
// ============================================

export const PromotedListingCard: React.FC<PromotedListingCardProps> = ({
  name,
  category,
  image,
  rating,
  reviewCount,
  description,
  tier,
  sponsored = false,
  onUpgrade,
  onView,
}) => {
  const config = tierConfig[tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl',
        'border-2 shadow-xl transition-all duration-300',
        config.border,
        sponsored && 'ring-2 ring-offset-2 ring-offset-transparent',
        tier === 'featured' && 'ring-amber-400/50',
        tier === 'premium' && 'ring-purple-400/50',
        tier === 'verified' && 'ring-emerald-400/50'
      )}
      style={tier === 'featured' ? {
        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15), 0 0 0 1px rgba(245, 158, 11, 0.1)',
      } : undefined}
    >
      {/* Sponsored Label */}
      {sponsored && (
        <div className="absolute top-3 left-3 z-10">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            'bg-gray-900/80 text-white backdrop-blur-sm'
          )}>
            <Zap className="h-3 w-3 text-yellow-400" />
            Sponsored
          </span>
        </div>
      )}

      {/* Tier Badge */}
      <div className="absolute top-3 right-3 z-10">
        <PremiumBadge tier={tier} size="sm" />
      </div>

      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <div className={cn(
          'absolute inset-0',
          'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800'
        )} />
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-4xl opacity-50">
              {category === 'Restaurant' ? '🍽️' : 
               category === 'Spa' ? '💆' : 
               category === 'Gym' ? '💪' : '🏪'}
            </span>
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg truncate">{name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{category}</p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-4 w-4',
                  i < Math.floor(rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                )}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {rating.toFixed(1)} ({reviewCount} reviews)
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
            onClick={onView}
          >
            View Details
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
          {tier !== 'featured' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUpgrade}
              className="border-amber-400/50 text-amber-600 hover:bg-amber-50"
            >
              <Crown className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Shimmer Effect for Featured */}
      {tier === 'featured' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute inset-0 -translate-x-full"
            animate={{ translateX: ['0%', '200%'] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// PREMIUM UPGRADE MODAL COMPONENT
// ============================================

const pricingTiers = [
  {
    id: 'verified' as PremiumTier,
    name: 'Verified',
    price: 9.99,
    description: 'Build trust with verification badge',
    features: [
      'Verification badge on profile',
      'Priority in search results',
      'Basic analytics dashboard',
      'Customer reviews display',
      'Contact form integration',
    ],
    icon: Shield,
    popular: false,
  },
  {
    id: 'premium' as PremiumTier,
    name: 'Premium',
    price: 19.99,
    description: 'Stand out with premium placement',
    features: [
      'Everything in Verified',
      'Premium badge with styling',
      'Top 3 placement in category',
      'Advanced analytics & insights',
      'Marketing boost credits (2/month)',
      'Priority customer support',
    ],
    icon: Crown,
    popular: true,
  },
  {
    id: 'featured' as PremiumTier,
    name: 'Featured',
    price: 39.99,
    description: 'Maximum visibility & exposure',
    features: [
      'Everything in Premium',
      'Featured badge with glow effect',
      'Homepage spotlight rotation',
      'Unlimited marketing boosts',
      'Custom promotional campaigns',
      'Dedicated account manager',
      'API access for integrations',
    ],
    icon: Crown,
    popular: false,
  },
];

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onSelectTier,
}) => {
  const [selectedTier, setSelectedTier] = React.useState<PremiumTier>(currentTier || 'premium');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleSelect = async () => {
    setIsProcessing(true);
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    onSelectTier?.(selectedTier);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Upgrade Your Listing
          </DialogTitle>
          <DialogDescription>
            Choose a plan that fits your business needs. Cancel anytime.
          </DialogDescription>
        </DialogHeader>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
          {pricingTiers.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selectedTier === tier.id;
            const config = tierConfig[tier.id];

            return (
              <motion.div
                key={tier.id}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedTier(tier.id)}
                className={cn(
                  'relative cursor-pointer rounded-2xl p-5 transition-all',
                  'bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl',
                  'border-2',
                  isSelected ? config.border : 'border-gray-200 dark:border-gray-700',
                  isSelected && 'shadow-lg',
                  tier.popular && 'ring-2 ring-primary/50'
                )}
                style={isSelected ? {
                  boxShadow: `0 8px 32px ${tier.id === 'featured' ? 'rgba(245, 158, 11, 0.2)' : tier.id === 'premium' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                } : undefined}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="text-center space-y-3 mb-4">
                  <div className={cn(
                    'inline-flex items-center justify-center w-12 h-12 rounded-full',
                    config.bgOpacity
                  )}>
                    <Icon className={cn('h-6 w-6', `text-${tier.id === 'featured' ? 'amber' : tier.id === 'premium' ? 'purple' : 'emerald'}-500`)} />
                  </div>
                  <h3 className="font-semibold text-lg">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Selection Indicator */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className={cn(
                    'flex items-center justify-center gap-2 py-2 rounded-lg',
                    isSelected ? config.bgOpacity : 'bg-gray-100 dark:bg-gray-800'
                  )}>
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Selected</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Click to select</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="rounded-xl bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Feature Comparison
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-4 font-medium">Feature</th>
                  <th className="text-center p-4 font-medium">Verified</th>
                  <th className="text-center p-4 font-medium">Premium</th>
                  <th className="text-center p-4 font-medium">Featured</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Visibility Boost', v: '2x', p: '5x', f: '10x' },
                  { feature: 'Search Priority', v: 'Standard', p: 'High', f: 'Top' },
                  { feature: 'Analytics', v: 'Basic', p: 'Advanced', f: 'Enterprise' },
                  { feature: 'Marketing Credits', v: '—', p: '2/month', f: 'Unlimited' },
                  { feature: 'Support', v: 'Email', p: 'Priority', f: 'Dedicated' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="p-4 text-muted-foreground">{row.feature}</td>
                    <td className="p-4 text-center">{row.v}</td>
                    <td className="p-4 text-center">{row.p}</td>
                    <td className="p-4 text-center font-medium text-amber-600">{row.f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button
            onClick={handleSelect}
            disabled={isProcessing}
            className="bg-gradient-to-r from-primary to-primary/80 min-w-[200px]"
          >
            {isProcessing ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="mr-2"
                >
                  ⏳
                </motion.span>
                Processing...
              </>
            ) : (
              <>
                Upgrade Now
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// MARKETING BOOST COMPONENT
// ============================================

export const MarketingBoost: React.FC<MarketingBoostProps> = ({
  onBoost,
  isActive = false,
}) => {
  const [options, setOptions] = React.useState<BoostOptions>({
    spotlight: false,
    socialMedia: false,
    emailBlast: false,
  });

  const boostOptions = [
    {
      id: 'spotlight' as const,
      name: '24h Spotlight',
      price: 5,
      description: 'Feature your business at the top of search results for 24 hours',
      icon: Target,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'socialMedia' as const,
      name: 'Social Media Promo',
      price: 15,
      description: 'Share your listing across our social media channels',
      icon: Share2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      id: 'emailBlast' as const,
      name: 'Email Blast',
      price: 25,
      description: 'Send targeted emails to local customers in your area',
      icon: Mail,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  const totalPrice = boostOptions.reduce((sum, opt) => {
    if (options[opt.id]) return sum + opt.price;
    return sum;
  }, 0);

  const handleBoost = () => {
    if (totalPrice > 0) {
      onBoost?.(options);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl p-6',
        'bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl',
        'border border-gray-200 dark:border-gray-700 shadow-lg'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Marketing Boost</h3>
          <p className="text-sm text-muted-foreground">Get instant visibility for your business</p>
        </div>
      </div>

      {/* Boost Options */}
      <div className="space-y-3 mb-6">
        {boostOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = options[option.id];

          return (
            <motion.div
              key={option.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setOptions(prev => ({
                ...prev,
                [option.id]: !prev[option.id]
              }))}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all',
                'border-2',
                isSelected
                  ? `${option.bgColor} border-current`
                  : 'bg-white/30 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'
              )}
            >
              <div className={cn(
                'p-2 rounded-lg',
                option.bgColor
              )}>
                <Icon className={cn('h-5 w-5', option.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{option.name}</span>
                  <span className={cn(
                    'text-sm font-semibold',
                    option.color
                  )}>
                    +${option.price}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              <div className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                isSelected
                  ? `${option.color} border-current`
                  : 'border-gray-300 dark:border-gray-600'
              )}>
                {isSelected && <Check className="h-4 w-4" />}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Total & CTA */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">${totalPrice.toFixed(2)}</p>
        </div>
        <Button
          onClick={handleBoost}
          disabled={totalPrice === 0 || isActive}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 min-w-[140px]"
        >
          {isActive ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⚡
              </motion.span>
              Boost Active
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Boost Now
            </>
          )}
        </Button>
      </div>

      {/* Active Boost Indicator */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
        >
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              🚀
            </motion.span>
            <span className="text-sm font-medium">Your boost is active! Enjoy increased visibility.</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// ============================================
// ANALYTICS PREVIEW COMPONENT
// ============================================

export const AnalyticsPreview: React.FC<AnalyticsPreviewProps> = ({
  views,
  clicks,
  bookings,
  revenue,
  previousPeriod,
  tier = 'verified',
}) => {
  const calculateChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const stats = [
    {
      label: 'Views',
      value: views,
      previous: previousPeriod?.views,
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Clicks',
      value: clicks,
      previous: previousPeriod?.clicks,
      icon: MousePointer,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Bookings',
      value: bookings,
      previous: previousPeriod?.bookings,
      icon: Calendar,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Revenue',
      value: revenue,
      previous: previousPeriod?.revenue,
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      isCurrency: true,
    },
  ];

  // ROI Calculator values
  const monthlyCost = tier === 'featured' ? 39.99 : tier === 'premium' ? 19.99 : 9.99;
  const roi = ((revenue - monthlyCost) / monthlyCost) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl p-6',
        'bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl',
        'border border-gray-200 dark:border-gray-700 shadow-lg'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Analytics Preview</h3>
            <p className="text-sm text-muted-foreground">This month's performance</p>
          </div>
        </div>
        <PremiumBadge tier={tier} size="sm" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const change = calculateChange(stat.value, stat.previous);
          const isPositive = change >= 0;

          return (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.02 }}
              className={cn(
                'p-4 rounded-xl',
                'bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm',
                'border border-gray-100 dark:border-gray-600'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('p-1.5 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-4 w-4', stat.color)} />
                </div>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold">
                  {stat.isCurrency ? `$${stat.value.toLocaleString()}` : stat.value.toLocaleString()}
                </span>
                {previousPeriod && (
                  <span className={cn(
                    'text-xs font-medium flex items-center gap-0.5',
                    isPositive ? 'text-green-500' : 'text-red-500'
                  )}>
                    {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ROI Calculator */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-medium">ROI Calculator</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Return on Investment</p>
            <p className={cn(
              'text-3xl font-bold',
              roi >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Monthly Investment</p>
            <p className="text-lg font-semibold">${monthlyCost.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3">
          <Progress
            value={Math.min(Math.max(roi + 100, 0), 200) / 2}
            className="h-2"
          />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>Breakeven</span>
            <span>Excellent</span>
          </div>
        </div>
      </div>

      {/* Premium Revenue Summary */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <DollarSign className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Revenue from Premium Features</p>
            <p className="text-xl font-bold text-amber-600">${revenue.toFixed(2)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={cn(
            'font-semibold',
            revenue - monthlyCost >= 0 ? 'text-green-500' : 'text-red-500'
          )}>
            ${(revenue - monthlyCost).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Pro Tip</p>
            <p className="text-sm text-muted-foreground">
              {tier === 'featured'
                ? 'You\'re getting maximum visibility! Consider adding marketing boosts for special promotions.'
                : tier === 'premium'
                ? 'Upgrade to Featured for 2x more visibility and homepage spotlight rotation.'
                : 'Upgrade to Premium for 5x visibility boost and advanced analytics.'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// DEFAULT EXPORT - ALL COMPONENTS
// ============================================

const PremiumListings = {
  PremiumBadge,
  PromotedListingCard,
  PremiumUpgradeModal,
  MarketingBoost,
  AnalyticsPreview,
};

export default PremiumListings;
