-- ============================================================
-- Styra — Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor AFTER creating tables
-- ============================================================

-- ── Enable RLS on ALL tables ──────────────────────────────

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OTPVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordReset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlockedUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dispute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InsuranceClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonitoringError" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketReply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PageContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Advertisement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PremiumListing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSetting" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IMPORTANT: The app uses JWT-based auth (not Supabase Auth).
-- Auth context comes from the Authorization header (Bearer token).
-- We use two approaches:
--   1. Service role key — full access (server-side API routes)
--   2. Anon key — limited public reads only (client-side)
-- The API routes hit the database via Prisma with the pooler
-- connection string, which bypasses RLS (uses service_role).
-- RLS here protects against direct Supabase client access.
-- ============================================================

-- ── Helper: Allow service role full access ─────────────────
-- Service role bypasses RLS automatically in Supabase.
-- For anon (public client), we add limited read policies.

-- ============================================================
-- PUBLIC READ (anon can read, no write)
-- ============================================================

-- Business listing — public can view active businesses
CREATE POLICY "Business_public_read" ON "Business"
  FOR SELECT USING ("isActive" = true);

-- Service listing — public can view active services
CREATE POLICY "Service_public_read" ON "Service"
  FOR SELECT USING ("isActive" = true);

-- Staff — public can view active staff
CREATE POLICY "Staff_public_read" ON "Staff"
  FOR SELECT USING ("isActive" = true);

-- Portfolio — public can view
CREATE POLICY "PortfolioItem_public_read" ON "PortfolioItem"
  FOR SELECT USING (true);

-- Reviews — public can view
CREATE POLICY "Review_public_read" ON "Review"
  FOR SELECT USING (true);

-- Blog articles — public can read published
CREATE POLICY "BlogArticle_public_read" ON "BlogArticle"
  FOR SELECT USING ("isPublished" = true);

-- Page content — public can read (footer, about, etc.)
CREATE POLICY "PageContent_public_read" ON "PageContent"
  FOR SELECT USING (true);

-- Categories from PlatformSetting — public can read
CREATE POLICY "PlatformSetting_public_read" ON "PlatformSetting"
  FOR SELECT USING (true);

-- Advertisements — public can see active ads
CREATE POLICY "Advertisement_public_read" ON "Advertisement"
  FOR SELECT USING ("status" = 'ACTIVE');

-- ============================================================
-- RESTRICTED — No public access (service role only)
-- These tables should ONLY be accessed via server-side API routes.
-- ============================================================

-- User data
CREATE POLICY "User_no_anon_access" ON "User"
  FOR ALL USING (false) WITH CHECK (false);

-- Bookings
CREATE POLICY "Booking_no_anon_access" ON "Booking"
  FOR ALL USING (false) WITH CHECK (false);

-- Payments
CREATE POLICY "Payment_no_anon_access" ON "Payment"
  FOR ALL USING (false) WITH CHECK (false);

-- Payouts
CREATE POLICY "Payout_no_anon_access" ON "Payout"
  FOR ALL USING (false) WITH CHECK (false);

-- Platform Transactions (escrow, commissions)
CREATE POLICY "PlatformTransaction_no_anon_access" ON "PlatformTransaction"
  FOR ALL USING (false) WITH CHECK (false);

-- Transaction Logs
CREATE POLICY "TransactionLog_no_anon_access" ON "TransactionLog"
  FOR ALL USING (false) WITH CHECK (false);

-- Conversations
CREATE POLICY "Conversation_no_anon_access" ON "Conversation"
  FOR ALL USING (false) WITH CHECK (false);

-- Chat Messages
CREATE POLICY "ChatMessage_no_anon_access" ON "ChatMessage"
  FOR ALL USING (false) WITH CHECK (false);

-- Notifications
CREATE POLICY "Notification_no_anon_access" ON "Notification"
  FOR ALL USING (false) WITH CHECK (false);

-- Notification Preferences
CREATE POLICY "NotificationPreference_no_anon_access" ON "NotificationPreference"
  FOR ALL USING (false) WITH CHECK (false);

-- Push Subscriptions
CREATE POLICY "PushSubscription_no_anon_access" ON "PushSubscription"
  FOR ALL USING (false) WITH CHECK (false);

-- Wallet
CREATE POLICY "Wallet_no_anon_access" ON "Wallet"
  FOR ALL USING (false) WITH CHECK (false);

-- OTP Verification
CREATE POLICY "OTPVerification_no_anon_access" ON "OTPVerification"
  FOR ALL USING (false) WITH CHECK (false);

-- Password Reset
CREATE POLICY "PasswordReset_no_anon_access" ON "PasswordReset"
  FOR ALL USING (false) WITH CHECK (false);

-- Email Verification
CREATE POLICY "EmailVerificationToken_no_anon_access" ON "EmailVerificationToken"
  FOR ALL USING (false) WITH CHECK (false);

-- User Bans
CREATE POLICY "UserBan_no_anon_access" ON "UserBan"
  FOR ALL USING (false) WITH CHECK (false);

-- Blocked Users
CREATE POLICY "BlockedUser_no_anon_access" ON "BlockedUser"
  FOR ALL USING (false) WITH CHECK (false);

-- Disputes
CREATE POLICY "Dispute_no_anon_access" ON "Dispute"
  FOR ALL USING (false) WITH CHECK (false);

