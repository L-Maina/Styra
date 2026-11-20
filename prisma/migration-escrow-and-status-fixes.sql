-- Escrow and booking status fixes
--
-- Run once in the Supabase SQL editor (the project applies SQL files by hand, see the other
-- files in this folder). Safe to run twice. Take a backup or a Supabase point-in-time marker first.
--
-- 1. Booking statuses were stored in two spellings ("pending" and "PENDING"). The app now
--    reads both, but new code writes UPPERCASE only, so make the old rows match.
-- 2. Bookings that were completed before Booking.completedAt was filled in get it from updatedAt,
--    so the 24 hour verification window stops sliding when the row is touched.
-- 3. Payment.escrowStatus was never updated after a payment was held. Copy it from the ledger.
-- 4. Reports (read only): wallets whose pending balance does not match the escrow ledger, and
--    verified bookings whose payment is still held. The release job fixes the second kind on
--    its next run. The first kind needs a person to look at it.

BEGIN;

-- 1. Booking statuses to UPPERCASE with underscores
UPDATE "Booking"
SET "status" = REPLACE(REPLACE(UPPER(TRIM("status")), '-', '_'), ' ', '_')
WHERE "status" <> REPLACE(REPLACE(UPPER(TRIM("status")), '-', '_'), ' ', '_');

ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 2. Start of the verification window for older completed bookings
UPDATE "Booking"
SET "completedAt" = "updatedAt"
WHERE "completedAt" IS NULL
  AND "status" IN ('COMPLETED', 'VERIFIED');

-- 3. Payment.escrowStatus follows the escrow ledger (lowercase, as the column default is)
UPDATE "Payment" p
SET "escrowStatus" = LOWER(pt."escrowStatus")
FROM "PlatformTransaction" pt
WHERE pt."type" = 'ESCROW_HELD'
  AND pt."transactionId" = p."id"
  AND pt."escrowStatus" IS NOT NULL
  AND LOWER(pt."escrowStatus") <> p."escrowStatus";

COMMIT;

-- 4a. Wallets whose pending balance differs from the money held for them in escrow.
--     Expect no rows. A row means a release for that provider will stop with
--     "needs a manual check by support" instead of moving money that is not there.
SELECT w."userId",
       w."pendingBalance"                                   AS wallet_pending,
       COALESCE(SUM(pt."providerAmount") FILTER (WHERE pt."escrowStatus" IN ('HELD', 'DISPUTED')), 0) AS escrow_held
FROM "Wallet" w
LEFT JOIN "PlatformTransaction" pt
       ON pt."userId" = w."userId" AND pt."type" = 'ESCROW_HELD'
GROUP BY w."userId", w."pendingBalance"
HAVING ABS(w."pendingBalance"
         - COALESCE(SUM(pt."providerAmount") FILTER (WHERE pt."escrowStatus" IN ('HELD', 'DISPUTED')), 0)) > 0.005;

-- 4b. Verified bookings whose payment is still held (the release job repairs these)
SELECT b."id" AS booking_id, b."status", pt."escrowStatus", pt."providerAmount"
FROM "Booking" b
JOIN "PlatformTransaction" pt
  ON pt."bookingId" = b."id" AND pt."type" = 'ESCROW_HELD' AND pt."escrowStatus" = 'HELD'
WHERE b."status" = 'VERIFIED';

-- 4c. Cancelled or refunded bookings that still have money held
SELECT b."id" AS booking_id, b."status", pt."escrowStatus", pt."amount"
FROM "Booking" b
JOIN "PlatformTransaction" pt
  ON pt."bookingId" = b."id" AND pt."type" = 'ESCROW_HELD' AND pt."escrowStatus" IN ('HELD', 'DISPUTED')
WHERE b."status" = 'CANCELLED';
