'use client';

import React from 'react';
import { Scale, ArrowLeft } from 'lucide-react';
import { GlassCard, GradientText, FadeIn } from '@/components/ui/custom/glass-components';

const termsSections = [
  {
    title: 'Acceptance of Terms',
    content: `By accessing and using Styra, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our platform. These terms apply to all visitors, users, and service providers who access or use our services.`,
  },
  {
    title: 'User Accounts & Responsibilities',
    content: `You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:\n\n• Provide accurate and complete information during registration\n• Update your information promptly if it changes\n• Not create multiple accounts to circumvent restrictions\n• Not share your account credentials with others\n• Notify us immediately of any unauthorized access or security breach\n\nWe reserve the right to suspend or terminate accounts that violate these terms or engage in suspicious activity.`,
  },
  {
    title: 'Service Provider Guidelines',
    content: `Service providers on Styra must:\n\n• Maintain valid licenses and certifications required by local laws\n• Provide services as described in their listings\n• Honor booked appointments and pricing\n• Maintain professional conduct with all customers\n• Not discriminate based on race, gender, religion, or other protected characteristics\n• Respond to customer inquiries within a reasonable timeframe\n• Maintain clean and safe service environments\n\nViolations may result in removal from the platform and forfeiture of any pending payments.`,
  },
  {
    title: 'Payments & Fees',
    content: `Styra facilitates payments between customers and service providers. By using our payment system, you agree to:\n\n• Pay all fees and charges associated with your bookings\n• Provide valid payment information\n• Not dispute legitimate charges\n• Accept our processing fees as outlined at checkout\n\nFor service providers, we charge a commission fee on each completed booking, which is automatically deducted from your earnings. Current fee structures are available in your provider dashboard.`,
  },
  {
    title: 'Cancellations & Refunds',
    content: `Booking Cancellation Policy:\n• Customers may cancel bookings up to 24 hours before the appointment for a full refund\n• Cancellations within 24 hours may incur a cancellation fee of up to 50% of the service price\n• No-shows will be charged the full service price\n\nService Provider Cancellations:\n• Providers should give at least 24 hours notice for cancellations\n• Frequent cancellations may result in reduced visibility or account suspension\n• Customers will receive a full refund for provider-cancelled appointments`,
  },
  {
    title: 'Prohibited Activities',
    content: `Users are prohibited from:\n\n• Using the platform for any illegal purposes\n• Harassing, threatening, or abusing other users\n• Submitting false or misleading information\n• Attempting to circumvent our payment system\n• Using automated tools to scrape or access our platform\n• Impersonating other users or entities\n• Engaging in fraudulent booking activity\n• Sharing inappropriate or offensive content\n• Violating intellectual property rights\n\nWe take violations seriously and may take legal action when appropriate.`,
  },
  {
    title: 'Liability & Disclaimers',
    content: `Styra is a marketplace platform connecting customers with independent service providers. We:\n\n• Do not guarantee the quality of services provided by third-party providers\n• Are not liable for any injuries, damages, or losses resulting from services\n• Do not endorse any specific service provider\n• Are not responsible for the actions or conduct of service providers\n\nUsers agree to indemnify and hold Styra harmless from any claims arising from their use of the platform or services obtained through it.`,
  },
  {
    title: 'Dispute Resolution',
    content: `In the event of a dispute:\n\n1. First, attempt to resolve the issue directly with the other party\n2. If unresolved, contact our support team within 14 days\n3. We will investigate and may facilitate mediation\n4. Our decision on refunds and resolutions is final\n5. For legal disputes, you agree to binding arbitration\n\nStyra reserves the right to make final determinations on disputes involving platform policy violations.`,
  },
  {
    title: 'Termination',
    content: `We may suspend or terminate your account at any time for:\n\n• Violation of these Terms of Service\n• Violation of our Community Guidelines\n• Fraudulent or illegal activity\n• Extended periods of inactivity\n• At your request\n\nUpon termination, you will lose access to your account and any associated data. Provisions regarding liability, intellectual property, and dispute resolution will survive termination.`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <FadeIn>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to previous page
          </button>
        </FadeIn>

        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center mx-auto mb-6">
            <Scale className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <GradientText>Terms of Service</GradientText>
          </h1>
          <p className="text-muted-foreground">Last updated: January 15, 2025</p>
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
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{section.content}</p>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        ))}

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
}
