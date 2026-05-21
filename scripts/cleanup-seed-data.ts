import { PrismaClient } from '@prisma/client';

/**
 * Styra Database Cleanup Script
 *
 * Removes ALL fake/seeded data from the Supabase database while preserving:
 * - Admin user (admin@styra.app)
 * - Real user-created data (like "kuriah styles")
 * - Platform settings
 * - FAQs
 *
 * Deletion order respects foreign key constraints:
 *   Escrow → Payment → Booking → Review
 *   Then: Business (cascade handles Service, Staff, Portfolio)
 *   Then: User
 */
const prisma = new PrismaClient();

// Known seed businesses to delete
const SEED_BUSINESSES = [
  'Glamour Studio Mombasa',
  'Ink Kenya Tattoo Studio',
  "Esther's Skin Care Clinic",
  'Coast Grooming & Spa',
  'The Nail Parlour Nairobi',
  'Nakuru Style Centre',
  'Mombasa Serenity Spa',
  'Eldoret Grooming Club',
  'Kisumu Grooms Lounge',
  'Glamour Studio Nairobi',
  'Nairobi Style Hub',
];

// Known seed user emails to delete (not admin, not real users)
const SEED_USER_EMAILS = [
  'alice@example.com',
  'bob@example.com',
  'carol@example.com',
  'dave@example.com',
  'eve@example.com',
  'frank@example.com',
  'grace@example.com',
  'henry@example.com',
  'ivy@example.com',
  'jack@example.com',
  'provider1@styra.app',
  'provider2@styra.app',
  'provider3@styra.app',
  'provider4@styra.app',
  'provider5@styra.app',
  'provider6@styra.app',
  'provider7@styra.app',
  'provider8@styra.app',
  'provider9@styra.app',
  'provider10@styra.app',
  'provider11@styra.app',
  'customer1@example.com',
  'customer2@example.com',
  'customer3@example.com',
  'customer4@example.com',
  'customer5@example.com',
  'test@example.com',
  'test@test.com',
  'demo@styra.app',
  'z@z.ai',
  'z@styra.app',
];

async function deleteBusinessAndRelated(businessIds: string[]) {
  if (businessIds.length === 0) return;

  console.log(`  Deleting data for ${businessIds.length} businesses...`);

  // 1. Find bookings for these businesses
  const bookings = await prisma.booking.findMany({
    where: { businessId: { in: businessIds } },
    select: { id: true },
  });
  const bookingIds = bookings.map(b => b.id);

  // 2. Delete Escrows (references both bookings and payments)
  const del1 = await prisma.escrow.deleteMany({ where: { bookingId: { in: bookingIds } } });
  console.log(`    - Escrows: ${del1.count} deleted`);

  // 3. Delete Disputes (references bookings)
  const del2 = await prisma.dispute.deleteMany({ where: { bookingId: { in: bookingIds } } });
  console.log(`    - Disputes: ${del2.count} deleted`);

  // 4. Delete Payments (references bookings)
  const del3 = await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
  console.log(`    - Payments: ${del3.count} deleted`);

  // 5. Delete Reviews (references bookings via bookingId unique)
  const del4 = await prisma.review.deleteMany({ where: { businessId: { in: businessIds } } });
  console.log(`    - Reviews: ${del4.count} deleted`);

  // 6. Now safe to delete Bookings
  const del5 = await prisma.booking.deleteMany({ where: { businessId: { in: businessIds } } });
  console.log(`    - Bookings: ${del5.count} deleted`);

  // 7. Other business-related records
  const del6 = await prisma.favorite.deleteMany({ where: { businessId: { in: businessIds } } });
  console.log(`    - Favorites: ${del6.count} deleted`);

  const del7 = await prisma.promotion.deleteMany({ where: { businessId: { in: businessIds } } });
  console.log(`    - Promotions: ${del7.count} deleted`);

  const del8 = await prisma.premiumListing.deleteMany({ where: { businessId: { in: businessIds } } });
  console.log(`    - Premium Listings: ${del8.count} deleted`);

  const del9 = await prisma.advertisement.deleteMany({ where: { businessId: { in: businessIds } } });
  console.log(`    - Advertisements: ${del9.count} deleted`);

  // 8. Time slots for services
  const services = await prisma.service.findMany({
    where: { businessId: { in: businessIds } },
    select: { id: true },
  });
  if (services.length > 0) {
    const del10 = await prisma.timeSlot.deleteMany({
      where: { serviceId: { in: services.map(s => s.id) } },
    });
    console.log(`    - Time Slots: ${del10.count} deleted`);
  }

  // 9. Delete Businesses (cascade handles services, staff, portfolio)
  const del11 = await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  console.log(`    - Businesses: ${del11.count} deleted`);
}

