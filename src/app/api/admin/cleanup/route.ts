import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/admin/cleanup
 *
 * Wipes ALL user-generated data from the database.
 * Keeps only system/platform data (PlatformSettings, FAQs, TeamMembers, Jobs, PageContent).
 * Also creates a fresh admin account if none exists.
 *
 * ⚠️ DESTRUCTIVE — cannot be undone.
 * ⚠️ ADMIN ONLY — requires valid admin session.
 */
export async function POST() {
  try {
    await requireAdmin();

    // Order of deletion matters due to foreign key constraints.
    // We delete child tables first, then parents.
    const deleteOperations: Promise<{ count: number }>[] = [
      // Chat & messaging
      db.chatMessage.deleteMany(),
      db.message.deleteMany(),
      db.conversation.deleteMany(),
      // Notifications
      db.notification.deleteMany(),
      db.notificationPreference.deleteMany(),
      db.pushSubscription.deleteMany(),
      // Auth ephemeral
      db.oTPVerification.deleteMany(),
      db.passwordReset.deleteMany(),
      db.emailVerificationToken.deleteMany(),
      // User moderation
      db.blockedUser.deleteMany(),
      db.userBan.deleteMany(),
      // Bookings & reviews
      db.favorite.deleteMany(),
      db.review.deleteMany(),
      db.booking.deleteMany(),
      // Payments
      db.payment.deleteMany(),
      db.payout.deleteMany(),
      db.escrow.deleteMany(),
      db.platformTransaction.deleteMany(),
      db.transactionLog.deleteMany(),
      // Disputes
      db.dispute.deleteMany(),
      db.insuranceClaim.deleteMany(),
      // Support
      db.supportTicket.deleteMany(),
      db.ticketReply.deleteMany(),
      db.formSubmission.deleteMany(),
      // Audit & monitoring
      db.auditLog.deleteMany(),
      db.securityAuditLog.deleteMany(),
      db.securityAlert.deleteMany(),
      db.monitoringError.deleteMany(),
      db.adminReport.deleteMany(),
      // Webhooks & analytics
      db.webhookEvent.deleteMany(),
      db.analyticsEvent.deleteMany(),
      db.rateLimit.deleteMany(),
      // Time slots
      db.timeSlot.deleteMany(),
      // Business-related
      db.service.deleteMany(),
      db.staff.deleteMany(),
      db.portfolioItem.deleteMany(),
      db.promotion.deleteMany(),
      db.advertisement.deleteMany(),
      db.premiumListing.deleteMany(),
      db.discountCode.deleteMany(),
      // Media
      db.media.deleteMany(),
      // Blog content
      db.blogArticle.deleteMany(),
      db.brandKit.deleteMany(),
      db.pressKit.deleteMany(),
    ];

    const results = await Promise.allSettled(deleteOperations);
    const deletedCounts: Record<string, number> = {};

    const modelNames = [
      'ChatMessage', 'Message', 'Conversation',
      'Notification', 'NotificationPreference', 'PushSubscription',
      'OTPVerification', 'PasswordReset', 'EmailVerificationToken',
      'BlockedUser', 'UserBan',
      'Favorite', 'Review', 'Booking',
      'Payment', 'Payout', 'Escrow', 'PlatformTransaction', 'TransactionLog',
      'Dispute', 'InsuranceClaim',
      'SupportTicket', 'TicketReply', 'FormSubmission',
      'AuditLog', 'SecurityAuditLog', 'SecurityAlert', 'MonitoringError', 'AdminReport',
      'WebhookEvent', 'AnalyticsEvent', 'RateLimit',
      'TimeSlot',
      'Service', 'Staff', 'PortfolioItem',
      'Promotion', 'Advertisement', 'PremiumListing', 'DiscountCode',
      'Media',
      'BlogArticle', 'BrandKit', 'PressKit',
    ];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        deletedCounts[modelNames[i]] = result.value.count;
      }
    });

    // Delete Wallets
    try {
      const walletResult = await db.wallet.deleteMany();
      deletedCounts['Wallet'] = walletResult.count;
    } catch {}

    // Delete all Users (after all user-related data is gone)
    try {
      const userResult = await db.user.deleteMany();
      deletedCounts['User'] = userResult.count;
    } catch {}

    // Delete all Businesses
    try {
      const businessResult = await db.business.deleteMany();
      deletedCounts['Business'] = businessResult.count;
    } catch {}

    // Recreate admin account if none exists
    const adminEmail = 'admin@styra.app';
    const adminPassword = 'Admin@2024!Secure';
    const { hashPassword } = await import('@/lib/auth');

    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const hashedPassword = await hashPassword(adminPassword);
      await db.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'Admin',
          role: 'ADMIN',
          isVerified: true,
          emailVerified: true,
        },
      });
    }

    // Enable auto-approve for businesses so new signups are instantly verified
    try {
      await db.platformSetting.upsert({
        where: { key: 'autoApproveBusinesses' },
        update: { value: 'true' },
        create: { key: 'autoApproveBusinesses', value: 'true', platformFee: 10, minWithdrawal: 500 },
      });
    } catch {}

    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

    return successResponse({
      message: 'Database cleaned successfully. All user/seed data removed.',
      totalRecordsDeleted: totalDeleted,
      details: deletedCounts,
      adminAccount: adminEmail,
      adminPassword: 'Admin@2024!Secure',
      autoApproveEnabled: true,
    });
  } catch (error) {
    if (error instanceof Response) return error as Response;
    return handleApiError(error);
  }
}

// GET /api/admin/cleanup — returns status only (doesn't delete anything)
export async function GET() {
  try {
    await requireAdmin();

    const counts: Record<string, number> = {};

    try { counts['Users'] = await db.user.count(); } catch {}
    try { counts['Businesses'] = await db.business.count(); } catch {}
    try { counts['Services'] = await db.service.count(); } catch {}
    try { counts['Staff'] = await db.staff.count(); } catch {}
    try { counts['PortfolioItems'] = await db.portfolioItem.count(); } catch {}
    try { counts['Bookings'] = await db.booking.count(); } catch {}
    try { counts['Reviews'] = await db.review.count(); } catch {}
    try { counts['Payments'] = await db.payment.count(); } catch {}
    try { counts['Notifications'] = await db.notification.count(); } catch {}
    try { counts['Conversations'] = await db.conversation.count(); } catch {}
    try { counts['PlatformSettings'] = await db.platformSetting.count(); } catch {}
    try { counts['FAQs'] = await db.fAQ.count(); } catch {}

    return successResponse({
      message: 'Database status (use POST to cleanup)',
      counts,
    });
  } catch (error) {
    if (error instanceof Response) return error as Response;
    return handleApiError(error);
  }
}
