'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Crown,
  TrendingUp,
  Eye,
  MousePointer,
  Calendar,
  DollarSign,
  Zap,
  Share2,
  Mail,
  Target,
  Check,
  ChevronRight,
  Info,
  ArrowUpRight,
  BarChart3,
  Shield,
  Rocket,
  CreditCard,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMonetization } from './MonetizationProvider';
import type { PremiumListing, PremiumListingType, PremiumAnalytics } from '@/types/monetization';

// ============================================
// TYPES
// ============================================

interface PremiumTierConfig {
  id: PremiumListingType;
  name: string;
  price: number;
  duration: number;
  description: string;
  features: string[];
  icon: React.ElementType;
  gradient: string;
  popular?: boolean;
}

interface PremiumFeaturesProps {
  businessId: string;
  currentListings?: PremiumListing[];
  onPurchase?: (type: PremiumListingType, details: Record<string, unknown>) => void;
}

interface AnalyticsCardProps {
  analytics?: PremiumAnalytics;
  tier?: PremiumListingType;
}

// ============================================
// TIER CONFIGURATIONS
// ============================================

const PREMIUM_TIERS: PremiumTierConfig[] = [
  {
    id: 'PROMOTED',
    name: 'Promoted Listing',
    price: 29.99,
    duration: 30,
    description: 'Boost your visibility in search results',
    features: [
      'Up to 5x search ranking boost',
      'Priority placement in category',
      'Promoted badge on profile',
      'Basic analytics dashboard',
      'Target specific categories',
    ],
    icon: TrendingUp,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'FEATURED',
    name: 'Featured Spot',
    price: 59.99,
    duration: 30,
    description: 'Premium homepage and category spotlight',
    features: [
      'Homepage spotlight rotation',
      'Top 3 in category listings',
      'Featured badge with glow effect',
      'Advanced analytics & insights',
      'Unlimited category targeting',
      'Priority customer support',
    ],
    icon: Crown,
    gradient: 'from-amber-500 to-orange-500',
    popular: true,
  },
  {
    id: 'MARKETING_BOOST',
    name: 'Marketing Boost',
    price: 99.99,
    duration: 7,
    description: 'Multi-channel marketing campaign',
    features: [
      'Email blast to local customers',
      'Social media promotion',
      'Push notification campaign',
      'Detailed campaign analytics',
      'Audience targeting options',
      'A/B testing included',
    ],
    icon: Rocket,
    gradient: 'from-purple-500 to-pink-500',
  },
];

// ============================================
// PREMIUM BADGE COMPONENT
// ============================================