async function deleteUserAndRelated(userIds: string[]) {
  if (userIds.length === 0) return;

  console.log(`  Cleaning up data for ${userIds.length} users...`);

  // 1. Find bookings by these users
  const bookings = await prisma.booking.findMany({
    where: { customerId: { in: userIds } },
    select: { id: true },
  });
  const bookingIds = bookings.map(b => b.id);

  // 2. Delete Escrows first
  await prisma.escrow.deleteMany({ where: { bookingId: { in: bookingIds } } });

  // 3. Delete Disputes
  await prisma.dispute.deleteMany({
    where: { OR: [{ customerId: { in: userIds } }, { providerId: { in: userIds } }] },
  });

  // 4. Delete Payments
  await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });

  // 5. Delete Reviews
  await prisma.review.deleteMany({ where: { customerId: { in: userIds } } });

  // 6. Delete Bookings
  await prisma.booking.deleteMany({ where: { customerId: { in: userIds } } });

  // 7. Delete other user-related records
  await prisma.chatMessage.deleteMany({ where: { senderId: { in: userIds } } });
  await prisma.conversation.deleteMany({
    where: { OR: [{ participant1: { in: userIds } }, { participant2: { in: userIds } }] },
  });
  await prisma.message.deleteMany({
    where: { OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }] },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.oTPVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.passwordReset.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userBan.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.blockedUser.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { blockedId: { in: userIds } }] },
  });
  await prisma.insuranceClaim.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.media.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.formSubmission.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: userIds } } });

  // 8. Delete users
  const deleted = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`    - Users: ${deleted.count} deleted`);
}

async function main() {
  console.log('🧹 Starting database cleanup...\n');

  // ── Step 1: Find and delete seed businesses ────────────────────
  console.log('📋 Step 1: Finding seed businesses by name...');

  const seedBusinesses = await prisma.business.findMany({
    where: { name: { in: SEED_BUSINESSES } },
    select: { id: true, name: true, ownerId: true },
  });

  console.log(`  Found ${seedBusinesses.length} seed businesses:`);
  seedBusinesses.forEach(b => console.log(`    - ${b.name} (${b.id})`));

  const seedBusinessIds = seedBusinesses.map(b => b.id);
  const seedOwnerIds = [...new Set(seedBusinesses.map(b => b.ownerId))];

  if (seedBusinessIds.length > 0) {
    await deleteBusinessAndRelated(seedBusinessIds);
  }

  // ── Step 2: Also delete businesses owned by known seed users ──
  console.log('\n📋 Step 2: Checking for businesses owned by seed users...');

  const seedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_USER_EMAILS } },
    select: { id: true, email: true },
  });
  let seedUserIds = seedUsers.map(u => u.id);

  // Include owner IDs from seed businesses as well
  const allSeedOwnerIds = [...new Set([...seedUserIds, ...seedOwnerIds])];

  if (allSeedOwnerIds.length > 0) {
    const additionalBusinesses = await prisma.business.findMany({
      where: { ownerId: { in: allSeedOwnerIds } },
      select: { id: true, name: true },
    });

    if (additionalBusinesses.length > 0) {
      console.log(`  Found ${additionalBusinesses.length} additional businesses owned by seed users:`);
      additionalBusinesses.forEach(b => console.log(`    - ${b.name} (${b.id})`));
      await deleteBusinessAndRelated(additionalBusinesses.map(b => b.id));
    } else {
      console.log('  No additional businesses found');
    }
  }

  // ── Step 3: Delete seed users ──────────────────────────────────
  console.log('\n📋 Step 3: Deleting seed users...');

  // Refresh list after business deletion
  const remainingSeedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_USER_EMAILS } },
    select: { id: true, email: true },
  });

  if (remainingSeedUsers.length > 0) {
    console.log(`  Found ${remainingSeedUsers.length} seed users:`);
    remainingSeedUsers.forEach(u => console.log(`    - ${u.email} (${u.id})`));

    // Also include business owners from seed businesses
    const allIdsToDelete = [...new Set([
      ...remainingSeedUsers.map(u => u.id),
      ...seedOwnerIds,
    ])];

    await deleteUserAndRelated(allIdsToDelete);
  } else {
    console.log('  No seed users found');
  }

  // ── Step 4: Verify ─────────────────────────────────────────────
  console.log('\n📋 Step 4: Final verification...');

  const remainingBusinesses = await prisma.business.findMany({
    select: { id: true, name: true, city: true, isVerified: true },
  });
  console.log(`\n  Remaining businesses (${remainingBusinesses.length}):`);
  remainingBusinesses.forEach(b => {
    console.log(`    ✅ ${b.name} (${b.city || 'no city'}, verified: ${b.isVerified})`);
  });

  const remainingUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  console.log(`\n  Remaining users (${remainingUsers.length}):`);
  remainingUsers.forEach(u => {
    console.log(`    ✅ ${u.name} (${u.email}, role: ${u.role})`);
  });

  const remainingReviews = await prisma.review.count();
  const remainingBookings = await prisma.booking.count();
  const remainingServices = await prisma.service.count();
  console.log(`\n  Remaining reviews: ${remainingReviews}`);
  console.log(`  Remaining bookings: ${remainingBookings}`);
  console.log(`  Remaining services: ${remainingServices}`);

  console.log('\n✨ Cleanup completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
