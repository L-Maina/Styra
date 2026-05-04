'use client';

import React from 'react';
import { Shield, ArrowLeft, Scissors, BadgeCheck, Clock, AlertTriangle, CreditCard, Star } from 'lucide-react';
import { GlassCard, GradientText, FadeIn } from '@/components/ui/custom/glass-components';

const policySections = [
  {
    icon: BadgeCheck,
    title: 'Provider Verification',
    content: `All service providers on Styra must complete our verification process before accepting bookings. This includes:\n\n• Valid government-issued ID (Passport, National ID, or Driver's License)\n• Business registration documents (where applicable)\n• Professional licenses or certifications\n• A clear photo of your business premises or workspace\n\nVerification typically takes 1-2 business days. You'll receive a notification once your application is reviewed.`,
  },
  {
    icon: Scissors,
    title: 'Service Standards',
    content: `Providers must maintain high service standards:\n\n• Services must match the descriptions and pricing listed on your profile\n• Use professional-grade tools and products\n• Maintain a clean, safe, and hygienic workspace\n• Follow all applicable health and safety regulations\n• Provide accurate service duration estimates\n• Keep your availability calendar up to date\n\nFailure to maintain standards may result in negative reviews, reduced visibility, or account suspension.`,
  },
  {
    icon: Clock,
    title: 'Booking & Availability',
    content: `When you accept bookings on Styra:\n\n• Honor all confirmed bookings at the scheduled time\n• Arrive on time for mobile/in-home services\n• Provide at least 24 hours notice for cancellations\n• Keep your availability calendar accurate and up to date\n• Respond to booking requests within 2 hours during business hours\n• Set realistic service durations to avoid back-to-back delays\n\nExcessive cancellations or no-shows will result in warnings and potential account suspension.`,
  },
  {
    icon: CreditCard,
    title: 'Payments & Earnings',
    content: `Styra handles all payments through our secure platform:\n\n• Service fees are automatically deducted from completed bookings\n• Earnings are available for withdrawal after a 24-hour holding period\n• The current platform commission rate is displayed in your dashboard\n• All prices listed must include applicable taxes\n• Refunds for service issues are handled through our dispute resolution process\n• Minimum withdrawal amount: KES 500\n\nPayment processing typically takes 1-3 business days to reach your account.`,
  },
  {
    icon: Star,
    title: 'Reviews & Ratings',
    content: `Customer reviews are essential to your success on Styra:\n\n• Customers can leave reviews after completed bookings\n• Respond to reviews professionally, whether positive or negative\n• Do not solicit fake reviews or offer incentives for positive ratings\n• Report suspicious or fraudulent reviews to our support team\n• Your overall rating affects your visibility in search results\n• Providers with ratings below 3.0 may face reduced visibility or additional review`,
  },
  {
    icon: Shield,
    title: 'Code of Conduct',
    content: `All providers must adhere to our Code of Conduct:\n\n• Treat all customers with respect and professionalism\n• Do not discriminate based on race, gender, religion, or other protected characteristics\n• Maintain appropriate boundaries with customers\n• Do not share customer personal information with third parties\n• Communicate clearly about services, pricing, and expectations\n• Resolve disputes amicably before escalating to support`,
  },
  {
    icon: AlertTriangle,
    title: 'Violations & Penalties',
    content: `Violations of provider policies may result in:\n\n• First offense: Written warning\n• Second offense: Temporary suspension (1-7 days)\n• Third offense: Extended suspension (up to 30 days)\n• Severe violations: Permanent removal from the platform\n\nSevere violations include fraud, harassment, safety violations, and illegal activities. These may result in immediate permanent removal.`,
  },
];

export default function ProviderPoliciesPage() {
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
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <GradientText>Provider Policies</GradientText>
          </h1>
          <p className="text-muted-foreground">Last updated: January 15, 2025</p>
        </FadeIn>

        {/* Introduction */}
        <FadeIn delay={0.1}>
          <GlassCard variant="bordered" className="mb-8">
            <p className="text-muted-foreground">
              These policies outline the standards and expectations for all service providers on Styra. 
              By listing your services on our platform, you agree to adhere to these guidelines. 
              We reserve the right to update these policies at any time.
            </p>
          </GlassCard>
        </FadeIn>

        {/* Sections */}
        {policySections.map((section, index) => (
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
            <h3 className="font-semibold mb-4">Questions About Provider Policies?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              If you have any questions about these policies, please contact our provider support team:
            </p>
            <div className="space-y-1 text-sm">
              <p><strong>Email:</strong> providers@styra.app</p>
              <p><strong>Phone:</strong> +254 712 345 678</p>
              <p><strong>Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM EAT</p>
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
}
