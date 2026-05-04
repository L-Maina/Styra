'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  FileText,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  MapPin,
  Globe,
  Phone,
  Mail,
  Shield,
  ChevronRight,
  ChevronLeft,
  X,
  Lock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { PhoneInput } from '@/components/ui/custom/PhoneInput';
import { LocationAutocomplete } from '@/components/ui/custom/LocationAutocomplete';
import { cn } from '@/lib/utils';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';
import type { User } from '@/types';

interface BusinessOnboardingProps {
  onComplete?: (user: User) => void;
}

type Step = 'business' | 'id' | 'review';

const idTypes = [
  { value: 'PASSPORT', label: 'Passport', icon: '📘' },
  { value: 'NATIONAL_ID', label: 'National ID', icon: '🪪' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License", icon: '🚗' },
];

export const BusinessOnboarding: React.FC<BusinessOnboardingProps> = ({
  onComplete,
}) => {
  const { user, updateUser } = useAuthStore();

  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [services] = useState<Array<{
    name: string;
    description: string;
    category: string;
    duration: number;
    price: number;
    discountPrice?: number;
  }>>([]);

  // ── Fetch fresh verification status from server on mount ────────────
  // The Zustand store is persisted to localStorage and can become stale.
  // When admin approves/rejects a business, the DB is updated but the
  // client store is not. This effect fetches the authoritative status.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getProfile();
        if (cancelled || !result.success || !result.data) return;
        const serverUser = result.data as Record<string, unknown>;
        const serverStatus = serverUser.businessVerificationStatus as string | undefined;
        if (serverStatus && serverStatus !== user?.businessVerificationStatus) {
          // Server has a different status — update the store
          updateUser({
            businessVerificationStatus: serverStatus as any,
            role: (serverUser.role as string) || user?.role,
            roles: (serverUser.roles as string[]) || user?.roles,
            activeMode: (serverUser.activeMode as string) || user?.activeMode,
            businessName: (serverUser.businessName as string) || user?.businessName,
          } as any);
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Check if already submitted based on user's business verification status
  // APPROVED, VERIFIED, and AUTO_VERIFIED all mean the business is active
  const hasSubmitted = !!user?.businessVerificationStatus;
  const isVerified = ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'].includes(
    user?.businessVerificationStatus || ''
  );
  const isRejected = user?.businessVerificationStatus === 'REJECTED';
  const isPending = user?.businessVerificationStatus === 'PENDING';
  const isIdLocked = isVerified || isPending;
  
  // Business details
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [businessDescription, setBusinessDescription] = useState(user?.businessDescription || '');
  const [businessAddress, setBusinessAddress] = useState(user?.businessAddress || '');
  const [businessCity, setBusinessCity] = useState(user?.businessCity || '');
  const [businessCountry, setBusinessCountry] = useState(user?.businessCountry || '');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState(user?.businessWebsite || '');
  
  // ID Verification - locked if already submitted
  const [idType, setIdType] = useState<'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE'>(
    user?.idType || 'PASSPORT'
  );
  const [idNumber, setIdNumber] = useState(user?.idNumber || '');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [idDocumentPreview, setIdDocumentPreview] = useState<string | null>(
    user?.idDocumentUrl || null
  );

  // Booth photo
  const [boothPhoto, setBoothPhoto] = useState<File | null>(null);
  const [boothPhotoPreview, setBoothPhotoPreview] = useState<string | null>(null);

  const steps: { id: Step; label: string }[] = [
    { id: 'business', label: 'Business Details' },
    { id: 'id', label: 'ID Verification' },
    { id: 'review', label: 'Review & Submit' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)) {
        setError('Please upload a valid image (JPG, PNG) or PDF file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      setIdDocument(file);
      setError('');
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setIdDocumentPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setIdDocumentPreview(null);
      }
    }
  };

  const handleBoothPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        setError('Please upload a valid image (JPG, PNG)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setBoothPhoto(file);
      setError('');
      const reader = new FileReader();
      reader.onload = (e) => {
        setBoothPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateBusinessStep = () => {
    if (!businessName.trim()) {
      setError('Business name is required');
      return false;
    }
    if (!businessAddress.trim()) {
      setError('Business address is required');
      return false;
    }
    if (!businessCity.trim()) {
      setError('City is required');
      return false;
    }
    return true;
  };

  const validateIdStep = () => {
    if (!idNumber.trim()) {
      setError('ID number is required');
      return false;
    }
    if (!idDocument) {
      setError('Please upload your ID document');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    
    if (currentStep === 'business') {
      if (!validateBusinessStep()) return;
      setCurrentStep('id');
    } else if (currentStep === 'id') {
      if (!validateIdStep()) return;
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    setError('');
    if (currentStep === 'id') {
      setCurrentStep('business');
    } else if (currentStep === 'review') {
      setCurrentStep('id');
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Clean website: add protocol if missing
      let cleanWebsite: string | undefined = businessWebsite?.trim() || undefined;
      if (cleanWebsite && !cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
        cleanWebsite = `https://${cleanWebsite}`;
      }

      // Upload ID document
      let idDocumentUrl: string | undefined;
      if (idDocument) {
        try {
          const uploadResult = await api.uploadFile(idDocument, 'id-document');
          idDocumentUrl = uploadResult.data?.url;
        } catch (uploadErr) {
          console.error('Failed to upload ID document:', uploadErr);
          toast.error('Failed to upload ID document. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      // Upload booth photo
      let boothPhotoUrl: string | undefined;
      if (boothPhoto) {
        try {
          const uploadResult = await api.uploadFile(boothPhoto, 'booth-photo');
          boothPhotoUrl = uploadResult.data?.url;
        } catch (uploadErr) {
          console.error('Failed to upload booth photo:', uploadErr);
          toast.error('Failed to upload booth photo. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      // Create business via real API
      const result = await api.createBusiness({
        name: businessName,
        description: businessDescription || undefined,
        address: businessAddress,
        city: businessCity,
        country: businessCountry || 'N/A',
        phone: businessPhone || undefined,
        email: businessEmail || undefined,
        website: cleanWebsite,
        serviceRadius: 10,
        // ID verification fields
        idType,
        idNumber,
        idDocumentUrl,
        boothPhotoUrl,
      });

      // Check if the business was auto-verified
      const autoVerify = (result.data as any)?._autoVerify;
      const wasAutoVerified = autoVerify?.autoVerified === true;
      const autoVerifyMessage = autoVerify?.message;

      // Create services if any were added
      for (const service of services) {
        await api.createService({
          businessId: (result.data as { id: string }).id,
          name: service.name,
          description: service.description,
          category: service.category,
          duration: service.duration,
          price: service.price,
          discountPrice: service.discountPrice || undefined,
        });
      }

      // Update user in local store with business verification status
      const verificationStatus = wasAutoVerified ? 'APPROVED' : 'PENDING';
      const updatedUser: User = {
        ...user,
        businessName,
        businessDescription,
        businessAddress,
        businessCity,
        businessCountry,
        businessWebsite,
        businessVerificationStatus: verificationStatus,
        // If auto-verified, also update the role
        ...(wasAutoVerified
          ? {
              role: 'BUSINESS_OWNER' as const,
              roles: [...(user.roles || []), 'BUSINESS_OWNER' as const].filter(
                (v, i, a) => a.indexOf(v) === i
              ),
              activeMode: 'PROVIDER' as const,
            }
          : {}),
      };
      updateUser(updatedUser);

      if (wasAutoVerified) {
        toast.success('Auto-Verified Successfully! Your business is now active.');
      } else {
        toast.success('Business application submitted!');
      }

      // If auto-verified with a message, also show an info toast
      if (wasAutoVerified && autoVerifyMessage) {
        setTimeout(() => {
          toast.info(autoVerifyMessage);
        }, 1500);
      }

      onComplete?.(updatedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If refreshing, show loading spinner while we check server status
  if (isRefreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <FadeIn>
          <GlassCard variant="elevated" className="p-8 max-w-md w-full text-center">
            <Loader2 className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Checking application status...</p>
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  // If already submitted, show status
  if (hasSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <FadeIn>
          <GlassCard variant="elevated" className="p-8 max-w-md w-full text-center">
            {isVerified ? (
              <>
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Application Approved!</h2>
                <p className="text-muted-foreground mb-6">
                  Congratulations! Your business has been verified. You can now access your dashboard and start accepting bookings.
                </p>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-left mb-4">
                  <p className="text-sm text-muted-foreground mb-1">Business Name</p>
                  <p className="font-medium">{user?.businessName}</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-1">Status</p>
                  <p className="font-medium text-green-500">
                    Verified &amp; Approved
                  </p>
                </div>
                <GlassButton
                  variant="primary"
                  onClick={() => onComplete?.(user as User)}
                  className="w-full"
                >
                  Go to Dashboard
                </GlassButton>
              </>
            ) : isRejected ? (
              <>
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Application Rejected</h2>
                <p className="text-muted-foreground mb-6">
                  Unfortunately, your application was not approved. Please review the reason below and contact support if you believe this was an error.
                </p>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-left mb-4">
                  <p className="text-sm text-muted-foreground mb-1">Business Name</p>
                  <p className="font-medium">{user?.businessName}</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-1">Status</p>
                  <p className="font-medium text-red-500">
                    Rejected
                  </p>
                  {(user as any)?.rejectionReason && (
                    <>
                      <p className="text-sm text-muted-foreground mt-2 mb-1">Reason</p>
                      <p className="text-sm text-red-400">{(user as any).rejectionReason}</p>
                    </>
                  )}
                </div>
                <GlassButton
                  variant="default"
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Contact Support
                </GlassButton>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="h-10 w-10 text-yellow-500 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Application Under Review</h2>
                <p className="text-muted-foreground mb-6">
                  Your business application has been submitted and is currently being reviewed by our admin team. 
                  You will be notified once your account has been verified.
                </p>
                <div className="p-4 rounded-lg bg-muted/50 text-left">
                  <p className="text-sm text-muted-foreground mb-1">Application Status</p>
                  <p className="font-medium text-yellow-500">Pending Approval</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-1">Business Name</p>
                  <p className="font-medium">{user?.businessName}</p>
                </div>
              </>
            )}
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Complete Your <span className="gradient-text">Business Profile</span>
            </h1>
            <p className="text-muted-foreground">
              Provide your business details and verify your identity to start offering services
            </p>
          </div>
        </FadeIn>

        {/* Progress Steps */}
        <FadeIn delay={0.1}>
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
                    currentStepIndex >= index
                      ? 'gradient-bg text-white'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  {currentStepIndex > index ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                      {index + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5',
                      currentStepIndex > index ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </FadeIn>

        {/* Form */}
        <FadeIn delay={0.2}>
          <GlassCard variant="elevated" className="p-6 sm:p-8">
            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Step 1: Business Details */}
            {currentStep === 'business' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Business Information</h2>
                    <p className="text-sm text-muted-foreground">Tell us about your business</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Business Name <span className="text-destructive">*</span>
                    </label>
                    <GlassInput
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g., Elite Cuts & Style"
                      leftIcon={<Building2 className="h-4 w-4" />}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder="Describe your business and services..."
                      className="w-full h-24 px-3 py-2 rounded-lg border border-input bg-background/50 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Business Address <span className="text-destructive">*</span>
                    </label>
                    <LocationAutocomplete
                      value={businessAddress}
                      onChange={(value) => {
                        setBusinessAddress(value);
                      }}
                      onCityChange={setBusinessCity}
                      onCountryChange={setBusinessCountry}
                      placeholder="Enter your business address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        City <span className="text-destructive">*</span>
                      </label>
                      <GlassInput
                        value={businessCity}
                        onChange={(e) => setBusinessCity(e.target.value)}
                        placeholder="City"
                        leftIcon={<MapPin className="h-4 w-4" />}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Country</label>
                      <GlassInput
                        value={businessCountry}
                        onChange={(e) => setBusinessCountry(e.target.value)}
                        placeholder="Country"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Phone</label>
                    <PhoneInput
                      value={businessPhone}
                      onChange={(value) => setBusinessPhone(value)}
                      placeholder="Business phone number"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Email</label>
                    <GlassInput
                      type="email"
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      placeholder="contact@yourbusiness.com"
                      leftIcon={<Mail className="h-4 w-4" />}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Website</label>
                    <GlassInput
                      value={businessWebsite}
                      onChange={(e) => setBusinessWebsite(e.target.value)}
                      placeholder="www.yourbusiness.com"
                      leftIcon={<Globe className="h-4 w-4" />}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Booth / Shop Photo</label>
                    <div
                      className={cn(
                        'relative border-2 border-dashed rounded-xl p-6 text-center transition-all',
                        boothPhoto ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      )}
                    >
                      {boothPhotoPreview ? (
                        <div className="relative inline-block">
                          <img
                            src={boothPhotoPreview}
                            alt="Booth Photo"
                            className="max-h-48 mx-auto rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setBoothPhoto(null);
                              setBoothPhotoPreview(null);
                            }}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Upload a photo of your booth or shop
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Supports JPG, PNG (max 5MB)
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleBoothPhotoChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: ID Verification */}
            {currentStep === 'id' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Identity Verification</h2>
                    <p className="text-sm text-muted-foreground">Verify your identity to prevent fraud</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
                  <p className="text-sm">
                    <Shield className="h-4 w-4 inline mr-2 text-primary" />
                    Your ID information is encrypted and only used for verification purposes. 
                    It will not be shared with other users.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-3 block">
                      ID Type <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {idTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setIdType(type.value as typeof idType)}
                          className={cn(
                            'p-4 rounded-xl border-2 text-center transition-all',
                            idType === type.value
                              ? 'border-primary bg-primary/5 shadow-glow-sm'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <span className="text-2xl block mb-1">{type.icon}</span>
                          <span className="text-xs font-medium">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      ID Number <span className="text-destructive">*</span>
                    </label>
                    <GlassInput
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                      placeholder={`Enter your ${idTypes.find(t => t.value === idType)?.label} number`}
                      leftIcon={<FileText className="h-4 w-4" />}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Upload ID Document <span className="text-destructive">*</span>
                    </label>
                    <div
                      className={cn(
                        'relative border-2 border-dashed rounded-xl p-6 text-center transition-all',
                        idDocument ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      )}
                    >
                      {idDocumentPreview ? (
                        <div className="relative inline-block">
                          <img
                            src={idDocumentPreview}
                            alt="ID Preview"
                            className="max-h-48 mx-auto rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIdDocument(null);
                              setIdDocumentPreview(null);
                            }}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : idDocument ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <FileText className="h-8 w-8" />
                          <span className="font-medium">{idDocument.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Drag and drop your file here, or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Supports JPG, PNG, PDF (max 5MB)
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review & Submit */}
            {currentStep === 'review' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Review & Submit</h2>
                    <p className="text-sm text-muted-foreground">Please review your information before submitting</p>
                  </div>
                </div>

                {/* Business Summary */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Business Details
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{businessName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">City:</span>
                      <span className="ml-2">{businessCity}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="ml-2">{businessAddress}</span>
                    </div>
                    {businessPhone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="ml-2">{businessPhone}</span>
                      </div>
                    )}
                    {businessEmail && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <span className="ml-2">{businessEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ID Summary */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    ID Verification
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID Type:</span>
                      <span className="ml-2">{idTypes.find(t => t.value === idType)?.label}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ID Number:</span>
                      <span className="ml-2 font-mono">{idNumber}</span>
                    </div>
                  </div>
                  {idDocumentPreview && (
                    <img
                      src={idDocumentPreview}
                      alt="ID Document"
                      className="max-h-32 rounded-lg mt-2"
                    />
                  )}
                </div>

                {/* Booth Photo Summary */}
                {boothPhotoPreview && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Booth / Shop Photo
                    </h3>
                    <img
                      src={boothPhotoPreview}
                      alt="Booth Photo"
                      className="max-h-32 rounded-lg"
                    />
                  </div>
                )}

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm">
                    By submitting this application, you confirm that all information provided is accurate and 
                    you agree to our{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/provider-policies" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Business Policies</a>.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <GlassButton
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 'business'}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Back
              </GlassButton>

              {currentStep !== 'review' ? (
                <GlassButton
                  variant="primary"
                  onClick={handleNext}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Continue
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Submit Application
                </GlassButton>
              )}
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
};

export default BusinessOnboarding;
