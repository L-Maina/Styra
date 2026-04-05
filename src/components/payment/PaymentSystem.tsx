'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Wallet,
  Smartphone,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar,
  Shield,
  Lock,
  Receipt,
  Star,
  Heart,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Share2,
  Copy,
  Info,
  Building2,
  RefreshCw,
  Timer,
  ExternalLink,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassBadge,
  GlassModal,
  FadeIn,
  GradientText,
} from '@/components/ui/custom/glass-components';
import type { Service, Staff, Business, Booking } from '@/types';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store';
import { BrandLogo } from '@/components/ui/brand-logo';

// ============================================
// TYPES & INTERFACES
// ============================================

export type PaymentMethodType = 'card' | 'paypal' | 'mpesa';

// Map frontend payment methods to API enum values
const PAYMENT_METHOD_MAP: Record<PaymentMethodType, 'STRIPE' | 'PAYPAL' | 'MPESA'> = {
  card: 'STRIPE',
  paypal: 'PAYPAL',
  mpesa: 'MPESA',
};

export interface PaymentCheckoutProps {
  business: Business;
  service: Service;
  staff?: Staff | null;
  date: string;
  time: string;
  notes?: string;
  onBack?: () => void;
  onComplete?: (booking: Booking, payment: PaymentResult) => void;
  onCancel?: () => void;
}

export interface PaymentResult {
  id: string;
  success: boolean;
  amount: number;
  platformFee: number;
  providerAmount: number;
  tip: number;
  currency: string;
  paymentMethod: PaymentMethodType;
  transactionId: string;
  createdAt: Date;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
}

export interface TipOption {
  amount: number;
  label: string;
}

// ============================================
// COMMISSION CALCULATION UTILITIES
// ============================================

const PLATFORM_FEE_PERCENTAGE = 0.15; // 15%
const PROVIDER_PERCENTAGE = 0.85; // 85%

export const calculateCommission = (servicePrice: number, tip: number = 0) => {
  const platformFee = Math.round(servicePrice * PLATFORM_FEE_PERCENTAGE * 100) / 100;
  const providerAmount = Math.round((servicePrice * PROVIDER_PERCENTAGE + tip) * 100) / 100;
  const total = servicePrice + tip;

  return {
    servicePrice,
    platformFee,
    providerAmount,
    tip,
    total,
    platformFeePercentage: PLATFORM_FEE_PERCENTAGE * 100,
    providerPercentage: PROVIDER_PERCENTAGE * 100,
  };
};

// ============================================
// TIP OPTIONS
// ============================================

const TIP_OPTIONS: TipOption[] = [
  { amount: 0, label: 'No tip' },
  { amount: 100, label: 'KSh 100' },
  { amount: 200, label: 'KSh 200' },
  { amount: 500, label: 'KSh 500' },
  { amount: 1000, label: 'KSh 1,000' },
];

// ============================================
// PAYMENT METHOD CARD COMPONENT
// ============================================

interface PaymentMethodCardProps {
  type: PaymentMethodType;
  selected: boolean;
  onSelect: () => void;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ type, selected, onSelect }) => {
  const config = {
    card: {
      icon: CreditCard,
      title: 'Credit / Debit Card',
      subtitle: 'Visa, Mastercard, Amex',
      gradient: 'from-blue-500 to-purple-600',
      bgClass: 'bg-gradient-to-r from-blue-500 to-purple-600',
    },
    paypal: {
      icon: Wallet,
      title: 'PayPal',
      subtitle: 'Pay with PayPal account',
      gradient: 'from-[#0070ba] to-[#003087]',
      bgClass: 'bg-[#0070ba]',
    },
    mpesa: {
      icon: Smartphone,
      title: 'M-Pesa',
      subtitle: 'Mobile money payment',
      gradient: 'from-green-500 to-green-600',
      bgClass: 'bg-green-600',
    },
  };

  const { icon: Icon, title, subtitle, bgClass } = config[type];

  return (
    <motion.button
      onClick={onSelect}
      className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      }`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className={`w-14 h-9 rounded-lg ${bgClass} flex items-center justify-center text-white`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </div>
      <div
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? 'border-primary bg-primary' : 'border-muted-foreground'
        }`}
      >
        {selected && <Check className="h-4 w-4 text-white" />}
      </div>
    </motion.button>
  );
};

// ============================================
// CARD INPUT FORM COMPONENT
// ============================================

