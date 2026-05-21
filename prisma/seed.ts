import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Styra Database Seed — Admin Setup Only
 *
 * Creates the essential admin account and platform configuration.
 * NO demo/fake data — all business data must come from real users.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
 *   or: bun run db:seed
 */
async function main() {
  console.log('🌱 Seeding essential data...\n');

  // Admin password from env or generate a secure one
  const adminPassword = process.env.ADMIN_PASSWORD || (() => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const bytes = new Uint8Array(20);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes).map(b => chars[b % chars.length]).join('');
  })();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@styra.app';

  // ── 1. Create Admin User ──────────────────────────────────────────
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: passwordHash,
      name: 'Styra Admin',
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('✅ Admin user:', admin.email);

  // ── 2. Seed Platform Settings ─────────────────────────────────────
  const settingEntries = [
    { key: 'company_name', value: 'Styra' },
    { key: 'company_tagline', value: 'Your Style, On Demand. Discover grooming services across Kenya, book instantly, and look your best every day.' },
    { key: 'company_description', value: 'Styra is Kenya\'s leading grooming marketplace, connecting customers with verified barbers, salons, and grooming professionals.' },
    { key: 'support_email', value: 'support@styra.app' },
    { key: 'press_email', value: 'press@styra.app' },
    { key: 'phone', value: '+254 712 345 678' },
    { key: 'address', value: 'Nairobi, Kenya' },
    { key: 'business_hours', value: 'Mon-Fri 8am-6pm EAT' },
    { key: 'site_name', value: 'Styra' },
  ];
  for (const entry of settingEntries) {
    await prisma.platformSetting.upsert({
      where: { key: entry.key },
      update: { value: entry.value },
      create: entry,
    });
  }
  console.log('✅ Platform settings seeded');

  // ── 3. Seed FAQs ──────────────────────────────────────────────────
  const faqCount = await prisma.fAQ.count();
  if (faqCount === 0) {
    await prisma.fAQ.createMany({
      data: [
        { question: 'How do I book an appointment?', answer: 'Browse our marketplace or map to find a service provider, select your desired service, choose an available time slot, and complete your booking.', category: 'booking', order: 1, isPublished: true },
        { question: 'Can I reschedule or cancel my appointment?', answer: 'Yes! You can reschedule or cancel through your dashboard up to 24 hours before the scheduled time for a full refund.', category: 'booking', order: 2, isPublished: true },
        { question: 'What payment methods do you accept?', answer: 'We accept all major credit and debit cards, PayPal, Apple Pay, Google Pay, and M-Pesa in supported regions.', category: 'payments', order: 1, isPublished: true },
        { question: 'How do I become a service provider?', answer: 'Click "Become a Provider" and complete the onboarding process. Our team will review your application within 2-3 business days.', category: 'provider', order: 1, isPublished: true },
        { question: 'How do I create an account?', answer: 'Click "Sign Up" on our homepage, enter your email and create a password, or sign up using Google.', category: 'account', order: 1, isPublished: true },
      ],
    });
    console.log('✅ FAQs seeded');
  } else {
    console.log(`✅ ${faqCount} FAQs already exist — skipping`);
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n📊 Seed Summary:');
  console.log(`  - Admin:     ${adminEmail}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`  - Password:  ${adminPassword}`);
    console.log('  ⚠️  Save this password — it won\'t be shown again. Set ADMIN_PASSWORD env var for a known password.');
  }
  console.log('\n✨ Seed completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
