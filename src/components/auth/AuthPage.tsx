'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  User, 
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronLeft,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Copy,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { PhoneInput } from '@/components/ui/custom/PhoneInput';
import { BrandLogo } from '@/components/ui/brand-logo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import type { User as UserType, UserRole, UserMode } from '@/types';
import { normalizeRole } from '@/lib/rbac';

// ============================================
// PASSWORD STRENGTH CALCULATOR
// ============================================
type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const score = Object.values(requirements).filter(Boolean).length;
  
  let strength: PasswordStrength;
  if (score <= 2) strength = 'weak';
  else if (score === 3) strength = 'fair';
  else if (score === 4) strength = 'good';
  else strength = 'strong';

  return { strength, score, requirements };
}

// ============================================
// VALIDATION ERROR MESSAGES
// ============================================
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'No account found with this email. Please sign up.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak. Please use a stronger password.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/network-error': 'Network error. Please check your connection.',
  'auth/invalid-credentials': 'Invalid email or password. Please try again.',
  'auth/session-expired': 'Your session has expired. Please sign in again.',
  
  // Validation errors
  'validation/required': 'This field is required.',
  'validation/email': 'Please enter a valid email address.',
  'validation/phone': 'Please enter a valid phone number.',
  'validation/password-length': 'Password must be at least 8 characters.',
  'validation/password-strength': 'Password must contain uppercase, lowercase, and numbers.',
  'validation/name-length': 'Name must be at least 2 characters.',
  'validation/otp-length': 'Please enter all 6 digits.',
  
  // Generic errors
  'unknown': 'An unexpected error occurred. Please try again.',
};

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES['unknown'];
}

interface AuthPageProps {
  mode: 'login' | 'register';
  onLogin?: (user: UserType) => void;
  onNavigate?: (page: string) => void;
}

// Apple Icon Component
const AppleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

// Google Icon Component
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ============================================
// FORM VALIDATION INTERFACE
// ============================================
interface FormErrors {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
}

// ============================================
// PASSWORD STRENGTH INDICATOR COMPONENT
// ============================================
const PasswordStrengthIndicator: React.FC<{ password: string }> = React.memo(({ password }) => {
  const { strength, score, requirements } = useMemo(() => 
    calculatePasswordStrength(password), [password]
  );

  if (!password) return null;

  const strengthColors: Record<PasswordStrength, string> = {
    weak: 'bg-red-500',
    fair: 'bg-orange-500',
    good: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const strengthLabels: Record<PasswordStrength, string> = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
  };

  return (
    <div className="mt-2 space-y-2" role="status" aria-live="polite">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full transition-all duration-300', strengthColors[strength])}
            style={{ width: `${(score / 5) * 100}%` }}
            aria-label={`Password strength: ${strengthLabels[strength]}`}
          />
        </div>
        <span className={cn('text-xs font-medium', 
          strength === 'weak' && 'text-red-500',
          strength === 'fair' && 'text-orange-500',
          strength === 'good' && 'text-yellow-500',
          strength === 'strong' && 'text-green-500'
        )}>
          {strengthLabels[strength]}
        </span>
      </div>
      
      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        <RequirementMet met={requirements.length} label="8+ characters" />
        <RequirementMet met={requirements.uppercase} label="Uppercase" />
        <RequirementMet met={requirements.lowercase} label="Lowercase" />
        <RequirementMet met={requirements.number} label="Number" />
        <RequirementMet met={requirements.special} label="Special char" />
      </div>
    </div>
  );
});
PasswordStrengthIndicator.displayName = 'PasswordStrengthIndicator';

