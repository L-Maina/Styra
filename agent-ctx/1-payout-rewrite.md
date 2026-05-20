# Task 1 — Payout System Rewrite

**Agent**: Main Agent  
**File Modified**: `/home/z/my-project/src/lib/payout.ts`

## Summary

Completely rewrote the payout system to wire in REAL payment provider APIs instead of placeholders.

## Changes Made

### 1. Real M-Pesa B2C Integration
- **Before**: Placeholder that logged a fake success
- **After**: Imports and calls `initiateMpesaB2C` from `@/lib/mpesa` which calls the real Safaricom Daraja B2C API
- Uses `business.mpesaPhone` (preferred) or `business.phone` as the B2C recipient
- Amounts rounded to integer KES as required by M-Pesa
- Returns proper success/failure based on real API response

### 2. Real Paystack Transfer Integration
- **Before**: Placeholder that generated fake transfer codes
- **After**: Imports `PaystackClient` / `getPaystackClient` from `@/lib/paystack`
- Flow: Parse bank account details from business → Create transfer recipient → Initiate transfer
- Amounts converted to KOBO (KES × 100) as required by Paystack
- Proper error handling for missing bank details or API failures

### 3. Real PayPal Payouts Integration
- **Before**: Not called at all (library existed but was unused)
- **After**: Imports and calls `createPayPalPayout` from `@/lib/paypal-payouts`
- Uses `business.paypalEmail` as recipient
- Proper currency support (KES)
- Batch ID tracking for status polling

### 4. Fixed Stripe Payout Case
- **Before**: When `payoutMethod === 'STRIPE'`, it incorrectly called `initiatePaystackTransfer()` — copy-paste bug
- **After**: Properly calls `stripe.transfers.create()` to create a Stripe Connect transfer
- Uses `business.stripeAccountId` as the destination
- Falls back to PENDING if no connected account exists
- Stripe API version set to `'2026-03-25.dahlia'` (matching the webhook route)

### 5. Fixed determinePayoutMethod for PAYPAL
- **Before**: Both STRIPE and PAYSTACK payment methods returned 'STRIPE' as payout method
- **After**: PAYPAL → 'PAYPAL', STRIPE → 'STRIPE', PAYSTACK → 'PAYSTACK' (all separate)

### 6. Added PAYSTACK as Separate Payout Method
- Added 'PAYSTACK' to the `PayoutMethod` type union
- `determinePayoutMethod('PAYSTACK')` now returns 'PAYSTACK' instead of 'STRIPE'
- Full Paystack transfer implementation with recipient creation

### 7. Improved Idempotency
- **Before**: Used `description: { contains: '"bookingId":"${bookingId}"' }` — fragile JSON matching
- **After**: Uses prefix-based key `STYRA-PAYOUT-BOOKING-{bookingId}` stored in structured `PayoutDescription`
- Searches via `{ contains: idempotencyKey }` for reliable matching
- `PayoutDescription` interface with typed fields: bookingId, paymentId, retryCount, idempotencyKey, etc.

### 8. Error Handling with Retry Tracking
- `PayoutDescription` includes `retryCount` and `lastAttemptAt` fields
- `countRetriesForBooking()` function counts failed payout attempts per booking
- `retryFailedPayout()` enforces MAX_RETRIES = 5 to prevent infinite loops
- Each provider call wrapped in try/catch with descriptive error messages
- Provider failures update the payout record with `failedReason` and increment retry count

### 9. Provider Configuration Check
- New `isProviderConfigured()` function checks env vars for each provider
- If a provider is not configured, payout is marked as PENDING for manual admin processing
- Prevents API call failures when credentials are missing

### 10. Business Field Usage
- Extended the booking query to select: `stripeAccountId`, `payoutPreference`, `paypalEmail`, `bankAccountDetails`, `mpesaPhone`
- Each provider uses the appropriate business field for recipient info

## Preserved Interfaces
- `triggerPayout(bookingId, initiatedBy?)` — same signature
- `triggerBulkPayouts(bookingIds, initiatedBy)` — same signature
- `getPayoutsForBusiness(businessId)` — same
- `getPendingPayouts()` — same
- `retryFailedPayout(payoutId)` — same
- `calculateProviderAmount(amount)` — same
- `getPayoutSummary()` — same
- `PayoutResult`, `BulkPayoutResult`, `PayoutSummary` — same types

## TypeScript Verification
- Zero TypeScript errors in payout.ts
- Zero ESLint errors in payout.ts
- Stripe API version aligned with webhook route (`'2026-03-25.dahlia'`)
