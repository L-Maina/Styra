'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  Clock,
  CreditCard,
  Building2,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Settings,
  Eye,
  ChevronRight,
  Info,
  Shield,
  RefreshCw,
  Download,
  Plus,
  Edit2,
  Trash2,
  Star,
  Gift,
  Percent,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useMonetization } from './MonetizationProvider';
import type { Payout, PayoutMethod, PayoutPreferences, PayoutAccount } from '@/types/monetization';

// ============================================
// TYPES
// ============================================

interface PayoutSystemProps {
  businessId: string;
  businessName?: string;
}

interface BalanceCardProps {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalCommissionPaid: number;
}

interface PayoutMethodCardProps {
  method: PayoutMethod;
  account?: PayoutAccount;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface PayoutHistoryRowProps {
  payout: Payout;
  onViewDetails?: () => void;
}

// ============================================
// BALANCE CARD COMPONENT
// ============================================

const BalanceCard: React.FC<BalanceCardProps> = ({
  availableBalance,
  pendingBalance,
  totalEarned,
  totalCommissionPaid,
}) => {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            <span className="font-medium">Available Balance</span>
          </div>
          <Badge className="bg-white/20 text-white border-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        </div>
        <div className="text-4xl font-bold">${availableBalance.toFixed(2)}</div>
        <p className="text-white/80 text-sm mt-1">Ready for withdrawal</p>
      </div>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-xl font-semibold">${pendingBalance.toFixed(2)}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Total Earned</span>
            </div>
            <p className="text-xl font-semibold">${totalEarned.toFixed(2)}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <Percent className="h-4 w-4" />
              <span className="text-sm">Commission</span>
            </div>
            <p className="text-xl font-semibold">${totalCommissionPaid.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// PAYOUT METHOD CARD COMPONENT
// ============================================

const PayoutMethodCard: React.FC<PayoutMethodCardProps> = ({
  method,
  account,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const methodConfig = {
    BANK_TRANSFER: {
      name: 'Bank Transfer',
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Direct bank deposit',
    },
    PAYPAL: {
      name: 'PayPal',
      icon: DollarSign,
      color: 'text-[#0070ba]',
      bgColor: 'bg-[#0070ba]/10',
      description: 'PayPal account',
    },
    MPESA: {
      name: 'M-Pesa',
      icon: Smartphone,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Mobile money',
    },
    STRIPE: {
      name: 'Stripe',
      icon: CreditCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Stripe Connect',
    },
  };
  
  const config = methodConfig[method];
  const Icon = config.icon;
  
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-xl border-2 cursor-pointer transition-all',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-lg', config.bgColor)}>
          <Icon className={cn('h-6 w-6', config.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{config.name}</span>
            {account?.isPrimary && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                Primary
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {account?.verificationStatus === 'VERIFIED'
              ? config.description
              : account?.verificationStatus === 'PENDING'
              ? 'Verification pending'
              : 'Not connected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {account?.verificationStatus === 'VERIFIED' && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {account?.verificationStatus === 'PENDING' && (
            <Clock className="h-5 w-5 text-amber-500" />
          )}
          {!account && (
            <Plus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {isSelected && account && (
        <div className="absolute top-2 right-2 flex gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && !account.isPrimary && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// PAYOUT HISTORY ROW COMPONENT
// ============================================

const PayoutHistoryRow: React.FC<PayoutHistoryRowProps> = ({ payout, onViewDetails }) => {
  const statusConfig = {
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: XCircle },
    ON_HOLD: { label: 'On Hold', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  };
  
  const methodConfig = {
    BANK_TRANSFER: 'Bank Transfer',
    PAYPAL: 'PayPal',
    MPESA: 'M-Pesa',
    STRIPE: 'Stripe',
  };
  
  const config = statusConfig[payout.status];
  const StatusIcon = config.icon;
  
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div>
          <p className="font-medium font-mono text-sm">{payout.id}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(payout.createdAt).toLocaleDateString()}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn('gap-1', config.color)}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="font-semibold">${payout.amount.toFixed(2)}</span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        -${payout.fees.toFixed(2)}
      </TableCell>
      <TableCell className="font-medium text-green-600">
        ${payout.netAmount.toFixed(2)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {methodConfig[payout.method]}
      </TableCell>
      <TableCell>
        {payout.status === 'COMPLETED' ? (
          <span className="text-sm text-muted-foreground">
            {new Date(payout.completedAt!).toLocaleDateString()}
          </span>
        ) : payout.estimatedArrival ? (
          <span className="text-sm text-muted-foreground">
            Est. {new Date(payout.estimatedArrival).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={onViewDetails}>
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

// ============================================
// WITHDRAWAL MODAL COMPONENT
// ============================================

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  selectedMethod: PayoutMethod | null;
  onWithdraw: (amount: number, method: PayoutMethod) => void;
  isProcessing: boolean;
}

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  selectedMethod,
  onWithdraw,
  isProcessing,
}) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  
  const numericAmount = parseFloat(amount) || 0;
  const fee = selectedMethod === 'BANK_TRANSFER' ? 1.5 : 0;
  const netAmount = numericAmount - fee;
  
  const handleWithdraw = () => {
    if (numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (numericAmount > availableBalance) {
      setError('Insufficient balance');
      return;
    }
    if (numericAmount < 10) {
      setError('Minimum withdrawal is $10');
      return;
    }
    if (!selectedMethod) {
      setError('Please select a payout method');
      return;
    }
    
    setError('');
    onWithdraw(numericAmount, selectedMethod);
  };
  
  const presetAmounts = [50, 100, 250, 500];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription>
            Available balance: ${availableBalance.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Amount to withdraw</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                placeholder="0.00"
                className="pl-8 text-2xl font-semibold h-14"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>
          
          {/* Preset Amounts */}
          <div className="flex gap-2">
            {presetAmounts.map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => {
                  setAmount(preset.toString());
                  setError('');
                }}
                disabled={preset > availableBalance}
              >
                ${preset}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAmount(availableBalance.toFixed(2));
                setError('');
              }}
            >
              All
            </Button>
          </div>
          
          {/* Fee Breakdown */}
          {numericAmount > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span>${numericAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing fee</span>
                <span className="text-red-500">-${fee.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>You'll receive</span>
                <span className="text-green-600">${netAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
          
          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-blue-800 dark:text-blue-200">
              Withdrawals are typically processed within 1-3 business days.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={isProcessing || !selectedMethod}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : (
              <>
                Withdraw
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// PAYOUT PREFERENCES COMPONENT
// ============================================

interface PayoutPreferencesProps {
  preferences?: PayoutPreferences;
  onSave: (prefs: Partial<PayoutPreferences>) => void;
}

const PayoutPreferencesPanel: React.FC<PayoutPreferencesProps> = ({
  preferences,
  onSave,
}) => {
  const [frequency, setFrequency] = useState<PayoutPreferences['frequency']>(
    preferences?.frequency || 'WEEKLY'
  );
  const [minimumAmount, setMinimumAmount] = useState(
    preferences?.minimumAmount?.toString() || '50'
  );
  const [autoPayout, setAutoPayout] = useState(preferences?.autoPayout ?? true);
  
  const handleSave = () => {
    onSave({
      frequency,
      minimumAmount: parseFloat(minimumAmount) || 50,
      autoPayout,
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Payout Preferences
        </CardTitle>
        <CardDescription>Configure automatic payouts and minimums</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Payout Frequency</Label>
          <Select value={frequency} onValueChange={(v: typeof frequency) => setFrequency(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="MANUAL">Manual only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Minimum Payout Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={minimumAmount}
              onChange={(e) => setMinimumAmount(e.target.value)}
              className="pl-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Payouts will only be processed when your balance exceeds this amount.
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label>Automatic Payouts</Label>
            <p className="text-xs text-muted-foreground">
              Automatically process payouts on schedule
            </p>
          </div>
          <Button
            variant={autoPayout ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoPayout(!autoPayout)}
          >
            {autoPayout ? 'Enabled' : 'Disabled'}
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} className="w-full">
          Save Preferences
        </Button>
      </CardFooter>
    </Card>
  );
};

// ============================================
// MAIN PAYOUT SYSTEM COMPONENT
// ============================================

export const PayoutSystem: React.FC<PayoutSystemProps> = ({
  businessId,
  businessName = 'Your Business',
}) => {
  const { getProviderEarnings, requestPayout, payouts, isLoading } = useMonetization();
  
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod>('BANK_TRANSFER');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Get earnings
  const earnings = useMemo(() => getProviderEarnings(businessId), [businessId, getProviderEarnings, payouts]);
  
  // Payout accounts state — populated from API on mount
  const [payoutAccountsList, setPayoutAccountsList] = useState<PayoutAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Build lookup from fetched accounts, keyed by payout method
  const payoutAccounts: Record<PayoutMethod, PayoutAccount | undefined> = useMemo(() => {
    const map: Record<PayoutMethod, PayoutAccount | undefined> = {
      BANK_TRANSFER: undefined,
      PAYPAL: undefined,
      MPESA: undefined,
      STRIPE: undefined,
    };
    for (const acc of payoutAccountsList) {
      map[acc.method] = acc;
    }
    return map;
  }, [payoutAccountsList]);

  // Auto-select the first verified account on mount (if any)
  useEffect(() => {
    const primary = payoutAccountsList.find((a) => a.isPrimary && a.verificationStatus === 'VERIFIED');
    if (primary) setSelectedMethod(primary.method);
  }, [payoutAccountsList]);

  // Fetch payout accounts on mount
  const fetchPayoutAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const res = await fetch(
        `/api/revenue?type=payout-accounts&businessId=${encodeURIComponent(businessId)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPayoutAccountsList(json.data);
          return;
        }
      }
      // Endpoint returned an error or non-matching shape — show empty state
    } catch {
      // Network error or endpoint not available — show empty state
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchPayoutAccounts();
  }, [fetchPayoutAccounts]);
  
  // Filter payouts for this business
  const businessPayouts = useMemo(
    () => payouts.filter((p) => p.businessId === businessId),
    [payouts, businessId]
  );
  
  // Handle withdrawal
  const handleWithdraw = async (amount: number, method: PayoutMethod) => {
    setIsProcessing(true);
    
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const payout = requestPayout(businessId, amount, method);
    
    if (payout) {
      setShowWithdrawal(false);
    }
    
    setIsProcessing(false);
  };
  
  // Save preferences
  const handleSavePreferences = (prefs: Partial<PayoutPreferences>) => {
    // In real app, this would save to backend
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Earnings & Payouts</h2>
          <p className="text-muted-foreground">Manage your earnings and withdrawal methods</p>
        </div>
        <Button
          onClick={() => setShowWithdrawal(true)}
          disabled={earnings.availableBalance < 10}
          className="bg-gradient-to-r from-primary to-primary/80"
        >
          <DollarSign className="mr-2 h-4 w-4" />
          Withdraw Funds
        </Button>
      </div>
      
      {/* Balance Card */}
      <BalanceCard
        availableBalance={earnings.availableBalance}
        pendingBalance={earnings.pendingBalance}
        totalEarned={earnings.totalEarned}
        totalCommissionPaid={earnings.totalCommissionPaid}
      />
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-muted-foreground">Total Earnings</span>
                  </div>
                  <span className="font-semibold">${earnings.totalEarned.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-muted-foreground">In Escrow</span>
                  </div>
                  <span className="font-semibold">${earnings.pendingBalance.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Wallet className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-muted-foreground">Total Withdrawn</span>
                  </div>
                  <span className="font-semibold">
                    ${(earnings.totalEarned - earnings.availableBalance - earnings.pendingBalance).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            {/* Commission Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Commission Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform Rate</span>
                  <Badge variant="secondary">15%</Badge>
                </div>
                <Progress value={15} max={25} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5%</span>
                  <span>Your rate: 15%</span>
                  <span>25%</span>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Commission Paid</span>
                  <span className="font-semibold text-red-500">
                    -${earnings.totalCommissionPaid.toFixed(2)}
                  </span>
                </div>
                
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    Commission is automatically deducted from each booking. The platform fee helps us maintain the service, provide support, and drive customers to your business.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Payouts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Payouts</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('history')}>
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {businessPayouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payouts yet</p>
                  <p className="text-sm">Your completed payouts will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {businessPayouts.slice(0, 3).map((payout) => (
                    <div
                      key={payout.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">${payout.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payout.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          payout.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : payout.status === 'PROCESSING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {payout.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Payment Methods Tab */}
        <TabsContent value="methods" className="mt-6">
          {isLoadingAccounts ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading payout methods…</span>
            </div>
          ) : payoutAccountsList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">
                  No payout methods configured
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact support to set up your payout account.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(payoutAccounts) as PayoutMethod[]).map((method) => (
                <PayoutMethodCard
                  key={method}
                  method={method}
                  account={payoutAccounts[method]}
                  isSelected={selectedMethod === method}
                  onSelect={() => setSelectedMethod(method)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>
                View all your past and pending payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessPayouts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No payout history
                        </TableCell>
                      </TableRow>
                    ) : (
                      businessPayouts.map((payout) => (
                        <PayoutHistoryRow key={payout.id} payout={payout} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PayoutPreferencesPanel
              preferences={{
                businessId,
                frequency: 'WEEKLY',
                minimumAmount: 50,
                autoPayout: true,
                preferredMethod: selectedMethod,
                taxFormSubmitted: false,
              }}
              onSave={handleSavePreferences}
            />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Tax Information
                </CardTitle>
                <CardDescription>
                  Ensure your tax details are up to date
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">Tax form not submitted</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Submit Now
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tax forms are required for payouts above $600/year in the US.
                  Please submit your W-9 or W-8BEN form to avoid payout delays.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={showWithdrawal}
        onClose={() => setShowWithdrawal(false)}
        availableBalance={earnings.availableBalance}
        selectedMethod={selectedMethod}
        onWithdraw={handleWithdraw}
        isProcessing={isProcessing}
      />
    </div>
  );
};

export default PayoutSystem;
