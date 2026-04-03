'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Newspaper,
  Mail,
  Download,
  ExternalLink,
  Quote,
  TrendingUp,
  Award,
  Users,
  Globe,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GradientText,
  FadeIn,
  GlassBadge,
} from '@/components/ui/custom/glass-components';

export const PressPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-16">
          <motion.div
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ duration: 0.3 }}
          >
            <Newspaper className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Press & <GradientText>Media</GradientText>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Get the latest news, brand assets, and media resources from Styra.
          </p>
        </FadeIn>

        {/* Contact CTA */}
        <FadeIn delay={0.1}>
          <GlassCard variant="elevated" className="p-6 md:p-8 mb-12">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Media Inquiries</h2>
                <p className="text-muted-foreground mb-1">
                  For press interviews, partnerships, or media coverage, reach out to our communications team.
                </p>
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="h-4 w-4" />
                  <a href="mailto:press@styra.app" className="font-medium hover:underline">
                    press@styra.app
                  </a>
                </div>
              </div>
              <GlassButton
                variant="primary"
                leftIcon={<Mail className="h-4 w-4" />}
              >
                Contact Us
              </GlassButton>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Quick Facts */}
        <FadeIn delay={0.15}>
          <h2 className="text-2xl font-bold mb-6">Quick Facts</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { icon: Users, value: '10K+', label: 'Active Providers' },
              { icon: Globe, value: '25+', label: 'Cities in Kenya' },
              { icon: TrendingUp, value: '50K+', label: 'Bookings Monthly' },
              { icon: Award, value: '4.9', label: 'Avg. Rating' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                <GlassCard className="p-4 text-center">
                  <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* About Styra */}
        <FadeIn delay={0.2}>
          <h2 className="text-2xl font-bold mb-6">About Styra</h2>
          <GlassCard className="p-6 md:p-8 mb-12">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Styra is Kenya&apos;s leading grooming marketplace, connecting customers with
              verified barbers, salons, and grooming professionals. Founded with a mission to
              modernize the grooming industry in Africa, Styra provides a seamless platform for
              discovering, booking, and reviewing grooming services.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              From haircuts and beard grooming to skincare and spa treatments, Styra offers a
              comprehensive range of services through a network of over 10,000 verified service
              providers across more than 25 cities in Kenya.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our platform features real-time booking, secure payments, verified reviews, and
              an innovative trust & safety system that ensures both customers and providers have
              a safe and reliable experience.
            </p>
          </GlassCard>
        </FadeIn>

        {/* Brand Guidelines */}
        <FadeIn delay={0.25}>
          <h2 className="text-2xl font-bold mb-6">Brand Guidelines</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <GlassCard className="p-6">
              <h3 className="font-semibold mb-3">Brand Colors</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#6C4EFF]" />
                  <div>
                    <p className="text-sm font-medium">Primary Purple</p>
                    <p className="text-xs text-muted-foreground">#6C4EFF</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#3ABEFF]" />
                  <div>
                    <p className="text-sm font-medium">Secondary Blue</p>
                    <p className="text-xs text-muted-foreground">#3ABEFF</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#6FE3FF]" />
                  <div>
                    <p className="text-sm font-medium">Accent Cyan</p>
                    <p className="text-xs text-muted-foreground">#6FE3FF</p>
                  </div>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="font-semibold mb-3">Logo Usage</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The Styra logo should always be used with sufficient clear space around it.
                Never stretch, rotate, or alter the logo colors. Use the approved brand
                assets only.
              </p>
              <GlassButton
                variant="outline"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
              >
                Download Brand Kit
              </GlassButton>
            </GlassCard>
          </div>
        </FadeIn>

        {/* What Press Says */}
        <FadeIn delay={0.3}>
          <h2 className="text-2xl font-bold mb-6">In the Press</h2>
          <div className="space-y-6 mb-12">
            {[
              {
                source: 'TechCrunch Africa',
                quote: 'Styra is revolutionizing how Kenyans find and book grooming services, bringing trust and transparency to an industry that needed it.',
                date: 'December 2024',
              },
              {
                source: 'Business Daily',
                quote: 'With over 10,000 verified providers, Styra has become the go-to platform for personal grooming services across Kenya.',
                date: 'November 2024',
              },
              {
                source: 'Nairobi Tech Week',
                quote: 'Styra\'s innovative approach to the grooming marketplace earned them the Best Consumer App award at this year\'s showcase.',
                date: 'October 2024',
              },
            ].map((item, i) => (
              <motion.div
                key={item.source}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
              >
                <GlassCard className="p-6">
                  <Quote className="h-8 w-8 text-primary/20 mb-3" />
                  <p className="text-muted-foreground italic mb-4 leading-relaxed">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.source}</p>
                      <p className="text-sm text-muted-foreground">{item.date}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Press Kit Download */}
        <FadeIn delay={0.35}>
          <GlassCard variant="elevated" className="p-6 md:p-8 text-center">
            <Download className="h-10 w-10 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Press Kit</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Download our complete press kit including logos, brand guidelines,
              product screenshots, and company fact sheet.
            </p>
            <GlassButton
              variant="primary"
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download Press Kit
            </GlassButton>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
};

export default PressPage;
