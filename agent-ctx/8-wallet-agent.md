# Task 8 — Wallet Agent

## Task
Update `/home/z/my-project/src/lib/wallet.ts` to use the new `pendingBalance` field from the Wallet model.

## Summary of Changes

### File Modified: `src/lib/wallet.ts`

1. **`creditPendingBalance()`** — Changed from `balance: { increment: amount }` to `pendingBalance: { increment: amount }`. Funds now go to escrow first instead of directly to available balance.

2. **`releaseToBalance()`** — Was a no-op (only idempotency check). Now actually moves funds: `pendingBalance: { decrement: amount }` + `balance: { increment: amount }`. Includes a sufficiency check on pendingBalance.

3. **`holdForDispute()`** — Was only decrementing balance. Now decrements balance AND increments pendingBalance: `{ balance: { decrement: amount }, pendingBalance: { increment: amount } }`. This properly tracks disputed funds as held.

4. **`releaseDisputeHold()`** — Was incrementing balance only. Now moves from pendingBalance back to balance: `{ pendingBalance: { decrement: amount }, balance: { increment: amount } }`. Includes sufficiency check on pendingBalance.

5. **`deductForPayout()`** — Still deducts from balance only. Error message clarified to "Insufficient available balance for payout".

6. **`refundToBalance()`** — No change needed. Already credits to `balance` (correct behavior).

7. **`getWalletSummary()`** — `totalPending` and `totalHeld` now use `wallet.pendingBalance` instead of hardcoded `0`.

8. **`getPlatformWalletStats()`** — Aggregate query now includes `pendingBalance: true` in `_sum`. `totalPending` and `totalHeld` use `aggregateResult._sum?.pendingBalance || 0`.

9. **JSDoc comments** — Updated top-of-file comment, `creditPendingBalance()` doc, and `releaseToBalance()` doc to reflect the new two-field escrow flow.

## Validation
- Lint passes with 0 errors (only pre-existing warnings in other files)
- All function signatures preserved
- All types preserved (no interface changes needed)
- All idempotency checks preserved
- All Prisma transactions preserved
- Negative balance guards preserved