interface PremiumBadgeProps {
  tier: PremiumListingType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const PremiumFeatureBadge: React.FC<PremiumBadgeProps> = ({
  tier,
  size = 'md',
  showLabel = true,
}) => {
  const configs = {
    PROMOTED: {
      label: 'Promoted',
      colors: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      icon: TrendingUp,
    },
    FEATURED: {
      label: 'Featured',
      colors: 'bg-gradient-to-r from-amber-500 to-orange-500',
      icon: Crown,
    },
    MARKETING_BOOST: {
      label: 'Boosted',
      colors: 'bg-gradient-to-r from-purple-500 to-pink-500',
      icon: Rocket,
    },
  };
  
  const config = configs[tier];
  const Icon = config.icon;
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold text-white',
        config.colors,
        sizes[size]
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

// ============================================
// ANALYTICS PREVIEW COMPONENT
// ============================================

export const PremiumAnalyticsCard: React.FC<AnalyticsCardProps> = ({ analytics, tier }) => {
  const stats = [
    {
      label: 'Views',
      value: analytics?.views || 0,
      previous: analytics?.previousPeriod?.views,
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Clicks',
      value: analytics?.clicks || 0,
      previous: analytics?.previousPeriod?.clicks,
      icon: MousePointer,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Bookings',
      value: analytics?.bookings || 0,
      previous: analytics?.previousPeriod?.bookings,
      icon: Calendar,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Revenue',
      value: analytics?.revenue || 0,
      previous: analytics?.previousPeriod?.revenue,
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      isCurrency: true,
    },
  ];
  
  const calculateChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics
          </CardTitle>
          {tier && <PremiumFeatureBadge tier={tier} size="sm" />}
        </div>
        <CardDescription>Your premium listing performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const change = calculateChange(stat.value, stat.previous);
            const isPositive = change >= 0;
            
            return (
              <div
                key={stat.label}
                className="p-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('p-1.5 rounded-md', stat.bgColor)}>
                    <Icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">
                    {stat.isCurrency
                      ? `$${stat.value.toLocaleString()}`
                      : stat.value.toLocaleString()}
                  </span>
                  {analytics?.previousPeriod && (
                    <span
                      className={cn(
                        'text-xs font-medium flex items-center gap-0.5',
                        isPositive ? 'text-green-500' : 'text-red-500'
                      )}
                    >
                      {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// PURCHASE MODAL COMPONENT
// ============================================

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: PremiumTierConfig;
  onPurchase: () => void;
  isProcessing: boolean;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  tier,
  onPurchase,
  isProcessing,
}) => {
  const [boostLevel, setBoostLevel] = useState(3);
  const [section, setSection] = useState<'HOMEPAGE' | 'CATEGORY' | 'SEARCH'>('HOMEPAGE');
  const [channels, setChannels] = useState<('EMAIL' | 'SOCIAL' | 'PUSH')[]>(['EMAIL']);
  
  const Icon = tier.icon;
  
  const totalPrice = tier.id === 'PROMOTED'
    ? tier.price * (boostLevel / 3)
    : tier.price * channels.length;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', tier.gradient)}>
              <Icon className="h-5 w-5" />
            </div>
            Purchase {tier.name}
          </DialogTitle>
          <DialogDescription>{tier.description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Promoted Listing Options */}
          {tier.id === 'PROMOTED' && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Boost Level</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setBoostLevel(level)}
                    className={cn(
                      'flex-1 py-3 rounded-lg border-2 transition-all',
                      boostLevel === level
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="text-lg font-bold">{level}x</div>
                    <div className="text-xs text-muted-foreground">
                      ${(tier.price * (level / 3)).toFixed(0)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Featured Listing Options */}
          {tier.id === 'FEATURED' && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Featured Section</label>
              <div className="grid grid-cols-3 gap-2">
                {(['HOMEPAGE', 'CATEGORY', 'SEARCH'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSection(s)}
                    className={cn(
                      'py-3 px-2 rounded-lg border-2 transition-all',
                      section === s
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="text-sm font-medium capitalize">{s}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Marketing Boost Options */}
          {tier.id === 'MARKETING_BOOST' && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Marketing Channels</label>
              <div className="space-y-2">
                {[
                  { id: 'EMAIL' as const, name: 'Email Blast', icon: Mail, price: tier.price },
                  { id: 'SOCIAL' as const, name: 'Social Media', icon: Share2, price: tier.price * 0.7 },
                  { id: 'PUSH' as const, name: 'Push Notifications', icon: Zap, price: tier.price * 0.5 },
                ].map((channel) => {
                  const ChannelIcon = channel.icon;
                  const isSelected = channels.includes(channel.id);
                  
                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setChannels((prev) =>
                          isSelected
                            ? prev.filter((c) => c !== channel.id)
                            : [...prev, channel.id]
                        );
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <ChannelIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{channel.name}</div>
                        <div className="text-sm text-muted-foreground">
                          +${channel.price.toFixed(0)}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          isSelected && 'border-primary bg-primary'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Features List */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="font-medium mb-3 text-sm">What's included:</h4>
            <ul className="space-y-2">
              {tier.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Duration Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Active for {tier.duration} days</span>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={onPurchase}
            disabled={isProcessing}
            className="bg-gradient-to-r from-primary to-primary/80 min-w-[180px]"
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
                <CreditCard className="mr-2 h-4 w-4" />
                Purchase - ${totalPrice.toFixed(2)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// ACTIVE LISTING CARD COMPONENT
// ============================================

interface ActiveListingCardProps {
  listing: PremiumListing;
  onCancel?: () => void;
}

const ActiveListingCard: React.FC<ActiveListingCardProps> = ({ listing, onCancel }) => {
  const tier = PREMIUM_TIERS.find((t) => t.id === listing.type);
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(listing.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const progress = tier
    ? ((tier.duration - daysRemaining) / tier.duration) * 100
    : 0;
  
  if (!tier) return null;
  
  const Icon = tier.icon;
  
  return (
    <Card className="overflow-hidden">
      <div className={cn('h-1', `bg-gradient-to-r ${tier.gradient}`)} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', tier.gradient)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{tier.name}</CardTitle>
              <CardDescription>{daysRemaining} days remaining</CardDescription>
            </div>
          </div>
          <PremiumFeatureBadge tier={listing.type} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={progress} className="h-2" />
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{listing.analytics?.views || 0}</p>
            <p className="text-xs text-muted-foreground">Views</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{listing.analytics?.clicks || 0}</p>
            <p className="text-xs text-muted-foreground">Clicks</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{listing.analytics?.bookings || 0}</p>
            <p className="text-xs text-muted-foreground">Bookings</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" size="sm">
          <BarChart3 className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-red-500 hover:text-red-600"
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
};

// ============================================
// MAIN PREMIUM FEATURES COMPONENT
// ============================================

export const PremiumFeatures: React.FC<PremiumFeaturesProps> = ({
  businessId,
  currentListings = [],
  onPurchase,
}) => {
  const {
    premiumListings,
    purchasePromotedListing,
    purchaseFeaturedListing,
    purchaseMarketingBoost,
  } = useMonetization();
  
  const [selectedTier, setSelectedTier] = useState<PremiumTierConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  
  // Combine listings from props and store
  const allListings = [...currentListings, ...premiumListings.filter((l) => l.businessId === businessId)];
  const activeListings = allListings.filter(
    (l) => l.status === 'ACTIVE' && new Date(l.endDate) > new Date()
  );
  
  const handlePurchase = async () => {
    if (!selectedTier) return;
    
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    switch (selectedTier.id) {
      case 'PROMOTED':
        purchasePromotedListing(businessId, 3, selectedTier.duration, selectedTier.price);
        break;
      case 'FEATURED':
        purchaseFeaturedListing(businessId, 'HOMEPAGE', selectedTier.duration, selectedTier.price);
        break;
      case 'MARKETING_BOOST':
        purchaseMarketingBoost(businessId, ['EMAIL'], selectedTier.price);
        break;
    }
    
    onPurchase?.(selectedTier.id, {});
    setIsProcessing(false);
    setSelectedTier(null);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Premium Features</h2>
          <p className="text-muted-foreground">Boost your visibility and grow your business</p>
        </div>
        {activeListings.length > 0 && (
          <Badge variant="secondary" className="text-sm">
            {activeListings.length} active
          </Badge>
        )}
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse Plans</TabsTrigger>
          <TabsTrigger value="active">
            Active Listings
            {activeListings.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary text-white">
                {activeListings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        {/* Browse Plans Tab */}
        <TabsContent value="browse" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PREMIUM_TIERS.map((tier) => {
              const Icon = tier.icon;
              
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  className={cn(
                    'relative rounded-2xl overflow-hidden',
                    'bg-white dark:bg-gray-900 border shadow-lg',
                    tier.popular && 'ring-2 ring-primary'
                  )}
                >
                  {tier.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-primary text-white text-center text-xs py-1 font-medium">
                      Most Popular
                    </div>
                  )}
                  
                  <div className={cn('h-24', `bg-gradient-to-br ${tier.gradient}`)}>
                    <div className="flex flex-col items-center justify-center h-full text-white">
                      <Icon className="h-8 w-8 mb-2" />
                      <span className="font-semibold">{tier.name}</span>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <div className="text-center mb-4">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-bold">${tier.price}</span>
                        <span className="text-muted-foreground">
                          /{tier.duration} days
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tier.description}
                      </p>
                    </div>
                    
                    <ul className="space-y-2 mb-4">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      onClick={() => setSelectedTier(tier)}
                      className={cn(
                        'w-full',
                        tier.popular
                          ? 'bg-gradient-to-r from-primary to-primary/80'
                          : ''
                      )}
                    >
                      Purchase
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>
        
        {/* Active Listings Tab */}
        <TabsContent value="active" className="mt-6">
          {activeListings.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Crown className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Active Listings</h3>
              <p className="text-muted-foreground mb-4">
                Purchase a premium listing to boost your visibility
              </p>
              <Button onClick={() => setActiveTab('browse')}>
                Browse Plans
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeListings.map((listing) => (
                <ActiveListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <PremiumAnalyticsCard
            analytics={activeListings[0]?.analytics}
            tier={activeListings[0]?.type}
          />
          
          {activeListings.length === 0 && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">No analytics available</p>
                <p className="text-sm text-muted-foreground">
                  Purchase a premium listing to start tracking your performance metrics.
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Purchase Modal */}
      {selectedTier && (
        <PurchaseModal
          isOpen={!!selectedTier}
          onClose={() => setSelectedTier(null)}
          tier={selectedTier}
          onPurchase={handlePurchase}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

// ============================================
// FEATURE COMPARISON TABLE
// ============================================

export const PremiumFeatureComparison: React.FC = () => {
  const features = [
    { name: 'Visibility Boost', promoted: 'Up to 5x', featured: 'Up to 10x', boost: 'Variable' },
    { name: 'Search Priority', promoted: 'High', featured: 'Top', boost: 'Standard' },
    { name: 'Homepage Spot', promoted: '—', featured: '✓', boost: '—' },
    { name: 'Analytics', promoted: 'Basic', featured: 'Advanced', boost: 'Campaign' },
    { name: 'Marketing Channels', promoted: '—', featured: 'Email', boost: 'All' },
    { name: 'Support', promoted: 'Email', featured: 'Priority', boost: 'Dedicated' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Feature Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Feature</th>
                <th className="text-center p-3 font-medium">Promoted</th>
                <th className="text-center p-3 font-medium">Featured</th>
                <th className="text-center p-3 font-medium">Marketing Boost</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-3 text-muted-foreground">{feature.name}</td>
                  <td className="p-3 text-center">{feature.promoted}</td>
                  <td className="p-3 text-center font-medium text-amber-600">{feature.featured}</td>
                  <td className="p-3 text-center">{feature.boost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PremiumFeatures;
