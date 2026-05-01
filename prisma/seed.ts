import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Styra Database Seed — Idempotent (safe to run multiple times)
 * 
 * Creates demo users, businesses, services, staff, bookings, and reviews.
 * Skips any records that already exist.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
 *   or: bun run db:seed
 */
async function main() {
  console.log('🌱 Seeding database...\n');

  const passwordHash = await bcrypt.hash('password123', 12);

  // ── 1. Create Users (upsert by email) ──────────────────────────────
  const customer = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      password: passwordHash,
      name: 'John Mwangi',
      phone: '+254712345678',
      role: 'CUSTOMER',
      isVerified: true,
    },
  });
  console.log('✅ Customer:', customer.email, customer.createdAt.getTime() > Date.now() - 5000 ? '(created)' : '(exists)');

  const businessOwner = await prisma.user.upsert({
    where: { email: 'jane@styleshop.co.ke' },
    update: {},
    create: {
      email: 'jane@styleshop.co.ke',
      password: passwordHash,
      name: 'Jane Wanjiku',
      phone: '+254723456789',
      role: 'BUSINESS_OWNER',
      isVerified: true,
    },
  });
  console.log('✅ Business Owner:', businessOwner.email, businessOwner.createdAt.getTime() > Date.now() - 5000 ? '(created)' : '(exists)');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@styra.app' },
    update: {},
    create: {
      email: 'admin@styra.app',
      password: passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('✅ Admin:', admin.email, admin.createdAt.getTime() > Date.now() - 5000 ? '(created)' : '(exists)');

  // ── 2. Create Businesses (skip if any exist) ───────────────────────
  const businessCount = await prisma.business.count();
  let business1, business2, business3;

  if (businessCount > 0) {
    const existing = await prisma.business.findMany({ take: 3 });
    business1 = existing[0];
    business2 = existing[1];
    business3 = existing[2];
    console.log(`✅ ${businessCount} businesses already exist — skipping`);
  } else {
    business1 = await prisma.business.create({
      data: {
        ownerId: businessOwner.id,
        name: 'Nairobi Style Hub',
        description: 'Premium barbershop offering classic and modern grooming services in the heart of Nairobi.',
        category: 'Barber Services',
        address: '123 Kenyatta Ave',
        city: 'Nairobi',
        country: 'Kenya',
        phone: '+254720000001',
        email: 'info@nairobistylehub.co.ke',
        rating: 4.8,
        reviewCount: 24,
        isVerified: true,
        isActive: true,
      },
    });
    business2 = await prisma.business.create({
      data: {
        ownerId: businessOwner.id,
        name: 'Glamour Studio',
        description: "Full-service salon specializing in women's haircuts, blowouts, and color treatments.",
        category: 'Haircuts & Styling',
        address: '456 Moi Avenue',
        city: 'Nairobi',
        country: 'Kenya',
        phone: '+254720000002',
        email: 'info@glamourstudio.co.ke',
        rating: 4.6,
        reviewCount: 18,
        isVerified: true,
        isActive: true,
      },
    });
    business3 = await prisma.business.create({
      data: {
        ownerId: businessOwner.id,
        name: 'The Grooming Lounge',
        description: 'Luxury grooming experience with premium products and skilled barbers.',
        category: 'Haircuts & Styling',
        address: '789 Uhuru Gardens',
        city: 'Nairobi',
        country: 'Kenya',
        phone: '+254720000003',
        email: 'info@thegroominglounge.co.ke',
        rating: 4.9,
        reviewCount: 31,
        isVerified: true,
        isActive: true,
      },
    });
    console.log('✅ Created 3 businesses');
  }

  // ── 3. Create Services (skip if any exist for these businesses) ────
  const serviceCount = await prisma.service.count();
  if (serviceCount > 0) {
    console.log(`✅ ${serviceCount} services already exist — skipping`);
  } else if (business1 && business2 && business3) {
    await prisma.service.createMany({
      data: [
        { businessId: business1.id, name: 'Classic Cut', description: 'Traditional barber cut with styling', price: 500, duration: 30, category: 'Haircuts' },
        { businessId: business1.id, name: 'Beard Trim', description: 'Professional beard shaping and trimming', price: 300, duration: 20, category: 'Beard' },
        { businessId: business1.id, name: 'Full Grooming', description: 'Complete grooming package: haircut, beard trim, and facial', price: 800, duration: 60, category: 'Packages' },
        { businessId: business2.id, name: "Women's Cut", description: "Professional women's haircut and styling", price: 700, duration: 45, category: 'Haircuts' },
        { businessId: business2.id, name: 'Blowout', description: 'Professional blowout and styling', price: 500, duration: 30, category: 'Styling' },
        { businessId: business2.id, name: 'Color Treatment', description: 'Full hair color treatment with premium products', price: 2000, duration: 90, category: 'Color' },
        { businessId: business3.id, name: 'Premium Cut', description: 'Luxury haircut with premium products and consultation', price: 1000, duration: 45, category: 'Haircuts' },
        { businessId: business3.id, name: 'Hot Towel Shave', description: 'Traditional hot towel straight razor shave', price: 600, duration: 30, category: 'Shaves' },
        { businessId: business3.id, name: 'Hair Treatment', description: 'Deep conditioning hair treatment for healthy hair', price: 1500, duration: 60, category: 'Treatments' },
      ],
    });
    console.log('✅ Created 9 services (3 per business)');
  }

  // ── 4. Create Staff (skip if any exist) ────────────────────────────
  const staffCount = await prisma.staff.count();
  if (staffCount > 0) {
    console.log(`✅ ${staffCount} staff already exist — skipping`);
  } else if (business1 && business2 && business3) {
    await prisma.staff.createMany({
      data: [
        { businessId: business1.id, name: 'James Otieno', role: 'Senior Barber', phone: '+254730000001', bio: "10+ years of experience in men's grooming" },
        { businessId: business1.id, name: 'Peter Kamau', role: 'Barber', phone: '+254730000002', bio: 'Specializes in fades and modern cuts' },
        { businessId: business2.id, name: 'Mary Akinyi', role: 'Senior Stylist', phone: '+254730000003', bio: "Expert in women's haircuts and color" },
        { businessId: business2.id, name: 'Grace Wambui', role: 'Stylist', phone: '+254730000004', bio: 'Blowout and styling specialist' },
        { businessId: business3.id, name: 'David Mwangi', role: 'Master Barber', phone: '+254730000005', bio: 'Award-winning barber with 15 years experience' },
        { businessId: business3.id, name: 'Samuel Kiprop', role: 'Barber', phone: '+254730000006', bio: 'Specialist in hot towel shaves and treatments' },
      ],
    });
    console.log('✅ Created 6 staff members');
  }

  // ── 5. Create Job Listings (skip if any exist) ────────────────────
  const jobCount = await prisma.job.count();
  if (jobCount > 0) {
    console.log(`✅ ${jobCount} jobs already exist — skipping`);
  } else {
    await prisma.job.createMany({
      data: [
        {
          title: 'Senior Frontend Engineer',
          department: 'Engineering',
          location: 'Nairobi, Kenya',
          type: 'Full-time',
          description: 'Build and maintain our web and mobile applications using React, Next.js, and TypeScript. You\'ll work on features used by thousands of users daily.',
          requirements: JSON.stringify([
            '5+ years of React/Next.js experience',
            'Strong TypeScript skills',
            'Experience with Tailwind CSS and component libraries',
            'Familiarity with Node.js APIs',
            'Portfolio of shipped products',
          ]),
          status: 'OPEN',
        },
        {
          title: 'Product Designer',
          department: 'Design',
          location: 'Nairobi, Kenya',
          type: 'Full-time',
          description: 'Design intuitive and beautiful user experiences for our marketplace platform. You\'ll own the end-to-end design process from research to handoff.',
          requirements: JSON.stringify([
            '3+ years of product design experience',
            'Proficiency in Figma or similar tools',
            'Experience with design systems',
            'Strong understanding of mobile-first design',
            'UX research experience',
          ]),
          status: 'OPEN',
        },
        {
          title: 'Growth Marketing Lead',
          department: 'Marketing',
          location: 'Nairobi, Kenya',
          type: 'Full-time',
          description: 'Lead our user acquisition and retention strategies. You\'ll develop and execute marketing campaigns that drive growth across Kenya.',
          requirements: JSON.stringify([
            '4+ years in growth or performance marketing',
            'Experience with digital marketing channels',
            'Data-driven approach to decision making',
            'Experience in the African market',
            'Strong analytical skills',
          ]),
          status: 'OPEN',
        },
        {
          title: 'Customer Success Manager',
          department: 'Operations',
          location: 'Nairobi, Kenya',
          type: 'Full-time',
          description: 'Ensure our service providers and customers have an exceptional experience on Styra. You\'ll handle onboarding, support, and relationship management.',
          requirements: JSON.stringify([
            '2+ years in customer success or support',
            'Excellent communication skills',
            'Experience with CRM tools',
            'Problem-solving mindset',
            'Empathy and patience',
          ]),
          status: 'OPEN',
        },
      ],
    });
    console.log('✅ Created 4 job listings');
  }

  // ── 6. Seed Platform Settings (upsert by key) ─────────────────────
  const settingEntries = [
    { key: 'company_name', value: 'Styra' },
    { key: 'company_tagline', value: 'Your Style, On Demand. Discover grooming services across Kenya, book instantly, and look your best every day.' },
    { key: 'company_description', value: 'Styra is Kenya\'s leading grooming marketplace, connecting customers with verified barbers, salons, and grooming professionals. Founded with a mission to modernize the grooming industry in Africa, Styra provides a seamless platform for discovering, booking, and reviewing grooming services.' },
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
  console.log('✅ Seeded 9 platform settings');

  // ── 7. Seed FAQs (skip if any exist) ─────────────────────────────
  const faqCount = await prisma.fAQ.count();
  if (faqCount > 0) {
    console.log(`✅ ${faqCount} FAQs already exist — skipping`);
  } else {
    await prisma.fAQ.createMany({
      data: [
        { question: 'How do I book an appointment?', answer: 'Simply browse our marketplace or map to find a service provider, select your desired service, choose an available time slot, and complete your booking with our secure payment system. You\'ll receive a confirmation email and SMS with all the details.', category: 'booking', order: 1, isPublished: true },
        { question: 'Can I reschedule or cancel my appointment?', answer: 'Yes! You can reschedule or cancel your appointment through your dashboard up to 24 hours before the scheduled time for a full refund. Cancellations within 24 hours may incur a fee of up to 50% of the service price.', category: 'booking', order: 2, isPublished: true },
        { question: 'What if my service provider cancels?', answer: 'If a provider cancels your appointment, you\'ll receive a full refund automatically. We\'ll also help you find an alternative provider if you\'d like.', category: 'booking', order: 3, isPublished: true },
        { question: 'What payment methods do you accept?', answer: 'We accept all major credit and debit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and M-Pesa in supported regions. All payments are processed securely through our PCI-compliant payment system.', category: 'payments', order: 1, isPublished: true },
        { question: 'When will I receive my refund?', answer: 'Refunds are typically processed within 3-5 business days and will appear on your original payment method. The exact timing depends on your bank or payment provider.', category: 'payments', order: 2, isPublished: true },
        { question: 'Is my payment information secure?', answer: 'Absolutely. We use industry-standard encryption and never store your complete card details. All transactions are processed through PCI DSS compliant payment processors.', category: 'payments', order: 3, isPublished: true },
        { question: 'How do I create an account?', answer: 'Click "Sign Up" on our homepage, enter your email address and create a password, or sign up quickly using Google or Facebook. You\'ll need to verify your email to complete registration.', category: 'account', order: 1, isPublished: true },
        { question: 'I forgot my password. What should I do?', answer: 'Click "Forgot Password" on the login page and enter your email address. We\'ll send you a link to reset your password. The link expires after 24 hours for security.', category: 'account', order: 2, isPublished: true },
        { question: 'How do I delete my account?', answer: 'Go to Settings > Account > Delete Account in your dashboard. Note that this action is irreversible and you\'ll lose access to your booking history and saved providers.', category: 'account', order: 3, isPublished: true },
        { question: 'How do I become a service provider?', answer: 'Click "Become a Provider" and complete the onboarding process. You\'ll need to provide your business information, services offered, pricing, and any required licenses. Our team will review your application within 2-3 business days.', category: 'provider', order: 1, isPublished: true },
        { question: 'What fees does Styra charge?', answer: 'Styra charges a commission fee on completed bookings, which varies by subscription plan. Free tier providers pay 15%, Premium tier pays 10%, and Featured tier pays 8%. Detailed fee structures are available in your provider dashboard.', category: 'provider', order: 2, isPublished: true },
        { question: 'How do I receive my earnings?', answer: 'Earnings are automatically transferred to your linked bank account on a weekly basis. You can also request instant payouts for a small fee. Minimum payout threshold is KES 2,500.', category: 'provider', order: 3, isPublished: true },
      ],
    });
    console.log('✅ Created 12 FAQs');
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n📊 Seed Summary:');
  console.log('  - Admin:     admin@styra.app / password123');
  console.log('  - Business:  jane@styleshop.co.ke / password123');
  console.log('  - Customer:  john@example.com / password123');
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
