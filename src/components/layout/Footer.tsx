'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  CreditCard,
  Shield,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/brand-logo';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SiteSettings {
  company_name: string;
  company_tagline: string;
  support_email: string;
  phone: string;
  address: string;
  social_facebook: string;
  social_twitter: string;
  social_instagram: string;
  social_linkedin: string;
}

interface FooterProps {
  onNavigate?: (page: string) => void;
  onSetSearchQuery?: (query: string) => void;
  onSetUseMyLocation?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Defaults – used while the API is loading (zero layout shift)      */
/* ------------------------------------------------------------------ */

const SETTINGS_DEFAULTS: SiteSettings = {
  company_name: 'Styra',
  company_tagline:
    'Your Style, On Demand. Discover grooming services across Kenya, book instantly, and look your best every day.',
  support_email: 'hello@styra.app',
  phone: '+254 712 345 678',
  address: 'Westlands Business Park, Nairobi, Kenya',
  social_facebook: '',
  social_twitter: '',
  social_instagram: '',
  social_linkedin: '',
};

/* ------------------------------------------------------------------ */
/*  Social-link descriptor                                             */
/* ------------------------------------------------------------------ */

interface SocialEntry {
  icon: React.ElementType;
  label: string;
  url: string;
}

function buildSocialLinks(s: SiteSettings): SocialEntry[] {
  const list: SocialEntry[] = [];
  if (s.social_facebook) list.push({ icon: Facebook, label: 'Facebook', url: s.social_facebook });
  if (s.social_twitter) list.push({ icon: Twitter, label: 'Twitter', url: s.social_twitter });
  if (s.social_instagram) list.push({ icon: Instagram, label: 'Instagram', url: s.social_instagram });
  if (s.social_linkedin) list.push({ icon: Linkedin, label: 'LinkedIn', url: s.social_linkedin });
  return list;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onSetSearchQuery,
  onSetUseMyLocation,
}) => {
  const currentYear = new Date().getFullYear();

  /* ------ Auth state for role-based footer ------ */
  const { user } = useAuthStore();
  const isAdmin = user?.roles?.includes('ADMIN') ?? false;
  const isBusinessOwner = user?.roles?.includes('BUSINESS_OWNER') ?? false;
  const isProviderMode = user?.activeMode === 'PROVIDER';

  /* ------ Dynamic settings from API ------ */
  const [settings, setSettings] = useState<SiteSettings>(SETTINGS_DEFAULTS);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch('/api/site-settings');
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.success || !json?.data?.settings) return;

        const raw = json.data.settings as Record<string, string>;
        if (cancelled) return;

        setSettings((prev) => ({
          company_name: raw.company_name || prev.company_name,
          company_tagline: raw.company_tagline || prev.company_tagline,
          support_email: raw.support_email || prev.support_email,
          phone: raw.phone || prev.phone,
          address: raw.address || prev.address,
          social_facebook: raw.social_facebook || '',
          social_twitter: raw.social_twitter || '',
          social_instagram: raw.social_instagram || '',
          social_linkedin: raw.social_linkedin || '',
        }));
      } catch {
        // Silently fall back to defaults – footer stays usable
      } finally {
        if (!cancelled) setSettingsReady(true);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------ Derived data ------ */
  const socialLinks = buildSocialLinks(settings);

  /* ------ Handlers ------ */
  const handleNavClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    action();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSocialClick = (e: React.MouseEvent, entry: SocialEntry) => {
    e.preventDefault();
    if (entry.url) {
      window.open(entry.url, '_blank', 'noopener,noreferrer');
    } else {
      toast.info('Coming Soon', {
        description: `${entry.label} page will be available soon.`,
      });
    }
  };

  const handleServiceClick = (e: React.MouseEvent, serviceName: string) => {
    e.preventDefault();
    onSetSearchQuery?.(serviceName);
    onSetUseMyLocation?.();
    onNavigate?.('marketplace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ------ Static navigation links (hardcoded routes) ------ */
  const footerLinks = {
    company: [
      { label: 'About Us', action: () => onNavigate?.('about') },
      { label: 'Careers', action: () => onNavigate?.('careers') },
      { label: 'Press', action: () => onNavigate?.('press') },
      { label: 'Blog', action: () => onNavigate?.('blog') },
    ],
    services: [
      { label: 'Haircuts & Styling', searchQuery: 'Haircuts & Styling' },
      { label: 'Beard Grooming', searchQuery: 'Beard Grooming' },
      { label: 'Nail Services', searchQuery: 'Nail Services' },
      { label: 'Spa & Wellness', searchQuery: 'Spa & Wellness' },
    ],
    support: [
      { label: 'Help Center', action: () => onNavigate?.('support') },
      { label: 'Safety', action: () => onNavigate?.('safety') },
      { label: 'Insurance Claims', action: () => onNavigate?.('insurance-claims') },
      { label: 'Terms of Service', action: () => onNavigate?.('terms') },
      { label: 'Privacy Policy', action: () => onNavigate?.('privacy') },
    ],
    partners: (
      isAdmin
        ? []
        : isBusinessOwner && isProviderMode
          ? [
              { label: 'My Business Dashboard', action: () => onNavigate?.('business-dashboard') },
              { label: 'Advertise', action: () => onNavigate?.('advertise') },
              { label: 'Developer API', action: () => onNavigate?.('api-docs') },
            ]
          : [
              { label: 'For Business', action: () => onNavigate?.('onboarding') },
              { label: 'Partner Dashboard', action: () => onNavigate?.('business-dashboard') },
              { label: 'Advertise', action: () => onNavigate?.('advertise') },
              { label: 'Developer API', action: () => onNavigate?.('api-docs') },
            ]
    ) as typeof footerLinks.company,
  };

  const features = [
    { icon: CreditCard, label: 'Secure Payments' },
    { icon: Shield, label: 'Verified Businesses' },
    { icon: Clock, label: '24/7 Support' },
  ];

  /* ------ Render helpers ------ */
  const NavList = ({ items }: { items: typeof footerLinks.company }) => (
    <ul className="space-y-2">
      {items.map((link) => (
        <li key={link.label}>
          <a
            href="#"
            onClick={(e) =>
              'action' in link
                ? handleNavClick(e, link.action as () => void)
                : handleServiceClick(e, (link as { searchQuery: string }).searchQuery)
            }
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-2 group"
          >
            <span className="w-0 group-hover:w-2 h-0.5 bg-secondary transition-all duration-200" />
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <footer className="mt-auto bg-background relative overflow-hidden">
      <div className="relative z-10">
        {/* Features Bar - Liquid Glass */}
        <div className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'flex items-center gap-3 justify-center md:justify-start',
                    'p-3 glass-button',
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center backdrop-blur-sm">
                    <feature.icon className="h-5 w-5 text-secondary" />
                  </div>
                  <span className="font-medium text-foreground">{feature.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
              {/* Brand Column */}
              <div className="lg:col-span-2">
                <Link href="/" className="inline-block cursor-pointer">
                  <div className="mb-3">
                    <BrandLogo variant="wordmark" size="footer" />
                  </div>
                </Link>

                {/* Tagline – dynamic from settings */}
                <p
                  className="text-muted-foreground mb-6 max-w-sm transition-opacity duration-300"
                  style={{ opacity: settingsReady ? 1 : 0.5 }}
                >
                  {settings.company_tagline}
                </p>

                {/* Contact Info – dynamic from settings */}
                <div className="space-y-3">
                  {/* Address */}
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-8 w-8 glass-button flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-secondary" />
                    </div>
                    <span className="transition-opacity duration-300" style={{ opacity: settingsReady ? 1 : 0.5 }}>
                      {settings.address}
                    </span>
                  </div>

                  {/* Phone */}
                  {settings.phone && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="h-8 w-8 glass-button flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-secondary" />
                      </div>
                      <a
                        href={`tel:${settings.phone.replace(/\s/g, '')}`}
                        className="hover:text-foreground transition-colors cursor-pointer transition-opacity duration-300"
                        style={{ opacity: settingsReady ? 1 : 0.5 }}
                      >
                        {settings.phone}
                      </a>
                    </div>
                  )}

                  {/* Email */}
                  {settings.support_email && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="h-8 w-8 glass-button flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-secondary" />
                      </div>
                      <a
                        href={`mailto:${settings.support_email}`}
                        className="hover:text-foreground transition-colors cursor-pointer transition-opacity duration-300"
                        style={{ opacity: settingsReady ? 1 : 0.5 }}
                      >
                        {settings.support_email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Links – hardcoded routes */}
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Company</h4>
                <NavList items={footerLinks.company} />
              </div>

              {/* Services Links – hardcoded routes */}
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Services</h4>
                <NavList items={footerLinks.services} />
              </div>

              {/* Support Links – hardcoded routes */}
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Support</h4>
                <NavList items={footerLinks.support} />
              </div>

              {/* Partners Links – role-based visibility */}
              {footerLinks.partners.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Partners</h4>
                  <NavList items={footerLinks.partners} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods Bar - Liquid Glass */}
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-sm">Payment Methods:</span>
                <div className="flex items-center gap-2">
                  {['VISA', 'Mastercard', 'PayPal', 'M-Pesa'].map((method) => (
                    <div
                      key={method}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium glass-button',
                        'text-foreground',
                      )}
                    >
                      {method}
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Links – dynamic from settings */}
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-sm">Follow Us:</span>
                <div className="flex items-center gap-2">
                  {socialLinks.length > 0
                    ? socialLinks.map((social) => (
                        <button
                          key={social.label}
                          onClick={(e) => handleSocialClick(e, social)}
                          className={cn(
                            'h-9 w-9 flex items-center justify-center',
                            'glass-button text-foreground cursor-pointer',
                            'hover:bg-gradient-to-r hover:from-primary/30 hover:to-secondary/30',
                          )}
                          aria-label={social.label}
                        >
                          <social.icon className="h-4 w-4" />
                        </button>
                      ))
                    : /* Placeholder icons while loading */
                      [Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                        <div
                          key={`placeholder-${i}`}
                          className="h-9 w-9 glass-button flex items-center justify-center text-foreground/30"
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                © {currentYear} {settings.company_name}. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <a
                  href="#"
                  onClick={(e) => handleNavClick(e, () => onNavigate?.('privacy'))}
                  className="hover:text-foreground transition-colors cursor-pointer"
                >
                  Privacy Policy
                </a>
                <a
                  href="#"
                  onClick={(e) => handleNavClick(e, () => onNavigate?.('terms'))}
                  className="hover:text-foreground transition-colors cursor-pointer"
                >
                  Terms of Service
                </a>
                <a
                  href="#"
                  onClick={(e) => handleNavClick(e, () => onNavigate?.('cookies'))}
                  className="hover:text-foreground transition-colors cursor-pointer"
                >
                  Cookie Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
