'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  Shield,
  AlertCircle,
  Camera,
  Scissors,
  Clock,
  DollarSign,
  Star,
  X,
  Loader2,
  CheckCircle,
  Info,
  Calendar,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { PhoneInput } from '@/components/ui/custom/PhoneInput';
import { cn } from '@/lib/utils';
import { useAuthStore, useAdminStore } from '@/store';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import type { User as UserType } from '@/types';

interface ProviderOnboardingProps {
  onComplete?: (user: UserType) => void;
}

type Step = 'welcome' | 'profile' | 'services' | 'portfolio' | 'availability' | 'verification' | 'review';

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  photos: string[];
}

interface PortfolioItem {
  id: string;
  image: string;
  caption: string;
}

const serviceCategories = [
  'Haircuts & Styling',
  'Beard Grooming',
  'Hair Coloring',
  'Nail Services',
  'Skin Care',
  'Makeup',
  'Spa & Wellness',
  'Massage',
];

const popularServices: Record<string, string[]> = {
  'Haircuts & Styling': ['Classic Haircut', 'Fade Cut', 'Buzz Cut', 'Hair Styling', 'Kids Haircut', 'Hair Treatment'],
  'Beard Grooming': ['Beard Trim', 'Beard Shaping', 'Hot Towel Shave', 'Beard Color', 'Full Beard Grooming'],
  'Hair Coloring': ['Full Color', 'Highlights', 'Balayage', 'Root Touch-up', 'Color Correction'],
  'Nail Services': ['Manicure', 'Pedicure', 'Gel Nails', 'Nail Art', 'Acrylic Nails'],
  'Skin Care': ['Facial', 'Deep Cleansing', 'Anti-aging Treatment', 'Acne Treatment', 'Skin Rejuvenation'],
  'Makeup': ['Bridal Makeup', 'Party Makeup', 'Natural Look', 'Makeover', 'Makeup Lesson'],
  'Spa & Wellness': ['Body Massage', 'Hot Stone Massage', 'Aromatherapy', 'Body Scrub', 'Sauna'],
  'Massage': ['Swedish Massage', 'Deep Tissue', 'Sports Massage', 'Thai Massage', 'Reflexology'],
};