interface CardFormProps {
  onValidChange: (valid: boolean) => void;
}

const CardForm: React.FC<CardFormProps> = ({ onValidChange }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16);
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted;
  };

  // Format expiry date
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  // Detect card type
  const getCardType = (number: string) => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    return null;
  };

  const cardType = getCardType(cardNumber);

  // Validate form
  useEffect(() => {
    const isValid =
      cardNumber.replace(/\s/g, '').length >= 15 &&
      expiry.length === 5 &&
      cvv.length >= 3 &&
      name.length >= 2;
    onValidChange(isValid);
  }, [cardNumber, expiry, cvv, name, onValidChange]);

  return (
    <div className="space-y-4 mt-4">
      {/* Card Preview */}
      <motion.div
        className={`relative w-full h-44 rounded-xl overflow-hidden ${
          focused ? 'shadow-glow' : ''
        }`}
        initial={{ rotateY: 0 }}
        style={{ perspective: '1000px' }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 rounded-xl p-5 flex flex-col justify-between"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Card chip and type */}
          <div className="flex justify-between items-start">
            <div className="w-12 h-9 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500" />
            <div className="flex items-center gap-2">
              {cardType === 'visa' && (
                <span className="text-white font-bold text-xl italic">VISA</span>
              )}
              {cardType === 'mastercard' && (
                <div className="flex">
                  <div className="w-5 h-5 rounded-full bg-red-500 opacity-80" />
                  <div className="w-5 h-5 rounded-full bg-yellow-500 opacity-80 -ml-2" />
                </div>
              )}
              {cardType === 'amex' && (
                <span className="text-white font-bold text-xs">AMEX</span>
              )}
            </div>
          </div>

          {/* Card number */}
          <div className="font-mono text-lg text-white tracking-wider">
            {cardNumber || '•••• •••• •••• ••••'}
          </div>

          {/* Card holder and expiry */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-slate-400 uppercase mb-1">Card Holder</div>
              <div className="text-white uppercase text-sm tracking-wide">
                {name || 'YOUR NAME'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase mb-1">Expires</div>
              <div className="text-white text-sm">{expiry || 'MM/YY'}</div>
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-secondary/10" />
      </motion.div>

      {/* Input fields */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Card Number</label>
          <GlassInput
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            onFocus={() => setFocused('number')}
            onBlur={() => setFocused(null)}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            leftIcon={<CreditCard className="h-4 w-4" />}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Expiry Date</label>
            <GlassInput
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              onFocus={() => setFocused('expiry')}
              onBlur={() => setFocused(null)}
              placeholder="MM/YY"
              maxLength={5}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">CVV</label>
            <GlassInput
              type="password"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onFocus={() => setFocused('cvv')}
              onBlur={() => setFocused(null)}
              placeholder="•••"
              maxLength={4}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Cardholder Name</label>
          <GlassInput
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            placeholder="JOHN DOE"
          />
        </div>
      </div>
    </div>
  );
};

// ============================================
// M-PESA INPUT COMPONENT
// ============================================

interface MpesaInputProps {
  onValidChange: (valid: boolean) => void;
}

const MpesaInput: React.FC<MpesaInputProps> = ({ onValidChange }) => {
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const cleaned = phone.replace(/\D/g, '');
    onValidChange(cleaned.length >= 9);
  }, [phone, onValidChange]);

  return (
    <div className="space-y-4 mt-4">
      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-800 dark:text-green-200">
          Enter your M-Pesa registered phone number. You will receive a payment prompt on your phone.
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">M-Pesa Phone Number</label>
        <GlassInput
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+254 7XX XXX XXX"
          leftIcon={<Smartphone className="h-4 w-4" />}
        />
      </div>
    </div>
  );
};

// ============================================
// PAYPAL INPUT COMPONENT
// ============================================

interface PayPalInputProps {
  onValidChange: (valid: boolean) => void;
}

const PayPalInput: React.FC<PayPalInputProps> = ({ onValidChange }) => {
  const [email, setEmail] = useState('');

  useEffect(() => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    onValidChange(isValid);
  }, [email, onValidChange]);

  return (
    <div className="space-y-4 mt-4">
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-start gap-3">
        <Wallet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          You will be redirected to PayPal to complete your payment securely.
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">PayPal Email</label>
        <GlassInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          leftIcon={<Wallet className="h-4 w-4" />}
        />
      </div>
    </div>
  );
};

