'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Star } from 'lucide-react';
import { GlassButton, FadeIn, GradientText } from '@/components/ui/custom/glass-components';

interface CTASectionProps {
  onNavigate?: (page: string) => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onNavigate }) => {
  const benefits = [
    'List your business for free',
    'Reach thousands of customers',
    'Manage bookings easily',
    'Grow your brand online',
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-bg opacity-10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Star className="h-4 w-4 fill-current" />
              For Business Owners
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Grow Your Business with{' '}
              <GradientText>Styra</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of grooming professionals who trust Styra to 
              grow their business. List your services, manage bookings, and reach 
              new customers every day.
            </p>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <div className="h-5 w-5 rounded-full gradient-bg flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm">{benefit}</span>
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

          {/* Right Content - Stats Card */}
          <FadeIn delay={0.2}>
            <div className="glass-card p-8 glow">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2">Business Growth Stats</h3>
                <p className="text-muted-foreground text-sm">
                  Average performance of businesses on Styra
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <StatItem
                  value="3x"
                  label="More Bookings"
                  trend="+150%"
                />
                <StatItem
                  value="85%"
                  label="Customer Retention"
                  trend="+25%"
                />
                <StatItem
                  value="$5K+"
                  label="Monthly Revenue"
                  trend="+200%"
                />
                <StatItem
                  value="4.8★"
                  label="Average Rating"
                  trend="+0.5"
                />
              </div>

              <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-center">
                  <span className="font-semibold text-primary">Limited Time:</span>{' '}
                  Get 3 months of Premium features free when you sign up today!
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
  trend: string;
}

const StatItem: React.FC<StatItemProps> = ({ value, label, trend }) => (
  <div className="text-center">
    <div className="text-2xl font-bold gradient-text mb-1">{value}</div>
    <div className="text-sm text-muted-foreground mb-1">{label}</div>
    <div className="text-xs text-green-600 font-medium">{trend}</div>
  </div>
);

export default CTASection;
