-- ============================================================
-- Styra — NEW tables only (21 additions)
-- Run this if original tables already exist
-- ============================================================

-- 1. EmailVerificationToken
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL UNIQUE,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. SecurityAuditLog
CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "route" TEXT,
    "method" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "success" BOOLEAN NOT NULL,
    "requestId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "previousHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TransactionLog
CREATE TABLE IF NOT EXISTS "TransactionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "provider" TEXT,
    "referenceId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PlatformTransaction
CREATE TABLE IF NOT EXISTS "PlatformTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "bookingId" TEXT,
    "businessId" TEXT,
    "userId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL,
    "providerAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "escrowStatus" TEXT,
    "transactionId" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "paymentMethod" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. SecurityAlert
CREATE TABLE IF NOT EXISTS "SecurityAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. WebhookEvent
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "requestBody" TEXT NOT NULL,
    "requestHeaders" TEXT,
    "ipAddress" TEXT,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "processingTimeMs" INTEGER,
    "responseCode" INTEGER,
    "relatedPaymentId" TEXT,
    "relatedBookingId" TEXT,
    "signatureValid" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_provider_providerEventId_key" UNIQUE("provider", "providerEventId")
);

-- 7. PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "endpoint" TEXT NOT NULL UNIQUE,
    "authKey" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. UserBan
CREATE TABLE IF NOT EXISTS "UserBan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "bannedBy" TEXT,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BAN',
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "endDate" TIMESTAMP(3),
    "appealStatus" TEXT NOT NULL DEFAULT 'NONE',
    "appealReason" TEXT,
    "appealDate" TIMESTAMP(3),
    "appealResolvedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. BlockedUser
CREATE TABLE IF NOT EXISTS "BlockedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "blockedId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedUser_userId_blockedId_key" UNIQUE("userId", "blockedId")
);

-- 10. NotificationPreference
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bookingUpdates" BOOLEAN NOT NULL DEFAULT true,
    "messageNotifications" BOOLEAN NOT NULL DEFAULT true,
    "promotionNotifications" BOOLEAN NOT NULL DEFAULT true,
    "reviewNotifications" BOOLEAN NOT NULL DEFAULT true,
    "paymentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Dispute
CREATE TABLE IF NOT EXISTS "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "bookingId" TEXT NOT NULL REFERENCES "Booking"("id"),
    "providerId" TEXT NOT NULL REFERENCES "User"("id"),
    "customerId" TEXT NOT NULL REFERENCES "User"("id"),
    "reason" TEXT,
    "description" TEXT,
    "resolution" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. SupportTicket
CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. TicketReply
CREATE TABLE IF NOT EXISTS "TicketReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
    "from" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "adminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. MonitoringError
CREATE TABLE IF NOT EXISTS "MonitoringError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "route" TEXT,
    "method" TEXT,
    "url" TEXT,
    "userId" TEXT,
    "userAgent" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. AdminReport
CREATE TABLE IF NOT EXISTS "AdminReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT,
    "reporterName" TEXT NOT NULL,
    "reporterEmail" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedUserName" TEXT,
    "reportedUserEmail" TEXT,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "action" TEXT,
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. AnalyticsEvent
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "properties" TEXT,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "device" TEXT,
    "page" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. BlogArticle
CREATE TABLE IF NOT EXISTS "BlogArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "featuredImage" TEXT,
    "category" TEXT,
    "tags" TEXT,
    "author" TEXT,
    "authorImage" TEXT,
    "readTime" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. PageContent
CREATE TABLE IF NOT EXISTS "PageContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. Promotion
CREATE TABLE IF NOT EXISTS "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
    "businessName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "boostLevel" INTEGER,
    "section" TEXT,
    "channels" TEXT,
    "targetAudience" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "analytics" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. Advertisement
CREATE TABLE IF NOT EXISTS "Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT,
    "businessName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "package" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. PremiumListing