-- Insurance Claims
CREATE POLICY "InsuranceClaim_no_anon_access" ON "InsuranceClaim"
  FOR ALL USING (false) WITH CHECK (false);

-- Audit Log
CREATE POLICY "AuditLog_no_anon_access" ON "AuditLog"
  FOR ALL USING (false) WITH CHECK (false);

-- Security Audit Log
CREATE POLICY "SecurityAuditLog_no_anon_access" ON "SecurityAuditLog"
  FOR ALL USING (false) WITH CHECK (false);

-- Security Alerts
CREATE POLICY "SecurityAlert_no_anon_access" ON "SecurityAlert"
  FOR ALL USING (false) WITH CHECK (false);

-- Monitoring Errors
CREATE POLICY "MonitoringError_no_anon_access" ON "MonitoringError"
  FOR ALL USING (false) WITH CHECK (false);

-- Admin Reports
CREATE POLICY "AdminReport_no_anon_access" ON "AdminReport"
  FOR ALL USING (false) WITH CHECK (false);

-- Support Tickets
CREATE POLICY "SupportTicket_no_anon_access" ON "SupportTicket"
  FOR ALL USING (false) WITH CHECK (false);

-- Ticket Replies
CREATE POLICY "TicketReply_no_anon_access" ON "TicketReply"
  FOR ALL USING (false) WITH CHECK (false);

-- Form Submissions (anonymous users can submit contact forms)
CREATE POLICY "FormSubmission_anon_insert" ON "FormSubmission"
  FOR INSERT WITH CHECK (true);
CREATE POLICY "FormSubmission_no_anon_read" ON "FormSubmission"
  FOR SELECT USING (false);
CREATE POLICY "FormSubmission_no_anon_update" ON "FormSubmission"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "FormSubmission_no_anon_delete" ON "FormSubmission"
  FOR DELETE USING (false);

-- Webhook Events
CREATE POLICY "WebhookEvent_no_anon_access" ON "WebhookEvent"
  FOR ALL USING (false) WITH CHECK (false);

-- Analytics Events (anon can insert tracking events)
CREATE POLICY "AnalyticsEvent_anon_insert" ON "AnalyticsEvent"
  FOR INSERT WITH CHECK (true);
CREATE POLICY "AnalyticsEvent_no_anon_read" ON "AnalyticsEvent"
  FOR SELECT USING (false);
CREATE POLICY "AnalyticsEvent_no_anon_update" ON "AnalyticsEvent"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "AnalyticsEvent_no_anon_delete" ON "AnalyticsEvent"
  FOR DELETE USING (false);

-- Favorites — no anon
CREATE POLICY "Favorite_no_anon_access" ON "Favorite"
  FOR ALL USING (false) WITH CHECK (false);

-- Promotions — no anon
CREATE POLICY "Promotion_no_anon_access" ON "Promotion"
  FOR ALL USING (false) WITH CHECK (false);

-- Premium Listings — no anon
CREATE POLICY "PremiumListing_no_anon_access" ON "PremiumListing"
  FOR ALL USING (false) WITH CHECK (false);

-- Business — no anon write (only service role)
CREATE POLICY "Business_no_anon_insert" ON "Business"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Business_no_anon_update" ON "Business"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Business_no_anon_delete" ON "Business"
  FOR DELETE USING (false);

-- Service — no anon write
CREATE POLICY "Service_no_anon_insert" ON "Service"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Service_no_anon_update" ON "Service"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Service_no_anon_delete" ON "Service"
  FOR DELETE USING (false);

-- Staff — no anon write
CREATE POLICY "Staff_no_anon_insert" ON "Staff"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Staff_no_anon_update" ON "Staff"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Staff_no_anon_delete" ON "Staff"
  FOR DELETE USING (false);

-- Portfolio — no anon write
CREATE POLICY "PortfolioItem_no_anon_insert" ON "PortfolioItem"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "PortfolioItem_no_anon_update" ON "PortfolioItem"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "PortfolioItem_no_anon_delete" ON "PortfolioItem"
  FOR DELETE USING (false);

-- Reviews — no anon write
CREATE POLICY "Review_no_anon_insert" ON "Review"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Review_no_anon_update" ON "Review"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Review_no_anon_delete" ON "Review"
  FOR DELETE USING (false);

-- Blog — no anon write
CREATE POLICY "BlogArticle_no_anon_insert" ON "BlogArticle"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "BlogArticle_no_anon_update" ON "BlogArticle"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "BlogArticle_no_anon_delete" ON "BlogArticle"
  FOR DELETE USING (false);

-- Page Content — no anon write
CREATE POLICY "PageContent_no_anon_insert" ON "PageContent"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "PageContent_no_anon_update" ON "PageContent"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "PageContent_no_anon_delete" ON "PageContent"
  FOR DELETE USING (false);

-- Advertisements — no anon write
CREATE POLICY "Advertisement_no_anon_insert" ON "Advertisement"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Advertisement_no_anon_update" ON "Advertisement"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Advertisement_no_anon_delete" ON "Advertisement"
  FOR DELETE USING (false);

-- Platform Settings — no anon write
CREATE POLICY "PlatformSetting_no_anon_insert" ON "PlatformSetting"
  FOR INSERT WITH CHECK (false);
CREATE POLICY "PlatformSetting_no_anon_update" ON "PlatformSetting"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "PlatformSetting_no_anon_delete" ON "PlatformSetting"
  FOR DELETE USING (false);
