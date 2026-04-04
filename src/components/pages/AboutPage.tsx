'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Award,
  Globe,
  Star,
  MapPin,
  Mail,
  Phone,
  Heart,
  Lightbulb,
  Shield,
  Target,
  BookOpen,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GradientText,
  FadeIn,
  StaggerChildren,
  StaggerItem,
  Skeleton,
} from '@/components/ui/custom/glass-components';

// ── Types ────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  image: string | null;
  order: number;
}

interface SiteSettings {
  company_name?: string;
  company_tagline?: string;
  company_description?: string;
  support_email?: string;
  phone?: string;
  address?: string;
}

interface SiteStats {
  total_providers: number;
  total_customers: number;
  total_cities: number;
  avg_rating: number;
}

interface AboutPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

// ── Brand values (hardcoded — brand-defining) ────────────────

const values = [
  { icon: Heart, title: 'Customer First', description: 'Every decision we make starts with our customers in mind.' },
  { icon: Target, title: 'Excellence', description: 'We strive for the highest quality in everything we do.' },
  { icon: Users, title: 'Community', description: 'Building bridges between providers and customers.' },
  { icon: Lightbulb, title: 'Innovation', description: 'Constantly improving to serve you better.' },
];

const milestones = [
  { year: '2020', event: 'Styra founded in Nairobi, Kenya' },
  { year: '2021', event: 'Expanded to major cities across Kenya' },
  { year: '2022', event: 'Launched mobile apps, reached 1M+ bookings' },
  { year: '2023', event: 'Regional expansion to Uganda, Tanzania, and Rwanda' },
  { year: '2024', event: '10,000+ verified service providers on platform' },
];

