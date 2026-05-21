'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Star } from 'lucide-react';
import { GlassButton, FadeIn, GradientText } from '@/components/ui/custom/glass-components';

interface CTASectionProps {
  onNavigate?: (page: string) => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onNavigate }) => {
  const benefits = [
    'List your business for free',
    'Reach new customers',
    'Manage bookings easily',
    'Grow your brand online',
  ];

  const [stats, setStats] = useState<{
    total_providers: number;
    average_rating: number;
  } | null>(null);

  // Fetch real stats from the API
  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setStats({
            total_providers: json.data.total_providers,
            average_rating: json.data.average_rating,
          });
        }
      })
      .catch(() => {
        // Stats are non-critical
      });
  }, []);

  return (
    <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-bg opacity-10" />
      <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Left Content */}
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Star className="h-4 w-4 fill-current" />
              For Business Owners
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
              Grow Your Business with{' '}
              <GradientText>Styra</GradientText>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              Join grooming professionals across Kenya who trust Styra to 
              grow their business. List your services, manage bookings, and reach 
              new customers every day.
            </p>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2 min-w-0"
                >
                  <div className="h-5 w-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs sm:text-sm truncate">{benefit}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <GlassButton
                variant="primary"
                size="lg"
                onClick={() => onNavigate?.('register')}
              >
                List Your Business
                <ArrowRight className="h-4 w-4 ml-2" />
              </GlassButton>
              <GlassButton
                variant="outline"
                size="lg"
                onClick={() => onNavigate?.('about')}
              >
                Learn More
              </GlassButton>
            </div>
          </FadeIn>

          {/* Right Content - Real Stats Card */}
          <FadeIn delay={0.2}>
            <div className="glass-card p-5 sm:p-6 lg:p-8 glow">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Join the Community</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Be part of Kenya&apos;s growing grooming marketplace
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <StatItem
                  value={stats ? String(stats.total_providers) : '—'}
                  label="Service Providers"
                />
                <StatItem
                  value={stats && stats.average_rating > 0 ? `${stats.average_rating}★` : '—'}
                  label="Average Rating"
                />
              </div>

              <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-center">
                  <span className="font-semibold text-primary">Free to get started:</span>{' '}
                  List your business and start receiving bookings today!
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

// Stat Item Component
interface StatItemProps {
  value: string;
  label: string;
}

const StatItem: React.FC<StatItemProps> = ({ value, label }) => (
  <div className="text-center min-w-0">
    <div className="text-xl sm:text-2xl font-bold gradient-text mb-1">{value}</div>
    <div className="text-xs sm:text-sm text-muted-foreground mb-1">{label}</div>
  </div>
);

export default CTASection;
