'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Eye, 
  Database, 
  Cookie,
  Lock,
  UserCheck,
  Bell,
  Globe,
  FileText,
  ChevronDown,
  X,
  Check,
  Settings,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GradientText,
  FadeIn,
  Skeleton,
} from '@/components/ui/custom/glass-components';

interface PrivacyPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

/* ── Fallback defaults for instant render (no layout shift) ── */
const DEFAULTS = {
  siteName: 'Styra',
  privacyEmail: 'privacy@styra.app',
  phone: '+254 712 345 678',
  address: 'Westlands Business Park, Westlands, Nairobi, Kenya',
  lastUpdated: 'January 15, 2025',
};

const privacySections = [
  {
    icon: Database,
    title: 'Information We Collect',
    content: [
      {
        subtitle: 'Personal Information',
        text: 'When you create an account, we collect your name, email address, phone number, and profile photo. For service providers, we also collect business information including address, services offered, and pricing.',
      },
      {
        subtitle: 'Payment Information',
        text: 'We collect payment card information through our secure payment processors. We do not store your complete card details on our servers.',
      },
      {
        subtitle: 'Usage Data',
        text: 'We automatically collect information about how you use our platform, including pages visited, features used, booking history, and interactions with other users.',
      },
      {
        subtitle: 'Device Information',
        text: 'We collect information about the devices you use to access Styra, including device type, operating system, unique device identifiers, and mobile network information.',
      },
    ],
  },
  {
    icon: Eye,
    title: 'How We Use Your Information',
    content: [
      {
        subtitle: 'Service Delivery',
        text: 'We use your information to provide, maintain, and improve our services, process transactions, and facilitate communication between customers and service providers.',
      },
      {
        subtitle: 'Personalization',
        text: 'We use your data to personalize your experience, show relevant recommendations, and customize the content you see.',
      },
      {
        subtitle: 'Communication',
        text: 'We use your contact information to send you updates about your bookings, promotional materials (with your consent), and important notices about our services.',
      },
      {
        subtitle: 'Security & Fraud Prevention',
        text: 'We use your information to detect and prevent fraud, abuse, and other harmful activities on our platform.',
      },
    ],
  },
  {
    icon: Globe,
    title: 'Information Sharing',
    content: [
      {
        subtitle: 'With Service Providers',
        text: 'We share necessary information with service providers when you book an appointment, including your name, contact information, and appointment details.',
      },
      {
        subtitle: 'With Business Tools',
        text: 'We may share information with third-party tools that help us operate our business, such as analytics providers, payment processors, and customer service tools.',
      },
      {
        subtitle: 'Legal Requirements',
        text: 'We may disclose your information if required by law, regulation, or legal process, or in response to valid government requests.',
      },
    ],
  },
  {
    icon: Lock,
    title: 'Data Security',
    content: [
      {
        subtitle: 'Encryption',
        text: 'We use industry-standard encryption to protect your data both in transit and at rest. All communications with our servers are encrypted using TLS 1.3.',
      },
      {
        subtitle: 'Access Controls',
        text: 'We implement strict access controls to ensure that only authorized personnel can access your personal information.',
      },
      {
        subtitle: 'Regular Audits',
        text: 'We conduct regular security audits and penetration testing to identify and address potential vulnerabilities.',
      },
    ],
  },
  {
    icon: Cookie,
    title: 'Cookies & Tracking',
    content: [
      {
        subtitle: 'Essential Cookies',
        text: 'These cookies are necessary for the platform to function properly. They enable basic features like page navigation and access to secure areas.',
      },
      {
        subtitle: 'Analytics Cookies',
        text: 'These cookies help us understand how visitors interact with our platform, allowing us to improve our services.',
      },
      {
        subtitle: 'Marketing Cookies',
        text: 'These cookies are used to deliver relevant advertisements and track the effectiveness of marketing campaigns. You can opt out of these cookies.',
      },
    ],
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    content: [
      {
        subtitle: 'Access Your Data',
        text: 'You have the right to request a copy of all personal data we hold about you. We will provide this within 30 days of your request.',
      },
      {
        subtitle: 'Correction',
        text: 'You can update or correct your personal information at any time through your account settings.',
      },
      {
        subtitle: 'Deletion',
        text: 'You can request deletion of your account and associated data. Some data may be retained for legal or legitimate business purposes.',
      },
      {
        subtitle: 'Data Portability',
        text: 'You can request your data in a portable format that can be transferred to another service provider.',
      },
    ],
  },
];

