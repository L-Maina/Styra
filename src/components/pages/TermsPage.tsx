'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Scale, 
  AlertTriangle,
  Users,
  CreditCard,
  Shield,
  Ban,
  RefreshCw,
  MessageSquare,
  Gavel
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GradientText,
  FadeIn
} from '@/components/ui/custom/glass-components';

interface TermsPageProps {
  onBack: () => void;
}

const termsSections = [
  {
    icon: FileText,
    title: 'Acceptance of Terms',
    content: `By accessing and using Styra, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our platform. These terms apply to all visitors, users, and service providers who access or use our services.`,
  },
  {
    icon: Users,
    title: 'User Accounts & Responsibilities',
    content: `You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:

• Provide accurate and complete information during registration
• Update your information promptly if it changes
• Not create multiple accounts to circumvent restrictions
• Not share your account credentials with others
• Notify us immediately of any unauthorized access or security breach

We reserve the right to suspend or terminate accounts that violate these terms or engage in suspicious activity.`,
  },
  {
    icon: Scale,
    title: 'Service Provider Guidelines',
    content: `Service providers on Styra must:

• Maintain valid licenses and certifications required by local laws
• Provide services as described in their listings
• Honor booked appointments and pricing
• Maintain professional conduct with all customers
• Not discriminate based on race, gender, religion, or other protected characteristics
• Respond to customer inquiries within a reasonable timeframe
• Maintain clean and safe service environments

Violations may result in removal from the platform and forfeiture of any pending payments.`,
  },
  {
    icon: CreditCard,
    title: 'Payments & Fees',
    content: `Styra facilitates payments between customers and service providers. By using our payment system, you agree to:

• Pay all fees and charges associated with your bookings
• Provide valid payment information
• Not dispute legitimate charges
• Accept our processing fees as outlined at checkout

For service providers, we charge a commission fee on each completed booking, which is automatically deducted from your earnings. Current fee structures are available in your provider dashboard.`,
  },
  {
    icon: RefreshCw,
    title: 'Cancellations & Refunds',
    content: `Booking Cancellation Policy:
• Customers may cancel bookings up to 24 hours before the appointment for a full refund
• Cancellations within 24 hours may incur a cancellation fee of up to 50% of the service price
• No-shows will be charged the full service price

Service Provider Cancellations:
• Providers should give at least 24 hours notice for cancellations
• Frequent cancellations may result in reduced visibility or account suspension
• Customers will receive a full refund for provider-cancelled appointments`,
  },
  {
    icon: Ban,
    title: 'Prohibited Activities',
    content: `Users are prohibited from:

• Using the platform for any illegal purposes
• Harassing, threatening, or abusing other users
• Submitting false or misleading information
• Attempting to circumvent our payment system
• Using automated tools to scrape or access our platform
• Impersonating other users or entities
• Engaging in fraudulent booking activity
• Sharing inappropriate or offensive content
• Violating intellectual property rights

We take violations seriously and may take legal action when appropriate.`,
  },
  {
    icon: Shield,
    title: 'Liability & Disclaimers',
    content: `Styra is a marketplace platform connecting customers with independent service providers. We:

• Do not guarantee the quality of services provided by third-party providers
• Are not liable for any injuries, damages, or losses resulting from services
• Do not endorse any specific service provider
• Are not responsible for the actions or conduct of service providers

Users agree to indemnify and hold Styra harmless from any claims arising from their use of the platform or services obtained through it.`,
  },
  {
    icon: Gavel,
    title: 'Dispute Resolution',
    content: `In the event of a dispute:

1. First, attempt to resolve the issue directly with the other party
2. If unresolved, contact our support team within 14 days
3. We will investigate and may facilitate mediation
4. Our decision on refunds and resolutions is final
5. For legal disputes, you agree to binding arbitration

Styra reserves the right to make final determinations on disputes involving platform policy violations.`,
  },
  {
    icon: AlertTriangle,
    title: 'Termination',
    content: `We may suspend or terminate your account at any time for:

• Violation of these Terms of Service
• Violation of our Community Guidelines
• Fraudulent or illegal activity
• Extended periods of inactivity
• At your request

Upon termination, you will lose access to your account and any associated data. Provisions regarding liability, intellectual property, and dispute resolution will survive termination.`,
  },
];

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
  const lastUpdated = 'January 15, 2025';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center mx-auto mb-6">
            <Scale className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <GradientText>Terms of Service</GradientText>
          </h1>
          <p className="text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </FadeIn>

        {/* Introduction */}
        <FadeIn delay={0.1}>
          <GlassCard variant="bordered" className="mb-8">
            <p className="text-muted-foreground">
              Welcome to Styra! These Terms of Service govern your use of our platform and 
              services. By accessing or using Styra, you agree to be bound by these terms. 
              Please read them carefully before using our services.
            </p>
          </GlassCard>
        </FadeIn>

        {/* Sections */}
        {termsSections.map((section, index) => (
          <FadeIn key={section.title} delay={0.1 + index * 0.05}>
            <GlassCard className="mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0">
                  <section.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{section.content}</p>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        ))}

        {/* Intellectual Property */}
        <FadeIn delay={0.5}>
          <GlassCard variant="gradient" className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Intellectual Property</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Styra and its associated trademarks, logos, and content are the property of 
                Styra Inc. and are protected by intellectual property laws.
              </p>
              <p>
                You may not use our trademarks or branding without prior written consent. User-generated 
                content remains the property of the user, but by posting content on our platform, you 
                grant us a non-exclusive license to use, display, and distribute that content in 
                connection with our services.
              </p>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Governing Law */}
        <FadeIn delay={0.6}>
          <GlassCard className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms of Service shall be governed by and construed in accordance with the laws 
              of the Republic of Kenya. Any disputes arising from these terms shall be resolved 
              in the courts of Nairobi, Kenya, and you consent to personal jurisdiction in those courts.
            </p>
          </GlassCard>
        </FadeIn>

        {/* Changes to Terms */}
        <FadeIn delay={0.7}>
          <GlassCard variant="elevated" className="mb-8">
            <div className="flex items-start gap-4">
              <MessageSquare className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-2">Changes to Terms</h3>
                <p className="text-sm text-muted-foreground">
                  We reserve the right to modify these terms at any time. We will notify users of 
                  significant changes via email and through our platform. Your continued use of 
                  Styra after changes become effective constitutes acceptance of the revised terms.
                </p>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Contact */}
        <FadeIn delay={0.8}>
          <GlassCard className="text-center">
            <h3 className="font-semibold mb-4">Questions About Our Terms?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-1 text-sm">
              <p><strong>Email:</strong> legal@styra.app</p>
              <p><strong>Phone:</strong> +254 712 345 678</p>
              <p><strong>Address:</strong> Westlands Business Park, Westlands, Nairobi, Kenya</p>
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
};

export default TermsPage;