CREATE TABLE IF NOT EXISTS "PremiumListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "plan" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes for new tables
-- ============================================================
CREATE INDEX IF NOT EXISTS "TransactionLog_userId_idx" ON "TransactionLog"("userId");
CREATE INDEX IF NOT EXISTS "TransactionLog_type_idx" ON "TransactionLog"("type");
CREATE INDEX IF NOT EXISTS "PlatformTransaction_type_idx" ON "PlatformTransaction"("type");
CREATE INDEX IF NOT EXISTS "PlatformTransaction_status_idx" ON "PlatformTransaction"("status");
CREATE INDEX IF NOT EXISTS "PlatformTransaction_businessId_idx" ON "PlatformTransaction"("businessId");
CREATE INDEX IF NOT EXISTS "PlatformTransaction_createdAt_idx" ON "PlatformTransaction"("createdAt");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_createdAt_idx" ON "SecurityAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "SecurityAlert_severity_idx" ON "SecurityAlert"("severity");
CREATE INDEX IF NOT EXISTS "SecurityAlert_status_idx" ON "SecurityAlert"("status");
CREATE INDEX IF NOT EXISTS "MonitoringError_resolved_idx" ON "MonitoringError"("resolved");
CREATE INDEX IF NOT EXISTS "MonitoringError_createdAt_idx" ON "MonitoringError"("createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS "AdminReport_status_idx" ON "AdminReport"("status");
CREATE INDEX IF NOT EXISTS "BlogArticle_slug_idx" ON "BlogArticle"("slug");
CREATE INDEX IF NOT EXISTS "BlogArticle_isPublished_idx" ON "BlogArticle"("isPublished");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_idx" ON "WebhookEvent"("status");
CREATE INDEX IF NOT EXISTS "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_event_idx" ON "AnalyticsEvent"("event");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- ============================================================
-- RLS for new tables only
-- ============================================================

-- Enable RLS
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlockedUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dispute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketReply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonitoringError" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PageContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Advertisement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PremiumListing" ENABLE ROW LEVEL SECURITY;

-- No anon access (service role only)
CREATE POLICY "EmailVerificationToken_no_anon" ON "EmailVerificationToken" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "SecurityAuditLog_no_anon" ON "SecurityAuditLog" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "TransactionLog_no_anon" ON "TransactionLog" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "PlatformTransaction_no_anon" ON "PlatformTransaction" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "SecurityAlert_no_anon" ON "SecurityAlert" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "WebhookEvent_no_anon" ON "WebhookEvent" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "PushSubscription_no_anon" ON "PushSubscription" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "UserBan_no_anon" ON "UserBan" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "BlockedUser_no_anon" ON "BlockedUser" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "NotificationPreference_no_anon" ON "NotificationPreference" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Dispute_no_anon" ON "Dispute" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "SupportTicket_no_anon" ON "SupportTicket" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "TicketReply_no_anon" ON "TicketReply" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "MonitoringError_no_anon" ON "MonitoringError" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "AdminReport_no_anon" ON "AdminReport" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Promotion_no_anon" ON "Promotion" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "PremiumListing_no_anon" ON "PremiumListing" FOR ALL USING (false) WITH CHECK (false);

-- Blog: public can read published, no writes
CREATE POLICY "BlogArticle_public_read" ON "BlogArticle" FOR SELECT USING ("isPublished" = true);
CREATE POLICY "BlogArticle_no_anon_insert" ON "BlogArticle" FOR INSERT WITH CHECK (false);
CREATE POLICY "BlogArticle_no_anon_update" ON "BlogArticle" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "BlogArticle_no_anon_delete" ON "BlogArticle" FOR DELETE USING (false);

-- Page Content: public read, no writes
CREATE POLICY "PageContent_public_read" ON "PageContent" FOR SELECT USING (true);
CREATE POLICY "PageContent_no_anon_insert" ON "PageContent" FOR INSERT WITH CHECK (false);
CREATE POLICY "PageContent_no_anon_update" ON "PageContent" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "PageContent_no_anon_delete" ON "PageContent" FOR DELETE USING (false);

-- Analytics: anon can insert only
CREATE POLICY "AnalyticsEvent_anon_insert" ON "AnalyticsEvent" FOR INSERT WITH CHECK (true);
CREATE POLICY "AnalyticsEvent_no_anon_read" ON "AnalyticsEvent" FOR SELECT USING (false);
CREATE POLICY "AnalyticsEvent_no_anon_update" ON "AnalyticsEvent" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "AnalyticsEvent_no_anon_delete" ON "AnalyticsEvent" FOR DELETE USING (false);

-- Advertisement: public can read active, no writes
CREATE POLICY "Advertisement_public_read" ON "Advertisement" FOR SELECT USING ("status" = 'ACTIVE');
CREATE POLICY "Advertisement_no_anon_insert" ON "Advertisement" FOR INSERT WITH CHECK (false);
CREATE POLICY "Advertisement_no_anon_update" ON "Advertisement" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Advertisement_no_anon_delete" ON "Advertisement" FOR DELETE USING (false);

-- ============================================================
-- Additional CMS tables (BrandKit, PressKit, FAQ, Team, Jobs)
-- ============================================================

-- 22. BrandKit
CREATE TABLE IF NOT EXISTS "BrandKit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. PressKit
CREATE TABLE IF NOT EXISTS "PressKit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. FAQ
CREATE TABLE IF NOT EXISTS "FAQ" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25. TeamMember
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. Job
CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Nairobi, Kenya',
    "type" TEXT NOT NULL DEFAULT 'Full-time',
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 27. JobApplication
CREATE TABLE IF NOT EXISTS "JobApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL REFERENCES "Job"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resume" TEXT,
    "coverLetter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- RLS for new CMS tables
-- ============================================================

ALTER TABLE "BrandKit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PressKit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FAQ" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication" ENABLE ROW LEVEL SECURITY;

-- BrandKit: public read, no anon writes
CREATE POLICY "BrandKit_public_read" ON "BrandKit" FOR SELECT USING (true);
CREATE POLICY "BrandKit_no_anon_insert" ON "BrandKit" FOR INSERT WITH CHECK (false);
CREATE POLICY "BrandKit_no_anon_update" ON "BrandKit" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "BrandKit_no_anon_delete" ON "BrandKit" FOR DELETE USING (false);

-- PressKit: public read, no anon writes
CREATE POLICY "PressKit_public_read" ON "PressKit" FOR SELECT USING (true);
CREATE POLICY "PressKit_no_anon_insert" ON "PressKit" FOR INSERT WITH CHECK (false);
CREATE POLICY "PressKit_no_anon_update" ON "PressKit" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "PressKit_no_anon_delete" ON "PressKit" FOR DELETE USING (false);

-- FAQ: public can read published, no anon writes
CREATE POLICY "FAQ_public_read" ON "FAQ" FOR SELECT USING ("isPublished" = true);
CREATE POLICY "FAQ_no_anon_insert" ON "FAQ" FOR INSERT WITH CHECK (false);
CREATE POLICY "FAQ_no_anon_update" ON "FAQ" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "FAQ_no_anon_delete" ON "FAQ" FOR DELETE USING (false);

-- TeamMember: public can read active, no anon writes
CREATE POLICY "TeamMember_public_read" ON "TeamMember" FOR SELECT USING ("isActive" = true);
CREATE POLICY "TeamMember_no_anon_insert" ON "TeamMember" FOR INSERT WITH CHECK (false);
CREATE POLICY "TeamMember_no_anon_update" ON "TeamMember" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "TeamMember_no_anon_delete" ON "TeamMember" FOR DELETE USING (false);

-- Job: public can read open jobs, no anon writes
CREATE POLICY "Job_public_read" ON "Job" FOR SELECT USING ("status" = 'OPEN');
CREATE POLICY "Job_no_anon_insert" ON "Job" FOR INSERT WITH CHECK (false);
CREATE POLICY "Job_no_anon_update" ON "Job" FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Job_no_anon_delete" ON "Job" FOR DELETE USING (false);

-- JobApplication: no anon access (service role only)
CREATE POLICY "JobApplication_no_anon" ON "JobApplication" FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- Migrations: Add missing columns to existing tables
-- ============================================================

-- Add authorId and authorType to BlogArticle (if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BlogArticle' AND column_name = 'authorId') THEN
        ALTER TABLE "BlogArticle" ADD COLUMN "authorId" TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BlogArticle' AND column_name = 'authorType') THEN
        ALTER TABLE "BlogArticle" ADD COLUMN "authorType" TEXT NOT NULL DEFAULT 'admin';
    END IF;
END $$;