// ============================================
// TIP SELECTOR COMPONENT
// ============================================

interface TipSelectorProps {
  servicePrice: number;
  selectedTip: number;
  onTipChange: (tip: number) => void;
}

const TipSelector: React.FC<TipSelectorProps> = ({ servicePrice, selectedTip, onTipChange }) => {
  const [customTip, setCustomTip] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomTipChange = (value: string) => {
    const num = parseInt(value.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      setCustomTip(value);
      onTipChange(num);
    } else if (value === '') {
      setCustomTip('');
      onTipChange(0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-rose-500" />
        <h3 className="font-semibold">Add a tip for your service provider</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Show your appreciation! 100% of tips go directly to the provider.
      </p>

      <div className="grid grid-cols-5 gap-2">
        {TIP_OPTIONS.map((option) => (
          <motion.button
            key={option.amount}
            onClick={() => {
              onTipChange(option.amount);
              setShowCustom(false);
              setCustomTip('');
            }}
            className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
              selectedTip === option.amount && !showCustom
                ? 'gradient-bg text-white shadow-glow-sm'
                : 'bg-muted/50 hover:bg-muted text-foreground'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {option.label}
          </motion.button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`text-sm font-medium transition-colors ${
            showCustom ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Custom amount
        </button>
      </div>

      {showCustom && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          <GlassInput
            value={customTip}
            onChange={(e) => handleCustomTipChange(e.target.value)}
            placeholder="Enter custom tip amount"
            leftIcon={<span className="text-muted-foreground">KSh</span>}
            type="number"
          />
        </motion.div>
      )}
    </div>
  );
};

// ============================================
// PRICE BREAKDOWN COMPONENT
// ============================================

interface PriceBreakdownProps {
  breakdown: ReturnType<typeof calculateCommission>;
  showTip?: boolean;
}

const PriceBreakdown: React.FC<PriceBreakdownProps> = ({ breakdown, showTip = true }) => {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Service price</span>
        <span className="font-medium">${breakdown.servicePrice.toFixed(2)}</span>
      </div>

      {showTip && breakdown.tip > 0 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Heart className="h-3 w-3 text-rose-500" /> Tip
          </span>
          <span className="font-medium">${breakdown.tip.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground flex items-center gap-1">
          Platform fee ({breakdown.platformFeePercentage}%)
          <button className="hover:text-foreground transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        </span>
        <span className="font-medium">-${breakdown.platformFee.toFixed(2)}</span>
      </div>

      <div className="h-px bg-border" />

      <div className="flex justify-between items-center">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold gradient-text">${breakdown.total.toFixed(2)}</span>
      </div>

      <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-3.5 w-3.5" />
          <span>Provider receives: ${breakdown.providerAmount.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          <span>Secure payment with SSL encryption</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SUCCESS STATE COMPONENT
// ============================================

interface PaymentSuccessProps {
  booking: Booking;
  payment: PaymentResult;
  onDownloadReceipt: () => void;
  onShare: () => void;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ booking, payment, onDownloadReceipt, onShare }) => {
  const [copied, setCopied] = useState(false);

  const copyConfirmation = () => {
    navigator.clipboard.writeText(payment.transactionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExternalPayment = payment.paymentMethod === 'paypal' || payment.paymentMethod === 'mpesa';
  const paymentProviderLabel = payment.paymentMethod === 'paypal' ? 'PayPal' : payment.paymentMethod === 'mpesa' ? 'M-Pesa' : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6 py-6"
    >
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 rounded-full gradient-bg flex items-center justify-center mx-auto shadow-glow"
      >
        <Check className="h-12 w-12 text-white" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold mb-2">{isExternalPayment ? 'Payment Verified' : 'Payment Successful!'}</h2>
        <p className="text-muted-foreground">
          Your booking has been confirmed and the provider has been notified.
        </p>
        {isExternalPayment && paymentProviderLabel && (
          <p className="text-sm text-muted-foreground mt-1">
            Your payment was confirmed via {paymentProviderLabel}
          </p>
        )}
      </div>

      {/* Booking Details Card */}
      <GlassCard variant="elevated" className="p-5 text-left">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Booking Details</h3>
          <GlassBadge variant="success">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmed
          </GlassBadge>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confirmation #</span>
            <span className="font-mono font-medium flex items-center gap-2">
              {payment.transactionId}
              <button onClick={copyConfirmation} className="hover:text-primary transition-colors">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium">{booking.service?.name}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium">{booking.business?.name}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">
              {new Date(booking.date).toLocaleDateString('en-KE', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">{booking.startTime}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Staff</span>
            <span className="font-medium">{booking.staff?.name || 'Any Available'}</span>
          </div>

          <div className="h-px bg-border my-2" />

          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="font-bold text-lg gradient-text">${payment.amount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Payment Method</span>
            <span className="uppercase">{payment.paymentMethod}</span>
          </div>
          {isExternalPayment && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Transaction ID</span>
              <span className="font-mono text-xs">{payment.transactionId}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Receipt Actions */}
      <div className="flex gap-3 justify-center">
        <GlassButton variant="outline" onClick={onDownloadReceipt} leftIcon={<Download className="h-4 w-4" />}>
          Receipt
        </GlassButton>
        <GlassButton variant="outline" onClick={onShare} leftIcon={<Share2 className="h-4 w-4" />}>
          Share
        </GlassButton>
      </div>

      {/* What's Next */}
      <div className="text-left space-y-3 p-4 bg-muted/20 rounded-xl">
        <h4 className="font-medium text-sm">What happens next?</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>You&apos;ll receive a confirmation email shortly</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>The service provider will prepare for your appointment</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>You can cancel up to 24 hours before your appointment</span>
          </li>
        </ul>
      </div>
    </motion.div>
  );
};

// ============================================
// ERROR STATE COMPONENT
// ============================================

interface PaymentErrorProps {
  error: string;
  onRetry: () => void;
  onChangeMethod: () => void;
}

const PaymentError: React.FC<PaymentErrorProps> = ({ error, onRetry, onChangeMethod }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6 py-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto"
      >
        <XCircle className="h-12 w-12 text-red-500" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold mb-2 text-red-500">Payment Failed</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">{error}</p>
      </div>

      <div className="flex gap-3 justify-center">
        <GlassButton variant="outline" onClick={onChangeMethod}>
          Change Payment Method
        </GlassButton>
        <GlassButton variant="primary" onClick={onRetry}>
          Try Again
        </GlassButton>
      </div>

      <div className="p-4 bg-muted/20 rounded-xl text-sm text-muted-foreground max-w-sm mx-auto">
        <AlertCircle className="h-4 w-4 inline mr-2" />
        Your card has not been charged. Please try again or use a different payment method.
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN PAYMENT CHECKOUT COMPONENT
// ============================================

export const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
  business,
  service,
  staff,
  date,
  time,
  notes,
  onBack,
  onComplete,
  onCancel,
}) => {
  // RBAC: Block admin and provider-mode users at UI level
  const { user } = useAuthStore();
  const isAdmin = user?.roles?.includes('ADMIN');
  const isProviderMode = user?.activeMode === 'PROVIDER';

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');
  const [tip, setTip] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentState, setPaymentState] = useState<'form' | 'processing' | 'success' | 'error' | 'pending-external'>('form');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [bookingResult, setBookingResult] = useState<Booking | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [formValid, setFormValid] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Polling cleanup ref
  const pendingPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate commission breakdown
  const servicePrice = service.discountPrice || service.price;
  const breakdown = calculateCommission(servicePrice, tip);

  // Generate a mock transaction ID
  const generateTransactionId = () => {
    return `STY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  };

  // Generate a mock booking
  const generateBooking = (): Booking => ({
    id: `booking-${Date.now()}`,
    customerId: 'customer-1',
    businessId: business.id,
    serviceId: service.id,
    staffId: staff?.id,
    date,
    startTime: time,
    endTime: time, // Would calculate based on service duration
    status: 'CONFIRMED',
    notes,
    totalAmount: breakdown.total,
    createdAt: new Date(),
    updatedAt: new Date(),
    business,
    service,
    staff: staff ?? undefined,
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pendingPollingRef.current) {
        clearTimeout(pendingPollingRef.current);
      }
    };
  }, []);

  // Elapsed time counter for pending-external state
  useEffect(() => {
    if (paymentState !== 'pending-external') {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [paymentState]);

  // Start payment polling for external payment methods
  const startPolling = useCallback(async (paymentId: string, bookingData: Record<string, unknown>, endTimeStr: string) => {
    setPendingPaymentId(paymentId);
    setPaymentState('pending-external');
    setIsProcessing(false);

    try {
      const pollResponse = await api.pollPaymentStatus(paymentId);
      const polledData = pollResponse.data;
      const finalStatus = polledData?.status as string;

      if (finalStatus === 'COMPLETED') {
        const booking: Booking = {
          id: bookingData.id as string,
          customerId: (bookingData.customerId as string) || '',
          businessId: business.id,
          serviceId: service.id,
          staffId: staff?.id,
          date,
          startTime: time,
          endTime: endTimeStr,
          status: 'CONFIRMED',
          notes,
          totalAmount: (bookingData.totalAmount as number) || breakdown.total,
          createdAt: bookingData.createdAt ? new Date(bookingData.createdAt as string) : new Date(),
          updatedAt: bookingData.updatedAt ? new Date(bookingData.updatedAt as string) : new Date(),
          business,
          service,
          staff: staff ?? undefined,
        };

        const payment: PaymentResult = {
          id: (polledData.id as string) || `payment-${Date.now()}`,
          success: true,
          amount: (polledData.amount as number) || breakdown.total,
          platformFee: breakdown.platformFee,
          providerAmount: breakdown.providerAmount,
          tip: breakdown.tip,
          currency: (polledData.currency as string) || 'KES',
          paymentMethod,
          transactionId: (polledData.transactionId as string) || generateTransactionId(),
          createdAt: polledData.createdAt ? new Date(polledData.createdAt as string) : new Date(),
          status: 'COMPLETED',
        };

        setPaymentResult(payment);
        setBookingResult(booking);
        setPaymentState('success');
        onComplete?.(booking, payment);
      } else {
        setErrorMessage(
          finalStatus === 'FAILED'
            ? 'Payment was not completed. Please try again or use a different payment method.'
            : `Payment ended with status: ${finalStatus}. Please check your payment status in your dashboard.`
        );
        setPaymentState('error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment verification timed out. Please check your payment status in your dashboard.';
      setErrorMessage(message);
      setPaymentState('error');
    } finally {
      setPendingPaymentId(null);
      setElapsedSeconds(0);
    }
  }, [paymentMethod, business, service, staff, date, time, notes, breakdown, onComplete]);

  // Manual status check button
  const handleCheckStatus = useCallback(async () => {
    if (!pendingPaymentId || isCheckingStatus) return;
    setIsCheckingStatus(true);
    try {
      const response = await api.request<Record<string, unknown>>(`/payments/${pendingPaymentId}`);
      const status = response.data?.status as string;
      if (['COMPLETED', 'FAILED', 'REFUNDED'].includes(status)) {
        // The polling will pick it up on next cycle, or we can force a re-render
        // Simply reset elapsed to show activity
        setElapsedSeconds(0);
      }
    } catch {
      // Silently ignore — polling will handle it
    } finally {
      setIsCheckingStatus(false);
    }
  }, [pendingPaymentId, isCheckingStatus]);

  // UI-level RBAC guard — defense in depth (page.tsx also guards, but this catches direct renders)
  // Placed AFTER all hooks to comply with Rules of Hooks
  if (isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen py-8"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Admin accounts cannot make payments. This action is restricted to customer accounts in Client mode.
            </p>
            <GlassButton variant="default" onClick={onBack || onCancel}>
              Go Back
            </GlassButton>
          </div>
        </div>
      </motion.div>
    );
  }

  if (isProviderMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen py-8"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Switch to Client Mode</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You are currently in Provider mode. Switch to Client mode to make payments.
            </p>
            <GlassButton variant="default" onClick={onBack || onCancel}>
              Go Back
            </GlassButton>
          </div>
        </div>
      </motion.div>
    );
  }

  // Handle payment submission
  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentState('processing');

    try {
      // Step 1: Create the booking via API
      const [hours, minutes] = time.split(':').map(Number);
      const endMinutes = minutes + service.duration;
      const endTimeStr = `${String(hours + Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

      const bookingResponse = await api.createBooking({
        businessId: business.id,
        serviceId: service.id,
        staffId: staff?.id || undefined,
        date,
        startTime: time,
        endTime: endTimeStr,
        notes,
      });

      const bookingData = bookingResponse.data as Record<string, unknown>;
      const bookingId = bookingData.id as string;
      const bookingTotalAmount = (bookingData.totalAmount as number) || breakdown.total;

      // Step 2: Create the payment via API
      const paymentResponse = await api.createPayment({
        bookingId,
        amount: bookingTotalAmount,
        currency: 'KES',
        paymentMethod: PAYMENT_METHOD_MAP[paymentMethod],
      });

      const paymentData = paymentResponse.data as Record<string, unknown>;
      const paymentId = paymentData.id as string;
      const paymentStatus = (paymentData.status as string) || 'COMPLETED';

      // For PayPal / M-Pesa (async): go to pending-external state with polling
      if (paymentMethod !== 'card' && paymentStatus === 'PENDING') {
        setBookingResult({
          id: bookingId,
          customerId: (bookingData.customerId as string) || '',
          businessId: business.id,
          serviceId: service.id,
          staffId: staff?.id,
          date,
          startTime: time,
          endTime: endTimeStr,
          status: 'CONFIRMED',
          notes,
          totalAmount: bookingTotalAmount,
          createdAt: bookingData.createdAt ? new Date(bookingData.createdAt as string) : new Date(),
          updatedAt: bookingData.updatedAt ? new Date(bookingData.updatedAt as string) : new Date(),
          business,
          service,
          staff: staff ?? undefined,
        });
        await startPolling(paymentId, bookingData, endTimeStr);
        return;
      }

      // For Stripe (synchronous) or already-completed: go directly to success
      const payment: PaymentResult = {
        id: paymentId || `payment-${Date.now()}`,
        success: true,
        amount: (paymentData.amount as number) || breakdown.total,
        platformFee: breakdown.platformFee,
        providerAmount: breakdown.providerAmount,
        tip: breakdown.tip,
        currency: (paymentData.currency as string) || 'KES',
        paymentMethod,
        transactionId: (paymentData.transactionId as string) || generateTransactionId(),
        createdAt: paymentData.createdAt ? new Date(paymentData.createdAt as string) : new Date(),
        status: (paymentStatus) as PaymentResult['status'],
      };

      // Build booking object for onComplete and success screen
      const booking: Booking = {
        id: bookingId,
        customerId: (bookingData.customerId as string) || '',
        businessId: business.id,
        serviceId: service.id,
        staffId: staff?.id,
        date,
        startTime: time,
        endTime: endTimeStr,
        status: 'CONFIRMED',
        notes,
        totalAmount: bookingTotalAmount,
        createdAt: bookingData.createdAt ? new Date(bookingData.createdAt as string) : new Date(),
        updatedAt: bookingData.updatedAt ? new Date(bookingData.updatedAt as string) : new Date(),
        business,
        service,
        staff: staff ?? undefined,
      };

      setPaymentResult(payment);
      setBookingResult(booking);
      setPaymentState('success');

      onComplete?.(booking, payment);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed. Please try again.';
      setErrorMessage(message);
      setPaymentState('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle retry
  const handleRetry = () => {
    setPaymentState('form');
    setErrorMessage('');
  };

  // Handle download receipt
  const handleDownloadReceipt = () => {
    // Mock receipt download
    // Receipt download placeholder
  };

  // Handle share
  const handleShare = () => {
    // Mock share functionality
    if (navigator.share) {
      navigator.share({
        title: 'Styra Booking Confirmation',
        text: `My booking at ${business.name} is confirmed!`,
        url: window.location.href,
      });
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen py-8"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title - No back button since Navbar handles navigation */}
        {paymentState !== 'success' && paymentState !== 'error' && paymentState !== 'pending-external' && (
          <FadeIn>
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Complete Payment</h1>
              <p className="text-muted-foreground">{business.name}</p>
            </div>
          </FadeIn>
        )}

        {/* Main Content Grid */}
        {paymentState === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Payment Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Service Summary Card */}
              <FadeIn delay={0.1}>
                <GlassCard variant="elevated" className="p-5">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Service Details
                  </h2>

                  <div className="flex gap-4">
                    {/* Service Image */}
                    <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {service.imageUrl ? (
                        <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                      ) : (
                        <Star className="h-8 w-8 text-primary/40" />
                      )}
                    </div>

                    {/* Service Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{service.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {service.duration} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {time}
                        </span>
                      </div>
                      {staff && (
                        <div className="flex items-center gap-2 mt-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{staff.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>

              {/* Payment Method Selection */}
              <FadeIn delay={0.2}>
                <GlassCard variant="elevated" className="p-5">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payment Method
                  </h2>

                  <div className="space-y-3">
                    <PaymentMethodCard
                      type="card"
                      selected={paymentMethod === 'card'}
                      onSelect={() => setPaymentMethod('card')}
                    />
                    <PaymentMethodCard
                      type="paypal"
                      selected={paymentMethod === 'paypal'}
                      onSelect={() => setPaymentMethod('paypal')}
                    />
                    <PaymentMethodCard
                      type="mpesa"
                      selected={paymentMethod === 'mpesa'}
                      onSelect={() => setPaymentMethod('mpesa')}
                    />
                  </div>

                  {/* Payment Method Specific Inputs */}
                  <AnimatePresence mode="wait">
                    {paymentMethod === 'card' && (
                      <motion.div
                        key="card"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <CardForm onValidChange={setFormValid} />
                      </motion.div>
                    )}
                    {paymentMethod === 'paypal' && (
                      <motion.div
                        key="paypal"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <PayPalInput onValidChange={setFormValid} />
                      </motion.div>
                    )}
                    {paymentMethod === 'mpesa' && (
                      <motion.div
                        key="mpesa"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <MpesaInput onValidChange={setFormValid} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </FadeIn>

              {/* Tip Section */}
              <FadeIn delay={0.3}>
                <GlassCard variant="elevated" className="p-5">
                  <TipSelector
                    servicePrice={servicePrice}
                    selectedTip={tip}
                    onTipChange={setTip}
                  />
                </GlassCard>
              </FadeIn>

              {/* Security Notice */}
              <FadeIn delay={0.4}>
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                  <Lock className="h-5 w-5 text-primary" />
                  <div className="text-sm">
                    <span className="font-medium">Secure Checkout</span>
                    <span className="text-muted-foreground"> — Your payment info is encrypted and secure</span>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Right Column - Price Summary */}
            <div className="lg:col-span-1">
              <FadeIn delay={0.3}>
                <div className="sticky top-8">
                  <GlassCard variant="bordered" className="p-5">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      Price Details
                    </h2>

                    <PriceBreakdown breakdown={breakdown} />

                    <div className="mt-6 space-y-3">
                      <GlassButton
                        variant="primary"
                        size="lg"
                        className="w-full"
                        onClick={handlePayment}
                        disabled={!formValid || isProcessing}
                        isLoading={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : `Pay KSh ${breakdown.total.toFixed(2)}`}
                        {!isProcessing && <ChevronRight className="h-4 w-4 ml-1" />}
                      </GlassButton>

                      <GlassButton
                        variant="ghost"
                        size="md"
                        className="w-full"
                        onClick={onCancel}
                      >
                        Cancel
                      </GlassButton>
                    </div>

                    {/* Cancellation Policy */}
                    <div className="mt-4 p-3 bg-muted/20 rounded-lg text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Cancellation Policy</p>
                      <p>Free cancellation up to 24 hours before your appointment. After that, a cancellation fee may apply.</p>
                    </div>
                  </GlassCard>
                </div>
              </FadeIn>
            </div>
          </div>
        )}

        {/* Processing State */}
        {paymentState === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary mb-6"
            />
            <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground text-center max-w-sm">
              Please wait while we securely process your payment. Do not close this page.
            </p>
          </motion.div>
        )}

        {/* Pending External Payment State (PayPal / M-Pesa) */}
        {paymentState === 'pending-external' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto"
          >
            <GlassCard variant="elevated" className="p-8 text-center space-y-6">
              {/* Pulsing Icon */}
              <div className="relative mx-auto w-fit">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                    paymentMethod === 'paypal'
                      ? 'bg-[#0070ba]/10'
                      : 'bg-green-500/10'
                  }`
                }
                >
                  {paymentMethod === 'paypal' ? (
                    <Wallet className="h-10 w-10 text-[#0070ba]" />
                  ) : (
                    <Smartphone className="h-10 w-10 text-green-600" />
                  )}
                </motion.div>
                {/* Animated ring */}
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className={`absolute inset-0 rounded-full border-2 ${
                    paymentMethod === 'paypal' ? 'border-[#0070ba]/30' : 'border-green-500/30'
                  }`}
                />
              </div>

              {/* Title & Description */}
              <div>
                <h2 className="text-xl font-bold mb-2">Waiting for Payment</h2>
                <p className="text-muted-foreground">
                  {paymentMethod === 'paypal'
                    ? 'Complete your payment on PayPal. We\'ll verify it automatically.'
                    : 'Check your phone for the M-Pesa payment prompt (STK Push).'
                  }
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>Elapsed: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      paymentMethod === 'paypal' ? 'bg-[#0070ba]' : 'bg-green-500'
                    }`}
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.min((elapsedSeconds / 120) * 100, 100)}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Usually takes 30–60 seconds</p>
              </div>

              {/* Info Box */}
              <div className={`p-4 rounded-lg text-sm text-left space-y-2 ${
                paymentMethod === 'paypal'
                  ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200'
                  : 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">
                    {paymentMethod === 'paypal' ? 'PayPal' : 'M-Pesa'} Secure Payment
                  </span>
                </div>
                <p>
                  {paymentMethod === 'paypal'
                    ? 'If you closed the PayPal window, you can still complete the payment from your PayPal account. We will verify it once confirmed.'
                    : 'Enter your M-Pesa PIN when prompted on your phone to complete the payment. Do not close this page.'}
                </p>
              </div>

              {/* Manual Check Button */}
              <GlassButton
                variant="outline"
                className="w-full"
                onClick={handleCheckStatus}
                disabled={isCheckingStatus}
                isLoading={isCheckingStatus}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                {isCheckingStatus ? 'Checking...' : 'Check Status'}
              </GlassButton>
            </GlassCard>
          </motion.div>
        )}

        {/* Success State */}
        {paymentState === 'success' && paymentResult && (
          <div className="max-w-lg mx-auto">
            <PaymentSuccess
              booking={bookingResult || generateBooking()}
              payment={paymentResult}
              onDownloadReceipt={handleDownloadReceipt}
              onShare={handleShare}
            />
          </div>
        )}

        {/* Error State */}
        {paymentState === 'error' && (
          <div className="max-w-lg mx-auto">
            <PaymentError
              error={errorMessage}
              onRetry={handleRetry}
              onChangeMethod={handleRetry}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// RECEIPT MODAL COMPONENT
// ============================================

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  payment: PaymentResult;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  booking,
  payment,
}) => {
  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Payment Receipt" size="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center mx-auto mb-3">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <BrandLogo variant="wordmark" size={20} className="pointer-events-none" />
          <p className="text-sm text-muted-foreground">Payment Receipt</p>
        </div>

        {/* Transaction Details */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transaction ID</span>
            <span className="font-mono">{payment.transactionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>{payment.createdAt.toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span>{payment.createdAt.toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="uppercase">{payment.paymentMethod}</span>
          </div>
        </div>

        {/* Service Details */}
        <div className="p-4 bg-muted/20 rounded-lg space-y-2">
          <div className="font-medium">{booking.service?.name}</div>
          <div className="text-sm text-muted-foreground">{booking.business?.name}</div>
          <div className="text-sm text-muted-foreground">
            {new Date(booking.date).toLocaleDateString()} at {booking.startTime}
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service Amount</span>
            <span>${(payment.amount - payment.tip).toFixed(2)}</span>
          </div>
          {payment.tip > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tip</span>
              <span>${payment.tip.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform Fee</span>
            <span>-${payment.platformFee.toFixed(2)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="gradient-text">${payment.amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <GlassButton variant="outline" className="flex-1" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </GlassButton>
          <GlassButton variant="primary" className="flex-1" onClick={onClose}>
            Done
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};

// ============================================
// COMMISSION INFO COMPONENT
// ============================================

interface CommissionInfoProps {
  servicePrice: number;
}

export const CommissionInfo: React.FC<CommissionInfoProps> = ({ servicePrice }) => {
  const breakdown = calculateCommission(servicePrice);

  return (
    <GlassCard variant="default" className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Commission Breakdown</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-primary/5 rounded-lg text-center">
            <div className="text-2xl font-bold gradient-text">
              {breakdown.providerPercentage}%
            </div>
            <div className="text-sm text-muted-foreground">Provider Receives</div>
            <div className="text-lg font-semibold mt-1">
              ${breakdown.providerAmount.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {breakdown.platformFeePercentage}%
            </div>
            <div className="text-sm text-muted-foreground">Platform Fee</div>
            <div className="text-lg font-semibold mt-1">
              ${breakdown.platformFee.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>The platform fee helps us maintain and improve Styra, including:</p>
          <ul className="list-disc list-inside ml-2 space-y-0.5">
            <li>Payment processing and security</li>
            <li>Customer support and dispute resolution</li>
            <li>Marketing and exposure for your business</li>
            <li>Platform development and features</li>
          </ul>
        </div>
      </div>
    </GlassCard>
  );
};

// ============================================
// EXPORTS
// ============================================

export default PaymentCheckout;
