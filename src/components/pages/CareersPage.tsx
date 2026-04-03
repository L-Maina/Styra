'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  MapPin,
  DollarSign,
  Heart,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code,
  Palette,
  BarChart3,
  Headphones,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GradientText,
  FadeIn,
  GlassBadge,
} from '@/components/ui/custom/glass-components';

const openings = [
  {
    id: 'frontend-dev',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Nairobi, Kenya',
    type: 'Full-time',
    icon: Code,
    description: 'Build and maintain our web and mobile applications using React, Next.js, and TypeScript. You\'ll work on features used by thousands of users daily.',
    requirements: [
      '5+ years of React/Next.js experience',
      'Strong TypeScript skills',
      'Experience with Tailwind CSS and component libraries',
      'Familiarity with Node.js APIs',
      'Portfolio of shipped products',
    ],
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    department: 'Design',
    location: 'Nairobi, Kenya',
    type: 'Full-time',
    icon: Palette,
    description: 'Design intuitive and beautiful user experiences for our marketplace platform. You\'ll own the end-to-end design process from research to handoff.',
    requirements: [
      '3+ years of product design experience',
      'Proficiency in Figma or similar tools',
      'Experience with design systems',
      'Strong understanding of mobile-first design',
      'UX research experience',
    ],
  },
  {
    id: 'growth-lead',
    title: 'Growth Marketing Lead',
    department: 'Marketing',
    location: 'Nairobi, Kenya',
    type: 'Full-time',
    icon: BarChart3,
    description: 'Lead our user acquisition and retention strategies. You\'ll develop and execute marketing campaigns that drive growth across Kenya.',
    requirements: [
      '4+ years in growth or performance marketing',
      'Experience with digital marketing channels',
      'Data-driven approach to decision making',
      'Experience in the African market',
      'Strong analytical skills',
    ],
  },
  {
    id: 'customer-success',
    title: 'Customer Success Manager',
    department: 'Operations',
    location: 'Nairobi, Kenya',
    type: 'Full-time',
    icon: Headphones,
    description: 'Ensure our service providers and customers have an exceptional experience on Styra. You\'ll handle onboarding, support, and relationship management.',
    requirements: [
      '2+ years in customer success or support',
      'Excellent communication skills',
      'Experience with CRM tools',
      'Problem-solving mindset',
      'Empathy and patience',
    ],
  },
];

const perks = [
  { icon: DollarSign, label: 'Competitive Salary', desc: 'Above-market compensation' },
  { icon: Clock, label: 'Flexible Hours', desc: 'Work when you\'re most productive' },
  { icon: TrendingUp, label: 'Growth Opportunities', desc: 'Learning budget & career paths' },
  { icon: Heart, label: 'Health Benefits', desc: 'Medical insurance & wellness' },
  { icon: Users, label: 'Great Team', desc: 'Collaborative & diverse culture' },
  { icon: Sparkles, label: 'Latest Tools', desc: 'Modern tech stack & equipment' },
];

export const CareersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <motion.div
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ duration: 0.3 }}
          >
            <Briefcase className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Join <GradientText>Styra</GradientText>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Help us transform the grooming industry in Africa. We&apos;re looking for
            passionate people who want to make a real impact.
          </p>
        </FadeIn>

        {/* Why Styra */}
        <FadeIn delay={0.1} className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Work at Styra?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {perks.map((perk, i) => (
              <motion.div
                key={perk.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
              >
                <GlassCard className="p-5 text-center h-full">
                  <perk.icon className="h-7 w-7 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold text-sm mb-1">{perk.label}</h3>
                  <p className="text-xs text-muted-foreground">{perk.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Open Positions */}
        <FadeIn delay={0.2}>
          <h2 className="text-2xl font-bold mb-6">
            Open Positions
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({openings.length} openings)
            </span>
          </h2>
          <div className="space-y-6 mb-16">
            {openings.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
              >
                <GlassCard className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Icon */}
                    <div className="h-14 w-14 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
                      <job.icon className="h-7 w-7 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold">{job.title}</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <GlassBadge variant="primary" className="text-xs">
                            {job.department}
                          </GlassBadge>
                          <GlassBadge variant="secondary" className="text-xs">
                            {job.type}
                          </GlassBadge>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">{job.description}</p>

                      {/* Requirements */}
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Requirements:</p>
                        <ul className="grid sm:grid-cols-2 gap-1">
                          {job.requirements.map((req) => (
                            <li key={req} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 text-primary/60 mt-0.5 flex-shrink-0" />
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <GlassButton
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        Apply Now
                      </GlassButton>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Don't see a role? */}
        <FadeIn delay={0.3}>
          <GlassCard variant="elevated" className="p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Don&apos;t see the right role?</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              We&apos;re always looking for talented people. Send us your resume and
              we&apos;ll reach out when a suitable position opens up.
            </p>
            <GlassButton
              variant="outline"
              leftIcon={<Briefcase className="h-4 w-4" />}
            >
              Send General Application
            </GlassButton>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
};

export default CareersPage;
