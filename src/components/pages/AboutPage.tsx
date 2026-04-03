'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Heart, 
  Target, 
  Award,
  Globe,
  Building2,
  Lightbulb,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GradientText,
  FadeIn,
  StaggerChildren,
  StaggerItem
} from '@/components/ui/custom/glass-components';

interface AboutPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

const stats = [
  { value: '10K+', label: 'Service Providers', icon: Building2 },
  { value: '50K+', label: 'Happy Customers', icon: Users },
  { value: '100+', label: 'Cities Covered', icon: Globe },
  { value: '4.9', label: 'Average Rating', icon: Award },
];

const team = [
  {
    name: 'Alexandra Chen',
    role: 'CEO & Co-Founder',
    bio: 'Former VP at a Fortune 500 company with 15+ years in beauty tech.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face',
  },
  {
    name: 'Marcus Johnson',
    role: 'CTO & Co-Founder',
    bio: 'Tech visionary who scaled platforms serving millions of users.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  },
  {
    name: 'Sophia Martinez',
    role: 'Head of Operations',
    bio: 'Operations expert with deep experience in marketplace dynamics.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
  },
  {
    name: 'David Kim',
    role: 'Head of Partnerships',
    bio: 'Built partnerships with 500+ beauty brands across Africa.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  },
];

const values = [
  {
    icon: Heart,
    title: 'Customer First',
    description: 'Every decision we make starts with our customers in mind.',
  },
  {
    icon: Target,
    title: 'Excellence',
    description: 'We strive for the highest quality in everything we do.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Building bridges between providers and customers.',
  },
  {
    icon: Lightbulb,
    title: 'Innovation',
    description: 'Constantly improving to serve you better.',
  },
];

const milestones = [
  { year: '2020', event: 'Styra founded in Nairobi, Kenya' },
  { year: '2021', event: 'Expanded to major cities across Kenya' },
  { year: '2022', event: 'Launched mobile apps, reached 1M+ bookings' },
  { year: '2023', event: 'Regional expansion to Uganda, Tanzania, and Rwanda' },
  { year: '2024', event: '10,000+ verified service providers on platform' },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, onNavigate }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <FadeIn className="text-center mb-16">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="glass-card p-8 rounded-2xl mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              About <GradientText>Styra</GradientText>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We&apos;re on a mission to revolutionize the grooming industry in Kenya by connecting 
              talented professionals with customers who value quality and convenience.
            </p>
          </motion.div>
        </FadeIn>

        {/* Stats */}
        <StaggerChildren className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((stat) => (
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

        {/* Our Story */}
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
                Styra was born from a simple frustration: finding a great barber or stylist 
                in Nairobi shouldn&apos;t require hours of research, phone calls, and trial and error. Our founders 
                experienced this firsthand and decided to build a better way.
              </p>
              <p className="text-muted-foreground mb-4">
                What started as a simple booking platform has evolved into a comprehensive ecosystem 
                that empowers service providers across Kenya to grow their businesses while giving customers 
                unprecedented access to quality grooming services.
              </p>
              <p className="text-muted-foreground">
                Today, we&apos;re proud to serve customers and businesses across East Africa, 
                all while staying true to our founding principle: 
                making self-care accessible to everyone.
              </p>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Our Values */}
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

        {/* Timeline */}
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

        {/* Team */}
        <FadeIn delay={0.5}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Meet Our Team</h2>
            <p className="text-muted-foreground mt-2">The people behind Styra</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard variant="elevated" hover className="text-center">
                  <div className="relative mb-4">
                    <motion.img
                      whileHover={{ scale: 1.05 }}
                      src={member.image}
                      alt={member.name}
                      className="w-24 h-24 rounded-full mx-auto object-cover ring-4 ring-primary/20"
                    />
                  </div>
                  <h3 className="font-semibold">{member.name}</h3>
                  <p className="text-sm gradient-text font-medium mb-2">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.bio}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Contact Section */}
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
              Whether you&apos;re a service provider looking to grow your business in Kenya or a customer 
              seeking quality grooming services, Styra is here for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <GlassButton 
                variant="primary" 
                size="lg"
                leftIcon={<CheckCircle2 className="h-5 w-5" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.('onboarding');
                }}
                className="shadow-glow"
              >
                Become a Provider
              </GlassButton>
              <GlassButton 
                variant="outline" 
                size="lg"
                leftIcon={<Users className="h-5 w-5" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.('marketplace');
                }}
              >
                Find Services
              </GlassButton>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Contact Info */}
        <div className="mt-16 text-center">
          <GlassCard className="inline-block">
            <h3 className="font-semibold mb-4">Get in Touch</h3>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-white" />
                </span>
                Westlands Business Park, Westlands, Nairobi, Kenya
              </span>
              <span className="hidden sm:inline">•</span>
              <a href="tel:+254712345678" className="flex items-center gap-2 hover:text-primary transition-colors">
                <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                  <Phone className="h-3 w-3 text-white" />
                </span>
                +254 712 345 678
              </a>
              <span className="hidden sm:inline">•</span>
              <a href="mailto:hello@styra.app" className="flex items-center gap-2 hover:text-primary transition-colors">
                <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                  <Mail className="h-3 w-3 text-white" />
                </span>
                hello@styra.app
              </a>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
