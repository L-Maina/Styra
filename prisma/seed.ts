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
      role: 'customer',
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
      role: 'business',
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
      role: 'admin',
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