export const ProviderOnboarding: React.FC<ProviderOnboardingProps> = ({
  onComplete,
}) => {
  const { user, updateUser } = useAuthStore();
  const { addApplication } = useAdminStore();
  
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState('');
  
  // ── Fetch fresh verification status from server on mount ──
  // The Zustand/localStorage stores are stale. Always check the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getProfile();
        if (cancelled || !result.success || !result.data) return;
        const serverUser = result.data as Record<string, unknown>;
        const serverStatus = serverUser.businessVerificationStatus as string | undefined;
        if (serverStatus && serverStatus !== user?.businessVerificationStatus) {
          updateUser({
            businessVerificationStatus: serverStatus as any,
            role: (serverUser.role as string) || user?.role,
            roles: (serverUser.roles as string[]) || user?.roles,
            activeMode: (serverUser.activeMode as string) || user?.activeMode,
            businessName: (serverUser.businessName as string) || user?.businessName,
          } as any);
        }
      } catch {
        // Non-critical — use whatever we have locally
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Check status from auth store (synced with server via /api/auth/me)
  const hasSubmitted = !!user?.businessVerificationStatus;
  const isVerified = ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'].includes(user?.businessVerificationStatus || '');
  const isRejected = user?.businessVerificationStatus === 'REJECTED';
  const isPending = user?.businessVerificationStatus === 'PENDING';

  // Form states
  const [profileData, setProfileData] = useState({
    businessName: '',
    description: '',
    phone: '',
    email: user?.email || '',
    website: '',
    address: '',
    city: '',
    country: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [availability, setAvailability] = useState({
    monday: { enabled: true, start: '09:00', end: '18:00' },
    tuesday: { enabled: true, start: '09:00', end: '18:00' },
    wednesday: { enabled: true, start: '09:00', end: '18:00' },
    thursday: { enabled: true, start: '09:00', end: '18:00' },
    friday: { enabled: true, start: '09:00', end: '18:00' },
    saturday: { enabled: true, start: '10:00', end: '16:00' },
    sunday: { enabled: false, start: '10:00', end: '16:00' },
  });
  
  const [idData, setIdData] = useState({
    idType: 'PASSPORT' as 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE',
    idNumber: '',
    idDocument: null as string | null,
  });

  const [boothPhoto, setBoothPhoto] = useState<File | null>(null);
  const [boothPhotoPreview, setBoothPhotoPreview] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const steps: { id: Step; label: string; icon: typeof User; description: string }[] = [
    { id: 'welcome', label: 'Welcome', icon: Building2, description: 'Get started' },
    { id: 'profile', label: 'Profile', icon: User, description: 'Business details' },
    { id: 'services', label: 'Services', icon: Scissors, description: 'What you offer' },
    { id: 'portfolio', label: 'Portfolio', icon: ImageIcon, description: 'Your work' },
    { id: 'availability', label: 'Availability', icon: Calendar, description: 'Working hours' },
    { id: 'verification', label: 'Verify', icon: Shield, description: 'ID verification' },
    { id: 'review', label: 'Review', icon: Check, description: 'Submit' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        callback(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add service
  const addService = () => {
    const newService: ServiceItem = {
      id: `svc-${Date.now()}`,
      name: '',
      category: serviceCategories[0],
      description: '',
      duration: 30,
      price: 0,
      photos: [],
    };
    setServices([...services, newService]);
  };

  // Update service
  const updateService = (id: string, field: keyof ServiceItem, value: string | number | string[]) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Remove service
  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  // Add portfolio item
  const addPortfolioItem = (image: string) => {
    setPortfolio([...portfolio, { id: `port-${Date.now()}`, image, caption: '' }]);
  };

  // Validate step
  const validateStep = (): boolean => {
    setError('');
    
    switch (currentStep) {
      case 'profile':
        if (!profileData.businessName.trim()) {
          setError('Business name is required');
          return false;
        }
        if (!profileData.address.trim()) {
          setError('Business address is required');
          return false;
        }
        if (!profileData.city.trim()) {
          setError('City is required');
          return false;
        }
        return true;
      
      case 'services':
        if (services.length === 0) {
          setError('Add at least one service');
          return false;
        }
        for (const service of services) {
          if (!service.name.trim() || service.price <= 0) {
            setError('All services must have a name and price');
            return false;
          }
        }
        return true;
      
      case 'portfolio':
        if (portfolio.length < 3) {
          setError('Add at least 3 portfolio photos');
          return false;
        }
        return true;
      
      case 'verification':
        if (!idData.idNumber.trim()) {
          setError('ID number is required');
          return false;
        }
        if (!idData.idDocument) {
          setError('Please upload your ID document');
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  // Handle next
  const handleNext = () => {
    if (!validateStep()) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  // Handle back
  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      // Clean website: add protocol if missing
      let cleanWebsite = profileData.website?.trim() || undefined;
      if (cleanWebsite && !cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
        cleanWebsite = `https://${cleanWebsite}`;
      }

      // Upload ID document to server
      let idDocumentUrl: string | undefined;
      if (idData.idDocument) {
        try {
          const idBlob = await (await fetch(idData.idDocument)).blob();
          const idFile = new File([idBlob], 'id-document.jpg', { type: 'image/jpeg' });
          const uploadRes = await api.uploadFile(idFile, 'id-document');
          idDocumentUrl = uploadRes.data?.url;
        } catch (uploadErr) {
          console.error('Failed to upload ID document:', uploadErr);
        }
      }

      // Upload booth photo to server
      let boothPhotoUrl: string | undefined;
      if (boothPhoto) {
        try {
          const uploadRes = await api.uploadFile(boothPhoto, 'booth-photo');
          boothPhotoUrl = uploadRes.data?.url;
        } catch (uploadErr) {
          console.error('Failed to upload booth photo:', uploadErr);
        }
      }

      // Upload logo to server
      let logoUrl: string | undefined;
      if (logo) {
        try {
          const logoBlob = await (await fetch(logo)).blob();
          const logoFile = new File([logoBlob], 'logo.jpg', { type: 'image/jpeg' });
          const uploadRes = await api.uploadFile(logoFile, 'logo');
          logoUrl = uploadRes.data?.url;
        } catch (uploadErr) {
          console.error('Failed to upload logo:', uploadErr);
        }
      }

      // Upload cover image to server
      let coverImageUrl: string | undefined;
      if (coverImage) {
        try {
          const coverBlob = await (await fetch(coverImage)).blob();
          const coverFile = new File([coverBlob], 'cover.jpg', { type: 'image/jpeg' });
          const uploadRes = await api.uploadFile(coverFile, 'portfolio');
          coverImageUrl = uploadRes.data?.url;
        } catch (uploadErr) {
          console.error('Failed to upload cover image:', uploadErr);
        }
      }

      // Create business via real API with ALL fields including photos
      const result = await api.createBusiness({
        name: profileData.businessName,
        description: profileData.description || undefined,
        address: profileData.address,
        city: profileData.city,
        country: profileData.country || 'N/A',
        phone: profileData.phone || undefined,
        email: profileData.email || undefined,
        website: cleanWebsite,
        serviceRadius: 10,
        idType: idData.idType,
        idNumber: idData.idNumber,
        idDocumentUrl,
        boothPhotoUrl,
        logo: logoUrl,
        coverImage: coverImageUrl,
      });

      const businessId = (result.data as { id: string }).id;

      // Create services via real API
      for (const service of services) {
        await api.createService({
          businessId,
          name: service.name,
          description: service.description,
          category: service.category,
          duration: service.duration,
          price: service.price,
        });
      }

      // Upload portfolio photos and create PortfolioItem records
      if (portfolio.length > 0) {
        for (const item of portfolio) {
          try {
            if (item.image && typeof item.image === 'string') {
              await api.request('/portfolio', {
                method: 'POST',
                body: JSON.stringify({
                  businessId,
                  image: item.image,
                  title: (item as any).caption || null,
                }),
                noRetry: true,
              });
            }
          } catch (portfolioErr) {
            console.error('Failed to upload portfolio image:', portfolioErr);
          }
        }
      }

      // Store in local admin store for backward compatibility
      addApplication({
        id: `app-${Date.now()}`,
        userId: user.id,
        userName: user.name || 'Unknown',
        userEmail: user.email,
        userPhone: profileData.phone,
        idType: idData.idType,
        idNumber: idData.idNumber,
        idDocumentUrl,
        boothPhotoUrl,
        businessName: profileData.businessName,
        businessDescription: profileData.description,
        businessAddress: profileData.address,
        businessCity: profileData.city,
        businessCountry: profileData.country,
        businessWebsite: profileData.website,
        businessPhone: profileData.phone,
        businessEmail: profileData.email,
        status: 'PENDING' as const,
        submittedAt: new Date(),
      });
      
      // Check if auto-verified from server response
      const autoVerify = (result.data as Record<string, unknown>)?._autoVerify as { autoVerified: boolean; verificationStatus: string } | undefined;
      const serverStatus = autoVerify?.autoVerified ? autoVerify.verificationStatus : 'PENDING';

      const updatedUser: UserType = {
        ...user,
        businessName: profileData.businessName,
        businessDescription: profileData.description,
        businessAddress: profileData.address,
        businessCity: profileData.city,
        businessCountry: profileData.country,
        businessWebsite: profileData.website,
        idType: idData.idType,
        idNumber: idData.idNumber,
        idDocumentUrl,
        businessVerificationStatus: serverStatus as import('@/types').VerificationStatus,
      };
      
      localStorage.setItem('styra-verification-status', serverStatus);
      localStorage.setItem('styra-business-name', profileData.businessName);
      
      toast.success('Application submitted successfully! We will review it shortly.');
      updateUser(updatedUser);
      onComplete?.(updatedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show status if already submitted
  if (hasSubmitted && !isRefreshing) {
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
                  Congratulations! Your business "{user?.businessName || 'your business'}" has been verified. You can now access your dashboard and start accepting bookings.
                </p>
                <GlassButton variant="primary" onClick={() => onComplete?.(user as UserType)} className="w-full">
                  Go to Dashboard
                </GlassButton>
              </>
            ) : isRejected ? (
              <>
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Application Rejected</h2>
                <p className="text-muted-foreground mb-4">
                  Unfortunately, your application was not approved.
                </p>
                {(user as any)?.rejectionReason && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-left mb-4">
                    <p className="text-sm font-medium text-red-500">{String((user as any).rejectionReason)}</p>
                  </div>
                )}
                <GlassButton variant="default" onClick={() => window.location.reload()} className="w-full">
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
                  Your application for "{user?.businessName || 'your business'}" is being reviewed. This usually takes 1-2 business days.
                </p>
              </>
            )}
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <FadeIn>
          <div className="mb-8">
            <div className="flex items-center justify-between overflow-x-auto pb-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                    className={cn(
                      'flex flex-col items-center min-w-[80px]',
                      index > currentStepIndex && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                        index < currentStepIndex
                          ? 'bg-green-500 text-white'
                          : index === currentStepIndex
                          ? 'gradient-bg text-white shadow-glow'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {index < currentStepIndex ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={cn(
                      'text-xs mt-2 font-medium',
                      index === currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      'flex-1 h-0.5 mx-2',
                      index < currentStepIndex ? 'bg-green-500' : 'bg-muted'
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
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

              {/* Welcome Step */}
              {currentStep === 'welcome' && (
                <div className="text-center py-8">
                  <div className="w-24 h-24 rounded-full gradient-bg flex items-center justify-center mx-auto mb-6">
                    <Building2 className="h-12 w-12 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold mb-4">Become a Service Provider</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Join thousands of grooming professionals on Styra. 
                    List your services, connect with clients, and grow your business.
                  </p>
                  
                  <div className="grid sm:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl font-bold text-primary">1</span>
                      </div>
                      <h3 className="font-medium mb-1">Create Profile</h3>
                      <p className="text-xs text-muted-foreground">Tell us about your business</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl font-bold text-primary">2</span>
                      </div>
                      <h3 className="font-medium mb-1">List Services</h3>
                      <p className="text-xs text-muted-foreground">Add your services and pricing</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl font-bold text-primary">3</span>
                      </div>
                      <h3 className="font-medium mb-1">Get Verified</h3>
                      <p className="text-xs text-muted-foreground">Start accepting bookings</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-left">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">What you'll need</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Business name and contact details</li>
                          <li>• Valid ID (Passport, National ID, or Driver's License)</li>
                          <li>• At least 3 photos of your work</li>
                          <li>• Service descriptions and pricing</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Step */}
              {currentStep === 'profile' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Business Profile</h2>
                      <p className="text-sm text-muted-foreground">Tell clients about your business</p>
                    </div>
                  </div>

                  {/* Logo & Cover */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium mb-3 block">Logo</label>
                      <div
                        className={cn(
                          'relative w-24 h-24 rounded-full border-2 border-dashed overflow-hidden cursor-pointer',
                          logo ? 'border-primary' : 'border-border hover:border-primary/50'
                        )}
                      >
                        {logo ? (
                          <>
                            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setLogo(null); }}
                              className="absolute top-0 right-0 p-1 bg-destructive text-white rounded-bl-lg"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted/50">
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, setLogo)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex-1">
                      <label className="text-sm font-medium mb-3 block">Cover Image</label>
                      <div
                        className={cn(
                          'relative h-24 rounded-lg border-2 border-dashed overflow-hidden cursor-pointer',
                          coverImage ? 'border-primary' : 'border-border hover:border-primary/50'
                        )}
                      >
                        {coverImage ? (
                          <>
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCoverImage(null); }}
                              className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted/50 gap-2">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Add cover photo</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, setCoverImage)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-2 block">
                        Business Name <span className="text-destructive">*</span>
                      </label>
                      <GlassInput
                        value={profileData.businessName}
                        onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                        placeholder="e.g., Elite Cuts & Style"
                        leftIcon={<Building2 className="h-4 w-4" />}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-2 block">Description</label>
                      <textarea
                        value={profileData.description}
                        onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                        placeholder="Tell clients what makes your business special..."
                        className="w-full h-24 px-3 py-2 rounded-lg border border-input bg-background/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Phone</label>
                      <PhoneInput
                        value={profileData.phone}
                        onChange={(value) => setProfileData({ ...profileData, phone: value })}
                        placeholder="Business phone"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Email</label>
                      <GlassInput
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        placeholder="business@example.com"
                        leftIcon={<Mail className="h-4 w-4" />}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-2 block">
                        Business Address <span className="text-destructive">*</span>
                      </label>
                      <GlassInput
                        value={profileData.address}
                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        placeholder="Street address"
                        leftIcon={<MapPin className="h-4 w-4" />}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        City <span className="text-destructive">*</span>
                      </label>
                      <GlassInput
                        value={profileData.city}
                        onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Country</label>
                      <GlassInput
                        value={profileData.country}
                        onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                        placeholder="Country"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-2 block">Website (optional)</label>
                      <GlassInput
                        value={profileData.website}
                        onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                        placeholder="www.yourbusiness.com"
                        leftIcon={<Globe className="h-4 w-4" />}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Services Step */}
              {currentStep === 'services' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                        <Scissors className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Your Services</h2>
                        <p className="text-sm text-muted-foreground">Add services and set your prices</p>
                      </div>
                    </div>
                    <GlassButton variant="primary" size="sm" onClick={addService} leftIcon={<Scissors className="h-4 w-4" />}>
                      Add Service
                    </GlassButton>
                  </div>

                  {services.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Scissors className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium mb-2">No services yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add at least one service to continue
                      </p>
                      <GlassButton variant="primary" onClick={addService}>
                        Add Your First Service
                      </GlassButton>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {services.map((service, index) => (
                        <div key={service.id} className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-start justify-between mb-4">
                            <span className="text-sm font-medium text-muted-foreground">Service {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeService(service.id)}
                              className="p-1 rounded hover:bg-destructive/20 text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium mb-2 block">Category</label>
                              <select
                                value={service.category}
                                onChange={(e) => updateService(service.id, 'category', e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background"
                              >
                                {serviceCategories.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">Service Name</label>
                              <input
                                type="text"
                                value={service.name}
                                onChange={(e) => updateService(service.id, 'name', e.target.value)}
                                placeholder="e.g., Classic Haircut"
                                list={`services-${service.category}`}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background"
                              />
                              <datalist id={`services-${service.category}`}>
                                {popularServices[service.category]?.map((s) => (
                                  <option key={s} value={s} />
                                ))}
                              </datalist>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-sm font-medium mb-2 block">Description</label>
                              <input
                                type="text"
                                value={service.description}
                                onChange={(e) => updateService(service.id, 'description', e.target.value)}
                                placeholder="Brief description of the service"
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background"
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">Duration (minutes)</label>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <input
                                  type="number"
                                  value={service.duration}
                                  onChange={(e) => updateService(service.id, 'duration', parseInt(e.target.value))}
                                  min={15}
                                  step={15}
                                  className="flex-1 h-10 px-3 rounded-lg border border-input bg-background"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">Price ($)</label>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <input
                                  type="number"
                                  value={service.price}
                                  onChange={(e) => updateService(service.id, 'price', parseFloat(e.target.value))}
                                  min={0}
                                  step={0.01}
                                  className="flex-1 h-10 px-3 rounded-lg border border-input bg-background"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {services.length > 0 && (
                    <div className="flex items-center justify-center gap-4 pt-4">
                      <GlassButton variant="outline" onClick={addService} leftIcon={<Plus className="h-4 w-4" />}>
                        Add More
                      </GlassButton>
                      <GlassButton variant="primary" onClick={handleNext} rightIcon={<Check className="h-4 w-4" />}>
                        Done
                      </GlassButton>
                    </div>
                  )}
                </div>
              )}

              {/* Portfolio Step */}
              {currentStep === 'portfolio' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Your Portfolio</h2>
                      <p className="text-sm text-muted-foreground">Showcase your best work (min 3 photos)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {portfolio.map((item) => (
                      <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setPortfolio(portfolio.filter(p => p.id !== item.id))}
                            className="p-2 bg-destructive text-white rounded-full"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {portfolio.length < 10 && (
                      <label className="relative aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center bg-muted/30">
                        <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Add Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, addPortfolioItem)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Star className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Tips for a great portfolio</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Add high-quality, well-lit photos</li>
                          <li>• Show a variety of your work</li>
                          <li>• Include before & after shots if possible</li>
                          <li>• Minimum 3 photos required</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Availability Step */}
              {currentStep === 'availability' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Working Hours</h2>
                      <p className="text-sm text-muted-foreground">Set your availability for bookings</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(availability).map(([day, hours]) => (
                      <div key={day} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                        <button
                          type="button"
                          onClick={() => setAvailability({
                            ...availability,
                            [day]: { ...hours, enabled: !hours.enabled }
                          })}
                          className={cn(
                            'w-12 h-6 rounded-full transition-colors relative',
                            hours.enabled ? 'bg-primary' : 'bg-muted'
                          )}
                        >
                          <div className={cn(
                            'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                            hours.enabled ? 'left-7' : 'left-1'
                          )} />
                        </button>
                        
                        <span className={cn(
                          'w-24 font-medium capitalize',
                          !hours.enabled && 'text-muted-foreground'
                        )}>
                          {day}
                        </span>
                        
                        {hours.enabled && (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={hours.start}
                              onChange={(e) => setAvailability({
                                ...availability,
                                [day]: { ...hours, start: e.target.value }
                              })}
                              className="h-8 px-2 rounded border border-input bg-background text-sm"
                            />
                            <span className="text-muted-foreground">to</span>
                            <input
                              type="time"
                              value={hours.end}
                              onChange={(e) => setAvailability({
                                ...availability,
                                [day]: { ...hours, end: e.target.value }
                              })}
                              className="h-8 px-2 rounded border border-input bg-background text-sm"
                            />
                          </div>
                        )}
                        
                        {!hours.enabled && (
                          <span className="text-sm text-muted-foreground">Closed</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Step */}
              {currentStep === 'verification' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Identity Verification</h2>
                      <p className="text-sm text-muted-foreground">Verify your identity to build trust</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
                    <p className="text-sm">
                      <Shield className="h-4 w-4 inline mr-2 text-primary" />
                      Your ID is encrypted and only used for verification. It will not be shared publicly.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-3 block">ID Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'PASSPORT', label: 'Passport', icon: '📘' },
                        { value: 'NATIONAL_ID', label: 'National ID', icon: '🪪' },
                        { value: 'DRIVERS_LICENSE', label: "Driver's License", icon: '🚗' },
                      ].map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setIdData({ ...idData, idType: type.value as typeof idData.idType })}
                          className={cn(
                            'p-4 rounded-xl border-2 text-center transition-all',
                            idData.idType === type.value
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
                      value={idData.idNumber}
                      onChange={(e) => setIdData({ ...idData, idNumber: e.target.value.toUpperCase() })}
                      placeholder="Enter your ID number"
                      leftIcon={<FileText className="h-4 w-4" />}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Upload ID Document <span className="text-destructive">*</span>
                    </label>
                    <div className={cn(
                      'relative border-2 border-dashed rounded-xl p-8 text-center',
                      idData.idDocument ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    )}>
                      {idData.idDocument ? (
                        <div className="relative inline-block">
                          <img src={idData.idDocument} alt="ID" className="max-h-48 rounded-lg mx-auto" />
                          <button
                            type="button"
                            onClick={() => setIdData({ ...idData, idDocument: null })}
                            className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-1">
                            Drag and drop or click to upload
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG or PDF (max 5MB)
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, (base64) => setIdData({ ...idData, idDocument: base64 }))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Booth / Shop Photo Upload */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Business / Booth Photo
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">Upload a photo of your business premises, booth, or shop front. This will be shown to customers.</p>
                    <div className={cn(
                      'relative border-2 border-dashed rounded-xl p-8 text-center',
                      boothPhotoPreview ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    )}>
                      {boothPhotoPreview ? (
                        <div className="relative inline-block">
                          <img src={boothPhotoPreview} alt="Booth" className="max-h-48 rounded-lg mx-auto" />
                          <button
                            type="button"
                            onClick={() => { setBoothPhoto(null); setBoothPhotoPreview(null); }}
                            className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-1">
                            Upload a photo of your business
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG (max 5MB) — optional but recommended
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              setError('Booth photo must be less than 5MB');
                              return;
                            }
                            setBoothPhoto(file);
                            const reader = new FileReader();
                            reader.onload = (ev) => setBoothPhotoPreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Review Step */}
              {currentStep === 'review' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Review & Submit</h2>
                      <p className="text-sm text-muted-foreground">Please review your information</p>
                    </div>
                  </div>

                  {/* Profile Summary */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium flex items-center gap-2 mb-3">
                      <User className="h-4 w-4" /> Business Profile
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{profileData.businessName}</span></div>
                      <div><span className="text-muted-foreground">City:</span> {profileData.city}</div>
                      <div className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> {profileData.address}</div>
                      {profileData.phone && <div><span className="text-muted-foreground">Phone:</span> {profileData.phone}</div>}
                      <div><span className="text-muted-foreground">Email:</span> {profileData.email}</div>
                    </div>
                  </div>

                  {/* Services Summary */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium flex items-center gap-2 mb-3">
                      <Scissors className="h-4 w-4" /> Services ({services.length})
                    </h3>
                    <div className="space-y-2">
                      {services.map((s) => (
                        <div key={s.id} className="flex justify-between text-sm">
                          <span>{s.name}</span>
                          <span className="font-medium">${s.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Portfolio Summary */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium flex items-center gap-2 mb-3">
                      <ImageIcon className="h-4 w-4" /> Portfolio ({portfolio.length} photos)
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {portfolio.slice(0, 5).map((p) => (
                        <img key={p.id} src={p.image} alt="" className="w-16 h-16 rounded object-cover shrink-0" />
                      ))}
                      {portfolio.length > 5 && (
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-sm font-medium">
                          +{portfolio.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ID Summary */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" /> ID Verification
                    </h3>
                    <div className="flex gap-4 text-sm">
                      <div><span className="text-muted-foreground">Type:</span> {idData.idType}</div>
                      <div><span className="text-muted-foreground">Number:</span> <span className="font-mono">{idData.idNumber}</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm">
                      By submitting, you confirm that all information is accurate and agree to our{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="/provider-policies" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Provider Policies</a>.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t border-border">
                {currentStep !== 'welcome' ? (
                  <GlassButton variant="ghost" onClick={handleBack} leftIcon={<ChevronLeft className="h-4 w-4" />}>
                    Back
                  </GlassButton>
                ) : (
                  <div />
                )}

                {currentStep !== 'review' ? (
                  <GlassButton variant="primary" onClick={handleNext} rightIcon={<ChevronRight className="h-4 w-4" />}>
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProviderOnboarding;
