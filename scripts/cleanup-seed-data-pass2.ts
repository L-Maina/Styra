import { PrismaClient } from '@prisma/client';

/**
 * Styra Database Cleanup - Pass 2
 *
 * Removes remaining seed users and their data:
 * - Business owners whose businesses were deleted (seed providers)
 * - Seed customer accounts
 * - Orphaned reviews and bookings from seed data
 */
const prisma = new PrismaClient();

// Seed business owner emails (their businesses are already deleted)
const SEED_PROVIDER_EMAILS = [
  'jane.wanjiku@nairobistylehub.co.ke',
  'grace.akinyi@glamourstudio.co.ke',
  'david.otieno@kisumugrooms.co.ke',
  'samuel.kiprop@eldoretbarber.co.ke',
  'amina.hassan@mombasaspa.co.ke',
  'peter.kamau@nakurustyle.co.ke',
  'wanjiku.ngugi@nailparlour.co.ke',
  'omar.juma@coastgrooming.co.ke',
  'esther.chebet@skinclinic.co.ke',
  'frank.muraya@tattookenya.co.ke',
];

// Seed customer emails
const SEED_CUSTOMER_EMAILS = [
  'john.mwangi@gmail.com',
  'mary.njeri@gmail.com',
  'joseph.kariuki@gmail.com',
  'sarah.wambui@gmail.com',
  'michael.odhiambo@gmail.com',
  'lucy.wangari@gmail.com',
  'eric.kipchoge@gmail.com',
  'agnes.mumbi@gmail.com',
  'kevin.onyango@gmail.com',
];

// Duplicate admin accounts to remove (keep only admin@styra.app)
const DUPLICATE_ADMIN_EMAILS = [
  'admin@styra.co.ke',
  'admin@styra.com',
];

const ALL_SEED_EMAILS = [...SEED_PROVIDER_EMAILS, ...SEED_CUSTOMER_EMAILS, ...DUPLICATE_ADMIN_EMAILS];

async function main() {
  console.log('🧹 Starting cleanup pass 2 — seed users...\n');

  const seedUsers = await prisma.user.findMany({
    where: { email: { in: ALL_SEED_EMAILS } },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log(`Found ${seedUsers.length} seed users to delete:`);
  seedUsers.forEach(u => console.log(`  - ${u.name} (${u.email}, ${u.role})`));

  if (seedUsers.length === 0) {
    console.log('No seed users found. Done!');
    return;
  }

  const userIds = seedUsers.map(u => u.id);

  // ── Delete in correct FK order ────────────────────────────────

  // 1. Find bookings for these users
  const customerBookings = await prisma.booking.findMany({
    where: { customerId: { in: userIds } },
    select: { id: true },
  });
  const bookingIds = customerBookings.map(b => b.id);
  console.log(`\nFound ${bookingIds.length} bookings for seed users`);

  // 2. Escrows (references bookings)
  const d1 = await prisma.escrow.deleteMany({ where: { bookingId: { in: bookingIds } } });
  console.log(`  Escrows deleted: ${d1.count}`);

  // 3. Disputes
  const d2 = await prisma.dispute.deleteMany({
    where: { OR: [{ customerId: { in: userIds } }, { providerId: { in: userIds } }] },
  });
  console.log(`  Disputes deleted: ${d2.count}`);

  // 4. Payments (references bookings AND users)
  const d3 = await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
  console.log(`  Payments deleted: ${d3.count}`);

  // 5. Reviews by these users
  const d4 = await prisma.review.deleteMany({ where: { customerId: { in: userIds } } });
  console.log(`  Reviews deleted: ${d4.count}`);

  // 6. Bookings
  const d5 = await prisma.booking.deleteMany({ where: { customerId: { in: userIds } } });
  console.log(`  Bookings deleted: ${d5.count}`);

  // 7. Other user-related records
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

  // 8. Delete the users
  const d6 = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`  Users deleted: ${d6.count}`);

  // ── Also clean up any orphaned reviews/bookings ───────────────
  console.log('\n📋 Checking for orphaned data...');

  // Reviews that reference non-existent users or businesses
  const remainingReviews = await prisma.review.findMany({
    select: { id: true, customerId: true, businessId: true },
  });
  const remainingUserIds = (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);
  const remainingBusinessIds = (await prisma.business.findMany({ select: { id: true } })).map(b => b.id);

  const orphanedReviews = remainingReviews.filter(
    r => !remainingUserIds.includes(r.customerId) || !remainingBusinessIds.includes(r.businessId)
  );
  if (orphanedReviews.length > 0) {
    const dr = await prisma.review.deleteMany({
      where: { id: { in: orphanedReviews.map(r => r.id) } },
    });
    console.log(`  Orphaned reviews deleted: ${dr.count}`);
  }

  // ── Final verification ────────────────────────────────────────
  console.log('\n📋 Final state:');

  const finalBusinesses = await prisma.business.findMany({
    select: { id: true, name: true, city: true, isVerified: true },
  });
  console.log(`\n  Businesses (${finalBusinesses.length}):`);
  finalBusinesses.forEach(b => console.log(`    ✅ ${b.name} (${b.city}, verified: ${b.isVerified})`));

  const finalUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  console.log(`\n  Users (${finalUsers.length}):`);
  finalUsers.forEach(u => console.log(`    ✅ ${u.name} (${u.email}, ${u.role})`));

  console.log(`\n  Reviews: ${await prisma.review.count()}`);
  console.log(`  Bookings: ${await prisma.booking.count()}`);
  console.log(`  Services: ${await prisma.service.count()}`);
  console.log(`  Payments: ${await prisma.payment.count()}`);

  console.log('\n✨ Pass 2 cleanup completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