// ── Skeleton loaders ─────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <GlassCard key={i} hover={false} glow className="text-center">
          <Skeleton variant="circular" className="w-14 h-14 mx-auto mb-3" />
          <Skeleton className="h-8 w-16 mx-auto mb-1" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </GlassCard>
      ))}
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <GlassCard key={i} hover={false} className="text-center">
          <Skeleton variant="circular" className="w-24 h-24 mx-auto mb-4" />
          <Skeleton className="h-5 w-28 mx-auto mb-2" />
          <Skeleton className="h-4 w-36 mx-auto mb-2" />
          <Skeleton className="h-3 w-full" />
        </GlassCard>
      ))}
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-5 w-40" />
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, onNavigate }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [teamRes, settingsRes] = await Promise.all([
          fetch('/api/team'),
          fetch('/api/site-settings'),
        ]);

        if (cancelled) return;

        if (teamRes.ok) {
          const teamJson = await teamRes.json();
          if (teamJson.success) {
            setTeamMembers(teamJson.data.members ?? []);
          }
        }

        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          if (settingsJson.success) {
            setSettings(settingsJson.data.settings ?? {});
            setStats(settingsJson.data.stats ?? null);
          }
        }
      } catch {
        // Silent fail — page renders with empty states
      } finally {
        if (!cancelled) {
          setLoadingTeam(false);
          setLoadingSettings(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const companyName = settings.company_name || 'Styra';
  const companyTagline = settings.company_tagline;
  const companyDescription = settings.company_description;
  const supportEmail = settings.support_email;
  const phone = settings.phone;
  const address = settings.address;

  const statsCards = stats
    ? [
        { value: `${stats.total_providers.toLocaleString()}+`, label: 'Service Providers', icon: Shield },
        { value: `${stats.total_customers.toLocaleString()}+`, label: 'Happy Customers', icon: Users },
        { value: `${stats.total_cities}+`, label: 'Cities Covered', icon: Globe },
        { value: stats.avg_rating.toFixed(1), label: 'Average Rating', icon: Award },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* ── Hero ─────────────────────────────────────────── */}
        <FadeIn className="text-center mb-16">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="glass-card p-8 rounded-2xl mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              About <GradientText>{companyName}</GradientText>
            </h1>
            {loadingSettings ? (
              <div className="max-w-3xl mx-auto space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4 mx-auto" />
              </div>
            ) : (
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {companyDescription ||
                  `We're on a mission to revolutionize the grooming industry by connecting ` +
                  `talented professionals with customers who value quality and convenience.`}
              </p>
            )}
            {companyTagline && (
              <GlassBadge className="mt-6 inline-flex items-center gap-1.5">
                <Star className="h-3 w-3" />
                {companyTagline}
              </GlassBadge>
            )}
          </motion.div>
        </FadeIn>

        {/* ── Stats ────────────────────────────────────────── */}
        <FadeIn delay={0.1} className="mb-16">
          {loadingSettings ? (
            <StatsSkeleton />
          ) : stats ? (
            <StaggerChildren className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsCards.map((stat) => (
                <StaggerItem key={stat.label}>
                  <GlassCard variant="gradient" glow className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-3 shadow-lg"
                    >
                      <stat.icon className="h-7 w-7 text-white" />
                    </motion.div>
                    <div className="text-3xl font-bold mb-1 gradient-text">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </GlassCard>
                </StaggerItem>
              ))}
            </StaggerChildren>
          ) : (
            <p className="text-center text-muted-foreground py-8">Stats are temporarily unavailable.</p>
          )}
        </FadeIn>

        {/* ── Our Story ────────────────────────────────────── */}
        <FadeIn delay={0.2}>
          <GlassCard variant="elevated" glow className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Our Story</h2>
            </div>
            <div className="prose prose-slate max-w-none">
              <p className="text-muted-foreground mb-4">
                {companyName} was born from a simple frustration: finding a great barber or stylist
                in Nairobi shouldn&apos;t require hours of research, phone calls, and trial and error.
                Our founders experienced this firsthand and decided to build a better way.
              </p>
              <p className="text-muted-foreground mb-4">
                What started as a simple booking platform has evolved into a comprehensive ecosystem
                that empowers service providers to grow their businesses while giving customers
                unprecedented access to quality grooming services.
              </p>
              <p className="text-muted-foreground">
                Today, we&apos;re proud to serve customers and businesses across East Africa,
                all while staying true to our founding principle: making self-care accessible to everyone.
              </p>
            </div>
          </GlassCard>
        </FadeIn>

        {/* ── Our Values ───────────────────────────────────── */}
        <FadeIn delay={0.3}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Our Values</h2>
            <p className="text-muted-foreground mt-2">The principles that guide everything we do</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard variant="bordered" hover className="text-center h-full">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-lg"
                  >
                    <value.icon className="h-8 w-8 text-white" />
                  </motion.div>
                  <h3 className="font-semibold mb-2 text-lg">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* ── Timeline ─────────────────────────────────────── */}
        <FadeIn delay={0.4}>
          <GlassCard variant="bordered" glow className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Our Journey</h2>
            </div>
            <div className="space-y-6">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.year}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-16">
                    <span className="inline-block px-3 py-1 rounded-lg gradient-bg text-white text-sm font-bold">
                      {milestone.year}
                    </span>
                  </div>
                  <div className="flex-1 pb-6 border-b border-border last:border-0">
                    <p className="text-muted-foreground">{milestone.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>

        {/* ── Team ─────────────────────────────────────────── */}
        <FadeIn delay={0.5}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Meet Our Team</h2>
            <p className="text-muted-foreground mt-2">The people behind {companyName}</p>
          </div>
          {loadingTeam ? (
            <TeamSkeleton />
          ) : teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard variant="elevated" hover className="text-center">
                    <div className="relative mb-4">
                      {member.image ? (
                        <motion.img
                          whileHover={{ scale: 1.05 }}
                          src={member.image}
                          alt={member.name}
                          className="w-24 h-24 rounded-full mx-auto object-cover ring-4 ring-primary/20"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full mx-auto gradient-bg flex items-center justify-center ring-4 ring-primary/20">
                          <Users className="h-10 w-10 text-white" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold">{member.name}</h3>
                    <p className="text-sm gradient-text font-medium mb-2">{member.role}</p>
                    {member.bio && (
                      <p className="text-sm text-muted-foreground">{member.bio}</p>
                    )}
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          ) : (
            <GlassCard hover={false} className="text-center py-12 mb-16">
              <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No team members listed yet.</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Check back soon to meet the team.</p>
            </GlassCard>
          )}
        </FadeIn>

        {/* ── CTA ──────────────────────────────────────────── */}
        <FadeIn delay={0.6}>
          <GlassCard variant="gradient" glow={false} hover={false} className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-xl"
            >
              <TrendingUp className="h-10 w-10 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-4">Join Our Growing Community</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Whether you&apos;re a service provider looking to grow your business or a customer
              seeking quality grooming services, {companyName} is here for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <GlassButton
                variant="primary"
                size="lg"
                leftIcon={<CheckCircle2 className="h-5 w-5" />}
                onClick={(e) => { e.stopPropagation(); onNavigate?.('onboarding'); }}
                className="shadow-glow"
              >
                Become a Provider
              </GlassButton>
              <GlassButton
                variant="outline"
                size="lg"
                leftIcon={<Users className="h-5 w-5" />}
                onClick={(e) => { e.stopPropagation(); onNavigate?.('marketplace'); }}
              >
                Find Services
              </GlassButton>
            </div>
          </GlassCard>
        </FadeIn>

        {/* ── Contact Info ─────────────────────────────────── */}
        <div className="mt-16 text-center">
          <GlassCard className="inline-block">
            <h3 className="font-semibold mb-4">Get in Touch</h3>
            {loadingSettings ? (
              <ContactSkeleton />
            ) : (address || phone || supportEmail) ? (
              <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
                {address && (
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                      <MapPin className="h-3 w-3 text-white" />
                    </span>
                    {address}
                  </span>
                )}
                {address && phone && <span className="hidden sm:inline">·</span>}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                      <Phone className="h-3 w-3 text-white" />
                    </span>
                    {phone}
                  </a>
                )}
                {phone && supportEmail && <span className="hidden sm:inline">·</span>}
                {supportEmail && (
                  <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                      <Mail className="h-3 w-3 text-white" />
                    </span>
                    {supportEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Contact information coming soon.</p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
