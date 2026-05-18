'use client';

import React from 'react';
import { Lock, ArrowLeft, Eye, Database, Bell, Shield, Users, Globe } from 'lucide-react';
import { GlassCard, GradientText, FadeIn } from '@/components/ui/custom/glass-components';

const privacySections = [
  {
    icon: Eye,
    title: 'Information We Collect',
    content: `We collect information to provide and improve our services:\n\nAccount Information: Name, email address, phone number, and password when you register.\n\nBusiness Information: Business name, address, services offered, pricing, and operating hours for service providers.\n\nTransaction Data: Booking history, payment information, and service preferences.\n\nUsage Data: Pages visited, features used, device information, and interaction patterns.\n\nLocation Data: With your consent, we may collect location data to show nearby services.\n\nCommunication Data: Messages between users, support tickets, and feedback.`,
  },
  {
    icon: Database,
    title: 'How We Use Your Information',
    content: `Your information is used to:\n\n• Provide, maintain, and improve our services\n• Process transactions and send related notifications\n• Personalize your experience and show relevant content\n• Communicate with you about your account, bookings, and updates\n• Verify your identity and protect against fraud\n• Analyze usage patterns to improve our platform\n• Comply with legal obligations\n• Respond to customer support inquiries`,
  },
  {
    icon: Lock,
    title: 'Data Security',
    content: `We implement industry-standard security measures to protect your data:\n\n• All data is encrypted in transit using TLS/SSL\n• Passwords are hashed using bcrypt (never stored in plain text)\n• Payment information is processed through secure PCI-compliant providers\n• Regular security audits and penetration testing\n• Access controls limiting data access to authorized personnel\n• Automatic session timeouts for inactive accounts\n• Two-factor authentication available for added security`,
  },
  {
    icon: Users,
    title: 'Data Sharing',
    content: `We do not sell your personal information. We may share data with:\n\n• Service Providers: Booking details needed to provide services (name, booking time, service requested)\n• Payment Processors: Transaction data needed to process payments\n• Analytics Partners: Anonymized usage data to improve our services\n• Legal Authorities: When required by law or to protect our rights\n• Business Partners: Only with your explicit consent\n\nYou can control what information is visible on your public profile.`,
  },
  {
    icon: Bell,
    title: 'Your Rights & Choices',
    content: `You have the right to:\n\n• Access: Request a copy of your personal data\n• Correction: Update or correct inaccurate information\n• Deletion: Request deletion of your account and data\n• Portability: Export your data in a standard format\n• Opt-out: Unsubscribe from marketing communications\n• Restriction: Limit how we process your data\n• Objection: Object to certain types of data processing\n\nTo exercise these rights, contact us at privacy@styra.app or through your account settings.`,
  },
  {
    icon: Globe,
    title: 'Cookies & Tracking',
    content: `We use cookies and similar technologies to:\n\n• Keep you logged in (authentication cookies)\n• Remember your preferences (preference cookies)\n• Analyze site usage (analytics cookies)\n• Deliver relevant content (content cookies)\n\nYou can manage cookie preferences in your browser settings. Disabling cookies may affect certain features of the platform.`,
  },
  {
    icon: Shield,
    title: 'Data Retention',
    content: `We retain your data as follows:\n\n• Account Data: For as long as your account is active\n• Transaction Data: 7 years for legal and tax compliance\n• Support Communications: 3 years after resolution\n• Usage Analytics: 2 years (anonymized after 6 months)\n• Marketing Data: Until you unsubscribe\n\nUpon account deletion, personal data is removed within 30 days, except where retention is required by law.`,
  },
];

export default function PrivacyPage() {
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
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <GradientText>Privacy Policy</GradientText>
          </h1>
          <p className="text-muted-foreground">Last updated: January 15, 2025</p>
        </FadeIn>

        {/* Introduction */}
        <FadeIn delay={0.1}>
          <GlassCard variant="bordered" className="mb-8">
            <p className="text-muted-foreground">
              At Styra, we take your privacy seriously. This Privacy Policy explains how we collect, 
              use, disclose, and safeguard your information when you use our platform. Please read 
              this policy carefully to understand our practices regarding your personal data.
            </p>
          </GlassCard>
        </FadeIn>

        {/* Sections */}
        {privacySections.map((section, index) => (
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

        {/* Contact */}
        <FadeIn delay={0.8}>
          <GlassCard className="text-center">
            <h3 className="font-semibold mb-4">Privacy Questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              If you have questions about this Privacy Policy or our data practices, contact us:
            </p>
            <div className="space-y-1 text-sm">
              <p><strong>Email:</strong> privacy@styra.app</p>
              <p><strong>Phone:</strong> +254 712 345 678</p>
              <p><strong>Address:</strong> Westlands Business Park, Westlands, Nairobi, Kenya</p>
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
}
