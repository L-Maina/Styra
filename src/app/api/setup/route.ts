import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rate-limit';

// Rate limit setup endpoint to prevent abuse
const setupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many setup attempts. Please try again later.',
});

/**
 * Generate a cryptographically secure random password.
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/**
 * Default platform settings to seed on first setup.
 */
const DEFAULT_PLATFORM_SETTINGS = [
  { key: 'company_name', value: 'Styra' },
  { key: 'company_tagline', value: 'Your Style, On Demand. Discover grooming services across Kenya, book instantly, and look your best every day.' },
  { key: 'company_description', value: "Styra is Kenya's leading grooming marketplace, connecting customers with verified barbers, salons, and grooming professionals." },
  { key: 'support_email', value: 'support@styra.app' },
  { key: 'press_email', value: 'press@styra.app' },
  { key: 'phone', value: '+254 712 345 678' },
  { key: 'address', value: 'Nairobi, Kenya' },
  { key: 'social_instagram', value: 'https://instagram.com/styra' },
  { key: 'social_twitter', value: 'https://twitter.com/styra' },
  { key: 'social_facebook', value: 'https://facebook.com/styra' },
  { key: 'social_tiktok', value: 'https://tiktok.com/@styra' },
  { key: 'social_linkedin', value: 'https://linkedin.com/company/styra' },
  { key: 'whatsapp_number', value: '+254 712 345 678' },
  { key: 'business_hours', value: 'Mon-Fri 8am-6pm EAT' },
  { key: 'support_response_time', value: 'Within 24 hours' },
  { key: 'website_url', value: 'https://styra.app' },
  { key: 'site_name', value: 'Styra' },
];

/**
 * Default FAQs to seed if none exist.
 */
const DEFAULT_FAQS = [
  { question: 'How do I book an appointment?', answer: 'Browse our marketplace or map to find a service provider, select your desired service, choose an available time slot, and complete your booking.', category: 'booking', order: 1, isPublished: true },
  { question: 'Can I reschedule or cancel my appointment?', answer: 'Yes! You can reschedule or cancel through your dashboard up to 24 hours before the scheduled time for a full refund.', category: 'booking', order: 2, isPublished: true },
  { question: 'What payment methods do you accept?', answer: 'We accept all major credit and debit cards, PayPal, Apple Pay, Google Pay, and M-Pesa in supported regions.', category: 'payments', order: 1, isPublished: true },
  { question: 'How do I become a service provider?', answer: 'Click "Become a Provider" and complete the onboarding process. Our team will review your application within 2-3 business days.', category: 'provider', order: 1, isPublished: true },
  { question: 'How do I create an account?', answer: 'Click "Sign Up" on our homepage, enter your email and create a password, or sign up using Google.', category: 'account', order: 1, isPublished: true },
];

/**
 * POST /api/setup
 *
 * Admin-only one-time setup endpoint.
 * Creates the admin user, platform settings, and default FAQs.
 * NO demo/fake data — all business data must come from real users.
 *
 * SECURITY:
 *   - No hardcoded passwords — generates a random one per invocation
 *   - Passwords are NEVER returned in the response body
 *   - Rate limited to 5 attempts per hour
 *   - Only available in development mode
 *   - Requires SETUP_SECRET if set in environment
 */
export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await setupRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Disable setup endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Setup is not available in production' },
      { status: 403 }
    );
  }

  try {
    // Check if setup key is required (optional security layer)
    const body = await request.json().catch(() => ({}));
    const setupKey = body.setupKey || request.headers.get('x-setup-key');

    // If SETUP_SECRET is set in env, require it
    if (process.env.SETUP_SECRET && setupKey !== process.env.SETUP_SECRET) {
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 403 }
      );
    }

    const results: Record<string, string> = {};

    // ── 1. Create Admin User ──────────────────────────────────
    const adminEmail = 'admin@styra.app';
    const existingAdmin = await db.user.findUnique({
      where: { email: adminEmail },
    });

    let adminPasswordGenerated = false;

    if (existingAdmin) {
      results.admin = `Admin user already exists (${existingAdmin.email})`;
    } else {
      const password = generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      await db.user.create({
        data: {
          email: adminEmail,
          password: passwordHash,
          name: 'Styra Admin',
          role: 'ADMIN',
          isVerified: true,
        },
      });
      results.admin = `Created admin user: ${adminEmail}`;
      adminPasswordGenerated = true;
      // Log the password to server console only (never to API response)
      console.log(`[Setup] Admin account created for ${adminEmail}. Password has been set.`);
      console.log(`[Setup] Admin password: ${password}`);
      console.log('[Setup] ⚠️ Save this password — it will not be shown again.');
    }

    // ── 2. Create Platform Settings ───────────────────────────
    let settingsCreated = 0;
    let settingsSkipped = 0;

    for (const entry of DEFAULT_PLATFORM_SETTINGS) {
      const existing = await db.platformSetting.findUnique({
        where: { key: entry.key },
      });
      if (existing) {
        settingsSkipped++;
      } else {
        await db.platformSetting.create({
          data: { key: entry.key, value: entry.value },
        });
        settingsCreated++;
      }
    }

    results.platformSettings = settingsCreated > 0
      ? `Created ${settingsCreated} platform settings${settingsSkipped > 0 ? ` (${settingsSkipped} already existed)` : ''}`
      : `All ${settingsSkipped} platform settings already exist`;

    // ── 3. Create Default FAQs ────────────────────────────────
    const faqCount = await db.fAQ.count();

    if (faqCount > 0) {
      results.faqs = `${faqCount} FAQs already exist — skipping`;
    } else {
      await db.fAQ.createMany({
        data: DEFAULT_FAQS,
      });
      results.faqs = `Created ${DEFAULT_FAQS.length} default FAQs`;
    }

    // ── Response ──────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: adminPasswordGenerated
        ? 'Setup complete! Admin account created.'
        : 'Setup complete! Admin account already existed.',
      admin: {
        email: adminEmail,
        passwordGenerated: adminPasswordGenerated,
      },
      instructions: {
        step1: 'Check the server console for the generated admin password',
        step2: 'Go to the Sign In page',
        step3: `Sign in with email: ${adminEmail}`,
        step4: 'Enter the password from the server console',
        step5: 'You will be redirected to the Admin Dashboard',
        note: 'You can change the password after first login from the Admin Dashboard settings. The password is only shown once in the server logs.',
      },
      details: results,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      {
        error: 'Setup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy browser testing
export async function GET() {
  return NextResponse.json({
    message: 'POST to /api/setup to create the admin user and platform configuration',
    usage: 'Send a POST request to this endpoint to run the setup',
    note: 'No demo/fake data is created. Only the admin account, platform settings, and default FAQs are seeded.',
  });
}
