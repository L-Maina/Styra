import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Create Users ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 12);

  const customer = await prisma.user.create({
    data: {
      email: 'john@example.com',
      password: passwordHash,
      name: 'John Mwangi',
      phone: '+254712345678',
      role: 'customer',
      isVerified: true,
    },
  });
  console.log('✅ Created customer:', customer.email);

  const businessOwner = await prisma.user.create({
    data: {
      email: 'jane@styleshop.co.ke',
      password: passwordHash,
      name: 'Jane Wanjiku',
      phone: '+254723456789',
      role: 'business',
      isVerified: true,
    },
  });
  console.log('✅ Created business owner:', businessOwner.email);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@styra.app',
      password: passwordHash,
      name: 'Admin User',
      role: 'admin',
      isVerified: true,
    },
  });
  console.log('✅ Created admin:', admin.email);

  // ── 2. Create Businesses ─────────────────────────────────────────────
  const business1 = await prisma.business.create({
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
  console.log('✅ Created business:', business1.name);

  const business2 = await prisma.business.create({
    data: {
      ownerId: businessOwner.id,
      name: 'Glamour Studio',
      description: 'Full-service salon specializing in women\'s haircuts, blowouts, and color treatments.',
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
  console.log('✅ Created business:', business2.name);

  const business3 = await prisma.business.create({
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
  console.log('✅ Created business:', business3.name);

  // ── 3. Create Services ───────────────────────────────────────────────
  // Business 1 services
  const service1 = await prisma.service.create({
    data: {
      businessId: business1.id,
      name: 'Classic Cut',
      description: 'Traditional barber cut with styling',
      price: 500,
      duration: 30,
      category: 'Haircuts',
    },
  });
  const service2 = await prisma.service.create({
    data: {
      businessId: business1.id,
      name: 'Beard Trim',
      description: 'Professional beard shaping and trimming',
      price: 300,
      duration: 20,
      category: 'Beard',
    },
  });
  const service3 = await prisma.service.create({
    data: {
      businessId: business1.id,
      name: 'Full Grooming',
      description: 'Complete grooming package: haircut, beard trim, and facial',
      price: 800,
      duration: 60,
      category: 'Packages',
    },
  });
  console.log('✅ Created 3 services for Nairobi Style Hub');

  // Business 2 services
  const service4 = await prisma.service.create({
    data: {
      businessId: business2.id,
      name: "Women's Cut",
      description: 'Professional women\'s haircut and styling',
      price: 700,
      duration: 45,
      category: 'Haircuts',
    },
  });
  const service5 = await prisma.service.create({
    data: {
      businessId: business2.id,
      name: 'Blowout',
      description: 'Professional blowout and styling',
      price: 500,
      duration: 30,
      category: 'Styling',
    },
  });
  const service6 = await prisma.service.create({
    data: {
      businessId: business2.id,
      name: 'Color Treatment',
      description: 'Full hair color treatment with premium products',
      price: 2000,
      duration: 90,
      category: 'Color',
    },
  });
  console.log('✅ Created 3 services for Glamour Studio');

  // Business 3 services
  const service7 = await prisma.service.create({
    data: {
      businessId: business3.id,
      name: 'Premium Cut',
      description: 'Luxury haircut with premium products and consultation',
      price: 1000,
      duration: 45,
      category: 'Haircuts',
    },
  });
  const service8 = await prisma.service.create({
    data: {
      businessId: business3.id,
      name: 'Hot Towel Shave',
      description: 'Traditional hot towel straight razor shave',
      price: 600,
      duration: 30,
      category: 'Shaves',
    },
  });
  const service9 = await prisma.service.create({
    data: {
      businessId: business3.id,
      name: 'Hair Treatment',
      description: 'Deep conditioning hair treatment for healthy hair',
      price: 1500,
      duration: 60,
      category: 'Treatments',
    },
  });
  console.log('✅ Created 3 services for The Grooming Lounge');

  // ── 4. Create Staff ──────────────────────────────────────────────────
  const staff1 = await prisma.staff.create({
    data: {
      businessId: business1.id,
      name: 'James Otieno',
      role: 'Senior Barber',
      phone: '+254730000001',
      bio: '10+ years of experience in men\'s grooming',
    },
  });
  const staff2 = await prisma.staff.create({
    data: {
      businessId: business1.id,
      name: 'Peter Kamau',
      role: 'Barber',
      phone: '+254730000002',
      bio: 'Specializes in fades and modern cuts',
    },
  });

  const staff3 = await prisma.staff.create({
    data: {
      businessId: business2.id,
      name: 'Mary Akinyi',
      role: 'Senior Stylist',
      phone: '+254730000003',
      bio: 'Expert in women\'s haircuts and color',
    },
  });
  const staff4 = await prisma.staff.create({
    data: {
      businessId: business2.id,
      name: 'Grace Wambui',
      role: 'Stylist',
      phone: '+254730000004',
      bio: 'Blowout and styling specialist',
    },
  });

  const staff5 = await prisma.staff.create({
    data: {
      businessId: business3.id,
      name: 'David Mwangi',
      role: 'Master Barber',
      phone: '+254730000005',
      bio: 'Award-winning barber with 15 years experience',
    },
  });
  const staff6 = await prisma.staff.create({
    data: {
      businessId: business3.id,
      name: 'Samuel Kiprop',
      role: 'Barber',
      phone: '+254730000006',
      bio: 'Specialist in hot towel shaves and treatments',
    },
  });
  console.log('✅ Created 6 staff members (2 per business)');

  // ── 5. Create Bookings ───────────────────────────────────────────────
  // Pending booking at Nairobi Style Hub
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const booking1 = await prisma.booking.create({
    data: {
      customerId: customer.id,
      businessId: business1.id,
      serviceId: service1.id,
      staffId: staff1.id,
      date: tomorrowStr,
      time: '10:00',
      endTime: '10:30',
      status: 'pending',
      totalPrice: 500,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      staffName: staff1.name,
      serviceName: service1.name,
      servicePrice: service1.price,
    },
  });
  console.log('✅ Created pending booking at Nairobi Style Hub');

  // Completed booking at Glamour Studio
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);
  const pastDateStr = pastDate.toISOString().split('T')[0];

  const booking2 = await prisma.booking.create({
    data: {
      customerId: customer.id,
      businessId: business2.id,
      serviceId: service4.id,
      staffId: staff3.id,
      date: pastDateStr,
      time: '14:00',
      endTime: '14:45',
      status: 'completed',
      totalPrice: 700,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      staffName: staff3.name,
      serviceName: service4.name,
      servicePrice: service4.price,
      completedAt: new Date(pastDateStr + 'T14:45:00.000Z'),
    },
  });
  console.log('✅ Created completed booking at Glamour Studio');

  // ── 6. Create Review ─────────────────────────────────────────────────
  const review = await prisma.review.create({
    data: {
      bookingId: booking2.id,
      customerId: customer.id,
      businessId: business2.id,
      rating: 5,
      comment: 'Amazing experience! Mary did a fantastic job with my haircut. The salon was clean and welcoming. Highly recommend!',
    },
  });
  console.log('✅ Created review (5 stars) for completed booking');

  // ── 7. Create Notifications ──────────────────────────────────────────
  const notif1 = await prisma.notification.create({
    data: {
      userId: customer.id,
      title: 'Booking Confirmed',
      message: `Your booking at ${business1.name} for Classic Cut on ${tomorrowStr} at 10:00 AM has been confirmed.`,
      type: 'booking',
      isRead: false,
      link: `/bookings/${booking1.id}`,
    },
  });
  const notif2 = await prisma.notification.create({
    data: {
      userId: customer.id,
      title: 'Rate Your Experience',
      message: `How was your visit to ${business2.name}? Leave a review to help others find great services.`,
      type: 'review',
      isRead: true,
      link: `/bookings/${booking2.id}`,
    },
  });
  console.log('✅ Created 2 notifications for John');

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n📊 Seed Summary:');
  console.log('  - 3 Users (1 customer, 1 business, 1 admin)');
  console.log('  - 3 Businesses');
  console.log('  - 9 Services (3 per business)');
  console.log('  - 6 Staff (2 per business)');
  console.log('  - 2 Bookings (1 pending, 1 completed)');
  console.log('  - 1 Review (5 stars)');
  console.log('  - 2 Notifications');
  console.log('\n✨ Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