const cookieTypes = [
  {
    id: 'essential',
    name: 'Essential Cookies',
    description: 'Required for the platform to function. These cannot be disabled.',
    enabled: true,
    required: true,
  },
  {
    id: 'analytics',
    name: 'Analytics Cookies',
    description: 'Help us understand how you use our platform so we can improve your experience.',
    enabled: true,
    required: false,
  },
  {
    id: 'marketing',
    name: 'Marketing Cookies',
    description: 'Used to deliver personalized advertisements and measure campaign effectiveness.',
    enabled: false,
    required: false,
  },
  {
    id: 'preferences',
    name: 'Preference Cookies',
    description: 'Remember your settings and preferences for a better experience.',
    enabled: true,
    required: false,
  },
];

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack, onNavigate }) => {
  /* ── Dynamic data state ── */
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── Cookie modal state ── */
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieSettings, setCookieSettings] = useState(cookieTypes);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  /* ── Fetch site settings from API ── */
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    setFetchError(null);
    try {
      const keys = 'site_name,privacy_email,phone_number,address,privacy_last_updated';
      const res = await fetch(`/api/site-settings?keys=${encodeURIComponent(keys)}`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      const json = await res.json();
      if (json.success) setSettings(json.data.settings ?? {});
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /* ── Derived values with fallback defaults (no layout shift) ── */
  const siteName = settings.site_name || DEFAULTS.siteName;
  const privacyEmail = settings.privacy_email || DEFAULTS.privacyEmail;
  const phone = settings.phone_number || DEFAULTS.phone;
  const address = settings.address || DEFAULTS.address;
  const lastUpdated = settings.privacy_last_updated || DEFAULTS.lastUpdated;

  /* ── Cookie handlers ── */
  const handleToggleCookie = (id: string) => {
    setCookieSettings(prev => 
      prev.map(cookie => 
        cookie.id === id && !cookie.required
          ? { ...cookie, enabled: !cookie.enabled }
          : cookie
      )
    );
  };

  const handleAcceptAll = () => {
    setCookieSettings(prev => 
      prev.map(cookie => ({ ...cookie, enabled: true }))
    );
    setSaveStatus('saved');
    setTimeout(() => {
      setShowCookieModal(false);
      setSaveStatus('idle');
    }, 1500);
  };

  const handleSavePreferences = () => {
    setSaveStatus('saved');
    setTimeout(() => {
      setShowCookieModal(false);
      setSaveStatus('idle');
    }, 1500);
  };

  const handleRejectNonEssential = () => {
    setCookieSettings(prev => 
      prev.map(cookie => 
        cookie.required ? cookie : { ...cookie, enabled: false }
      )
    );
    setSaveStatus('saved');
    setTimeout(() => {
      setShowCookieModal(false);
      setSaveStatus('idle');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center mx-auto mb-6">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <GradientText>Privacy Policy</GradientText>
          </h1>
          {loadingSettings ? (
            <Skeleton className="h-4 w-40 mx-auto" />
          ) : (
            <p className="text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          )}
        </FadeIn>

        {/* Introduction */}
        <FadeIn delay={0.1}>
          <GlassCard variant="bordered" className="mb-8">
            <p className="text-muted-foreground">
              At {siteName}, we take your privacy seriously. This Privacy Policy explains how we 
              collect, use, disclose, and safeguard your information when you use our platform. 
              Please read this policy carefully. By using {siteName}, you consent to the practices 
              described in this policy.
            </p>
          </GlassCard>
        </FadeIn>

        {/* Error Banner (non-blocking) */}
        <AnimatePresence>
          {fetchError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Failed to load site settings</p>
                  <p className="text-xs text-muted-foreground">{fetchError}</p>
                </div>
              </div>
              <GlassButton
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={fetchSettings}
              >
                Retry
              </GlassButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sections */}
        {privacySections.map((section, index) => (
          <FadeIn key={section.title} delay={0.1 + index * 0.05}>
            <GlassCard className="mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0">
                  <section.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
                  <div className="space-y-4">
                    {section.content.map((item) => (
                      <div key={item.subtitle}>
                        <h3 className="font-medium mb-2">{item.subtitle}</h3>
                        <p className="text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        ))}

        {/* Cookie Preferences */}
        <FadeIn delay={0.4}>
          <GlassCard variant="gradient" className="mb-8">
            <div className="flex items-start gap-4">
              <Cookie className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-2">Cookie Preferences</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You can manage your cookie preferences through your browser settings or our 
                  cookie consent tool. Note that disabling certain cookies may affect the 
                  functionality of our platform.
                </p>
                <GlassButton 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCookieModal(true)}
                  leftIcon={<Settings className="h-4 w-4" />}
                >
                  Manage Cookies
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Data Retention */}
        <FadeIn delay={0.5}>
          <GlassCard className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your personal information for as long as necessary to provide our services 
              and comply with legal obligations. After account deletion:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <ChevronDown className="h-4 w-4 mt-0.5 text-primary" />
                <span>Booking history is retained for 7 years for tax and legal compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronDown className="h-4 w-4 mt-0.5 text-primary" />
                <span>Payment records are retained for 7 years per financial regulations</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronDown className="h-4 w-4 mt-0.5 text-primary" />
                <span>Marketing data is deleted immediately upon opt-out or account deletion</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronDown className="h-4 w-4 mt-0.5 text-primary" />
                <span>Anonymous usage data may be retained indefinitely for analytics</span>
              </li>
            </ul>
          </GlassCard>
        </FadeIn>

        {/* Contact */}
        <FadeIn delay={0.6}>
          <GlassCard variant="elevated">
            <div className="flex items-start gap-4">
              <Bell className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Questions or Concerns?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  If you have questions about this Privacy Policy or wish to exercise your rights, 
                  please contact our Data Protection Officer:
                </p>
                {loadingSettings ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-80" />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p><strong>Email:</strong> {privacyEmail}</p>
                    <p><strong>Phone:</strong> {phone}</p>
                    <p><strong>Address:</strong> {address}</p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Footer note */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <FileText className="h-4 w-4 inline-block mr-1" />
          This policy may be updated from time to time. We will notify you of significant changes via email.
        </div>
      </div>

      {/* Cookie Preferences Modal */}
      <AnimatePresence>
        {showCookieModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCookieModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background/95 border border-border/50 shadow-xl rounded-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                      <Cookie className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Cookie Preferences</h2>
                      <p className="text-xs text-muted-foreground">Manage your cookie settings</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCookieModal(false)}
                    className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {saveStatus === 'saved' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Preferences Saved</h3>
                    <p className="text-muted-foreground">Your cookie preferences have been updated.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mb-6">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-700 dark:text-amber-400">About Cookie Preferences</p>
                        <p className="text-amber-600/80 dark:text-amber-500/80">Essential cookies are required for the platform to work and cannot be disabled.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {cookieSettings.map((cookie) => (
                        <div
                          key={cookie.id}
                          className={`p-4 rounded-xl border transition-colors ${
                            cookie.enabled 
                              ? 'bg-primary/5 border-primary/20' 
                              : 'bg-muted/50 border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">{cookie.name}</h4>
                                {cookie.required && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{cookie.description}</p>
                            </div>
                            <button
                              onClick={() => handleToggleCookie(cookie.id)}
                              disabled={cookie.required}
                              className={`flex-shrink-0 transition-colors ${
                                cookie.required ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              }`}
                            >
                              {cookie.enabled ? (
                                <ToggleRight className="h-8 w-8 text-primary" />
                              ) : (
                                <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {saveStatus !== 'saved' && (
                <div className="p-6 border-t border-border/50 bg-muted/30">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={handleRejectNonEssential}
                      className="flex-1"
                    >
                      Reject Non-Essential
                    </GlassButton>
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={handleSavePreferences}
                      className="flex-1"
                    >
                      Save Preferences
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={handleAcceptAll}
                      className="flex-1"
                    >
                      Accept All
                    </GlassButton>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PrivacyPage;