// ============================================
// REQUIREMENT MET COMPONENT
// ============================================
const RequirementMet: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <div className={cn('flex items-center gap-1', met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
    {met ? <CheckCircle className="h-3 w-3" aria-hidden="true" /> : <XCircle className="h-3 w-3" aria-hidden="true" />}
    <span>{label}</span>
  </div>
);

export const AuthPage: React.FC<AuthPageProps> = ({
  mode,
  onLogin,
  onNavigate,
}) => {
  const { login: storeLogin } = useAuthStore();
  const [currentMode, setCurrentMode] = useState(mode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  
  // OTP states
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const registeredUserData = useRef<{ id: string; email: string; name: string; role: string } | null>(null);

  // Derive canResend from otpTimer instead of separate state
  const canResend = otpTimer === 0 && step === 2;

  // Timer for OTP resend
  useEffect(() => {
    if (step !== 2 || otpTimer <= 0) return;
    
    const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, otpTimer]);

  // Clear errors when switching modes
  useEffect(() => {
    setError('');
    setOtpError('');
    setFieldErrors({});
    setTouched({});
  }, [currentMode, step]);

  // Validate email
  const isValidEmail = useCallback((emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  }, []);

  // Validate phone (basic validation)
  const isValidPhone = useCallback((phoneStr: string) => {
    const cleaned = phoneStr.replace(/\D/g, '');
    return cleaned.length >= 10;
  }, []);

  // Validate password - updated to match registration requirements
  const isValidPassword = useCallback((pwd: string) => {
    return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);
  }, []);

  // Validate single field
  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case 'email':
        if (!value) return getErrorMessage('validation/required');
        if (!isValidEmail(value)) return getErrorMessage('validation/email');
        break;
      case 'password':
        if (!value) return getErrorMessage('validation/required');
        if (value.length < 8) return getErrorMessage('validation/password-length');
        break;
      case 'name':
        if (!value) return getErrorMessage('validation/required');
        if (value.length < 2) return getErrorMessage('validation/name-length');
        break;
      case 'phone':
        if (!value) return getErrorMessage('validation/required');
        if (!isValidPhone(value)) return getErrorMessage('validation/phone');
        break;
    }
    return undefined;
  }, [isValidEmail, isValidPhone]);

  // Handle field blur for validation
  const handleFieldBlur = useCallback((field: string, value: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const fieldError = validateField(field, value);
    setFieldErrors(prev => ({ ...prev, [field]: fieldError }));
  }, [validateField]);

  // Handle field change with optional real-time validation
  const handleFieldChange = useCallback((field: string, value: string, validate: boolean = false) => {
    // Update the field value
    switch (field) {
      case 'email': setEmail(value); break;
      case 'password': setPassword(value); break;
      case 'name': setName(value); break;
      case 'phone': setPhone(value); break;
    }
    
    // Clear error on change
    if (fieldErrors[field as keyof FormErrors]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Validate if field was touched
    if (touched[field] || validate) {
      const fieldError = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: fieldError }));
    }
  }, [fieldErrors, touched, validateField]);

  // Handle sign in — calls real backend API
  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.login(email, password);
      const data = response.data;

      const normalizedRole = normalizeRole(data.role);
      const user: UserType = {
        id: data.id,
        email: data.email,
        name: data.name || email.split('@')[0],
        role: normalizedRole,
        roles: [normalizedRole],
        activeMode: (normalizedRole === 'ADMIN' ? 'ADMIN' : normalizedRole === 'BUSINESS_OWNER' ? 'PROVIDER' : 'CLIENT') as UserMode,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Update auth store (session cookie is set by the API)
      storeLogin(user, 'session');

      toast.success('Welcome back!');
      onLogin?.(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle social sign in — placeholder with coming-soon toast
  const handleSocialSignIn = async (_provider: 'google' | 'apple' | 'phone') => {
    toast.info('Social sign-in coming soon!');
  };

  // Handle continue to OTP — calls real register API (which also sends the OTP)
  const handleContinueToOtp = async () => {
    setError('');

    if (!name || !email || !phone || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isValidPhone(phone)) {
      setError('Please enter a valid phone number');
      return;
    }

    if (!isValidPassword(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }

    setIsLoading(true);

    try {
      // Register API creates user, sets session cookie, and generates OTP
      const response = await api.register({ email, password, name, phone });
      const regData = response.data as { id: string; email: string; name: string; role: string; otpCode?: string };
      registeredUserData.current = regData;

      // If OTP code is returned (no SMS provider), auto-fill it
      if (regData.otpCode) {
        const digits = regData.otpCode.split('');
        setOtp(digits);
        toast.success(`Your verification code is: ${regData.otpCode}`);
      }

      setIsOtpSent(true);
      setOtpTimer(60);
      setStep(2);

      // Focus first OTP input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (!canResend || !phone) return;

    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setOtpTimer(60);
    setIsLoading(true);

    try {
      const response = await api.resendOTP(phone);
      const data = response.data as { otpCode?: string; alreadyVerified?: boolean };

      if (data?.alreadyVerified) {
        toast.success('Phone number is already verified!');
        return;
      }

      // Auto-fill the new OTP code
      if (data?.otpCode) {
        const digits = data.otpCode.split('');
        setOtp(digits);
        toast.success(`New verification code: ${data.otpCode}`);
      } else {
        toast.success('New verification code sent!');
      }

      inputRefs.current[0]?.focus();
    } catch {
      setOtpError('Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP change
  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits are entered
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  // Handle OTP key down
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handleOTPKeyDownGlobal = (e: React.KeyboardEvent) => {
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        
        const lastIndex = Math.min(digits.length, 5);
        inputRefs.current[lastIndex]?.focus();
        
        if (newOtp.every(d => d !== '')) {
          handleVerifyOtp(newOtp.join(''));
        }
      });
    }
  };

  // Handle verify OTP — calls real backend API
  const handleVerifyOtp = async (otpCode: string) => {
    setOtpError('');
    setIsLoading(true);

    try {
      await api.verifyOTP(phone, otpCode);

      // Use user data stored from the register response
      const regData = registeredUserData.current;
      const user: UserType = {
        id: regData?.id || `user-${Date.now()}`,
        email: regData?.email || email,
        name: regData?.name || name,
        phone,
        role: (regData?.role || 'CUSTOMER') as UserRole,
        roles: [(regData?.role || 'CUSTOMER') as UserRole],
        activeMode: ((regData?.role || 'CUSTOMER') === 'ADMIN' ? 'ADMIN' : (regData?.role || 'CUSTOMER') === 'BUSINESS_OWNER' ? 'PROVIDER' : 'CLIENT') as UserMode,
        phoneVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Update auth store (session cookie was already set by register API)
      storeLogin(user, 'session');

      toast.success('Account created successfully!');
      onLogin?.(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid verification code. Please try again.';
      setOtpError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Format phone for display
  const formatPhoneForDisplay = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center py-12 px-4 hero-pattern"
    >
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

      <div className="w-full max-w-md relative">
        {/* Back Button */}
        <FadeIn>
          <button
            onClick={() => step === 2 ? setStep(1) : onNavigate?.('home')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 2 ? 'Back to registration' : 'Back to Home'}
          </button>
        </FadeIn>

        <FadeIn delay={0.1}>
          <GlassCard variant="elevated" className="p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-2">
                <BrandLogo variant="full" size="authPage" />
              </div>
              <p className="text-muted-foreground">
                {currentMode === 'login' 
                  ? 'Welcome back! Please sign in to continue.'
                  : step === 2 
                    ? 'Verify your phone number'
                    : 'Create your account to get started.'}
              </p>
            </div>

            {/* Mode Toggle - Only show on step 1 */}
            {step === 1 && (
              <div className="flex gap-2 p-1 rounded-lg bg-muted/50 mb-6">
                <button
                  onClick={() => setCurrentMode('login')}
                  className={cn(
                    'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                    currentMode === 'login'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setCurrentMode('register')}
                  className={cn(
                    'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                    currentMode === 'register'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Login Form */}
            {currentMode === 'login' && step === 1 && (
              <motion.form
                ref={formRef}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
                aria-label="Sign in form"
                noValidate
              >
                <div>
                  <label htmlFor="login-email" className="text-sm font-medium mb-2 block">
                    Email <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <GlassInput
                    id="login-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email', email)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    error={touched.email ? fieldErrors.email : undefined}
                    aria-invalid={touched.email && !!fieldErrors.email}
                    aria-describedby={touched.email && fieldErrors.email ? 'email-error' : undefined}
                    autoComplete="email"
                    required
                  />
                  {touched.email && fieldErrors.email && (
                    <p id="email-error" className="sr-only" role="alert">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="login-password" className="text-sm font-medium mb-2 block">
                    Password <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <GlassInput
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      onBlur={() => handleFieldBlur('password', password)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                      error={touched.password ? fieldErrors.password : undefined}
                      aria-invalid={touched.password && !!fieldErrors.password}
                      aria-describedby={touched.password && fieldErrors.password ? 'password-error' : undefined}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-0 h-11 flex items-center text-foreground/50 hover:text-foreground/80 transition-colors z-10"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p id="password-error" className="sr-only" role="alert">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer">
                    <input 
                      id="remember-me"
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-input accent-primary" 
                      aria-describedby="remember-me-desc"
                    />
                    <span>Remember me</span>
                  </label>
                  <span id="remember-me-desc" className="sr-only">Keep me signed in on this device</span>
                  <button 
                    type="button" 
                    onClick={() => onNavigate?.('forgot-password')} 
                    className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  >
                    Forgot password?
                  </button>
                </div>

                <GlassButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isLoading}
                  aria-busy={isLoading}
                >
                  Sign In
                  <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </GlassButton>

                <div className="relative my-6" role="separator" aria-label="Or continue with">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3" role="group" aria-label="Social sign in options">
                  <GlassButton 
                    type="button"
                    variant="default" 
                    className="w-full"
                    onClick={() => handleSocialSignIn('google')}
                    disabled={isLoading}
                    aria-label="Sign in with Google"
                  >
                    <GoogleIcon />
                  </GlassButton>
                  <GlassButton 
                    type="button"
                    variant="default" 
                    className="w-full"
                    onClick={() => handleSocialSignIn('apple')}
                    disabled={isLoading}
                    aria-label="Sign in with Apple"
                  >
                    <AppleIcon />
                  </GlassButton>
                  <GlassButton 
                    type="button"
                    variant="default" 
                    className="w-full"
                    onClick={() => handleSocialSignIn('phone')}
                    disabled={isLoading}
                    aria-label="Sign in with phone"
                  >
                    <Phone className="h-5 w-5" aria-hidden="true" />
                  </GlassButton>
                </div>
              </motion.form>
            )}

            {/* Register Form - Step 1 */}
            {currentMode === 'register' && step === 1 && (
              <motion.form
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); handleContinueToOtp(); }}
                aria-label="Create account form"
                noValidate
              >
                <div>
                  <label htmlFor="register-name" className="text-sm font-medium mb-2 block">
                    Full Name <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <GlassInput
                    id="register-name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleFieldBlur('name', name)}
                    leftIcon={<User className="h-4 w-4" aria-hidden="true" />}
                    error={touched.name ? fieldErrors.name : undefined}
                    aria-invalid={touched.name && !!fieldErrors.name}
                    aria-describedby={touched.name && fieldErrors.name ? 'name-error' : undefined}
                    autoComplete="name"
                    required
                  />
                  {touched.name && fieldErrors.name && (
                    <p id="name-error" className="sr-only" role="alert">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="register-email" className="text-sm font-medium mb-2 block">
                    Email <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <GlassInput
                    id="register-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email', email)}
                    leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    error={touched.email ? fieldErrors.email : undefined}
                    aria-invalid={touched.email && !!fieldErrors.email}
                    aria-describedby={touched.email && fieldErrors.email ? 'register-email-error' : undefined}
                    autoComplete="email"
                    required
                  />
                  {touched.email && fieldErrors.email && (
                    <p id="register-email-error" className="sr-only" role="alert">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="register-phone" className="text-sm font-medium mb-2 block">
                    Phone Number <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <PhoneInput
                    value={phone}
                    onChange={(value) => handleFieldChange('phone', value)}
                    placeholder="+254 7XX XXX XXX"
                  />
                  {touched.phone && fieldErrors.phone ? (
                    <p id="phone-error" className="text-xs text-destructive mt-1" role="alert">{fieldErrors.phone}</p>
                  ) : (
                    <p id="phone-hint" className="text-xs text-muted-foreground mt-1">
                      Auto-formatted with country code • We&apos;ll send you a verification code
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="register-password" className="text-sm font-medium mb-2 block">
                    Password <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <GlassInput
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      onBlur={() => handleFieldBlur('password', password)}
                      leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                      error={touched.password ? fieldErrors.password : undefined}
                      aria-invalid={touched.password && !!fieldErrors.password}
                      aria-describedby={touched.password && fieldErrors.password ? 'register-password-error' : 'password-requirements'}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-0 h-11 flex items-center text-foreground/50 hover:text-foreground/80 transition-colors z-10"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p id="register-password-error" className="sr-only" role="alert">{fieldErrors.password}</p>
                  )}
                  <div id="password-requirements">
                    <PasswordStrengthIndicator password={password} />
                  </div>
                </div>

                <GlassButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isLoading}
                  disabled={!name || !email || !phone || !password}
                  aria-busy={isLoading}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </GlassButton>

                <p className="text-center text-sm text-muted-foreground">
                  By creating an account, you agree to our{' '}
                  <button 
                    type="button" 
                    onClick={() => onNavigate?.('terms')} 
                    className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  >
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button 
                    type="button" 
                    onClick={() => onNavigate?.('privacy')} 
                    className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  >
                    Privacy Policy
                  </button>
                </p>
              </motion.form>
            )}

            {/* OTP Verification - Step 2 */}
            {currentMode === 'register' && step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
                onKeyDown={handleOTPKeyDownGlobal}
                role="form"
                aria-label="Phone verification"
              >
                <div className="text-center mb-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center mx-auto mb-4 shadow-glow"
                    aria-hidden="true"
                  >
                    <Phone className="h-8 w-8 text-white" />
                  </motion.div>
                  <h3 className="font-semibold mb-2 text-lg">Verify Phone Number</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to
                  </p>
                  <p className="text-sm font-medium">{formatPhoneForDisplay(phone)}</p>
                </div>

                {/* OTP code display — shown when OTP is returned by API (no SMS provider) */}
                {otp.every(d => d !== '') && isOtpSent && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 mb-4"
                  >
                    <span className="text-sm font-medium text-primary">Your code:</span>
                    <span className="text-lg font-mono font-bold tracking-widest text-primary">{otp.join('')}</span>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(otp.join('')); toast.success('Code copied!'); }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Copy verification code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}

                {/* OTP Input */}
                <div 
                  className="flex justify-center gap-2 mb-6" 
                  role="group" 
                  aria-label="Enter 6-digit verification code"
                >
                  {otp.map((digit, index) => (
                    <motion.input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'w-12 h-14 text-center text-xl font-bold rounded-xl',
                        'border-2 transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50',
                        digit 
                          ? 'border-primary bg-primary/5' 
                          : 'border-input hover:border-primary/30',
                        otpError && 'border-destructive'
                      )}
                      aria-label={`Digit ${index + 1} of 6`}
                      aria-invalid={!!otpError}
                    />
                  ))}
                </div>

                {/* Error message */}
                {otpError && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm text-destructive"
                    role="alert"
                    aria-live="assertive"
                  >
                    {otpError}
                  </motion.p>
                )}

                {/* Timer and Resend */}
                <div className="text-center">
                  {canResend ? (
                    <GlassButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="gap-2"
                      aria-label="Resend verification code"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Resend Code
                    </GlassButton>
                  ) : (
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      Resend code in <span className="font-medium text-foreground">{otpTimer}s</span>
                    </p>
                  )}
                </div>

                {/* Hint */}
                <p className="text-center text-xs text-muted-foreground">
                  Enter the code sent to your phone to verify your account
                </p>

                <GlassButton
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => handleVerifyOtp(otp.join(''))}
                  isLoading={isLoading}
                  disabled={otp.some(d => d === '')}
                  aria-busy={isLoading}
                >
                  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  Verify & Create Account
                </GlassButton>

                <GlassButton
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  onClick={() => setStep(1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                  Back
                </GlassButton>
              </motion.div>
            )}
          </GlassCard>
        </FadeIn>
      </div>
    </motion.div>
  );
};

export default AuthPage;
