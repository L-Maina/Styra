# Styra

Grooming marketplace. Customers book services from businesses; the payment is held in escrow
until the customer confirms the service (or 24 hours pass).

Stack: Next.js 16 (App Router), React 19, Tailwind + shadcn/Radix, Prisma 6 on PostgreSQL
(Supabase), Stripe / PayPal / Paystack / M-Pesa, deployed on Vercel.

## Commands

- `bun test` — escrow and verification tests (fake in-memory database, no network)
- `bun run build` — `prisma generate` then `next build` (type errors fail the build)
- `bun run lint`
- Schema changes are applied by hand as SQL files in `prisma/`; update `schema.prisma` too.

## Money rules (read before touching payments)

- The ledger is the `PlatformTransaction` row with `type: 'ESCROW_HELD'`. Its `escrowStatus` is the
  truth: HELD → RELEASED, HELD → DISPUTED → RELEASED / REFUNDED, RELEASED → REFUNDED.
- Provider `Wallet.pendingBalance` holds money in escrow, `balance` holds released money.
- Only `src/lib/escrow.ts` moves money. Use `holdInEscrow`, `releaseFromEscrow`, `refundFromEscrow`,
  or the `*InTx` versions inside your own transaction. Never update wallets or escrow rows directly.
- Booking status changes that involve money live in `src/lib/verification.ts`
  (`markBookingCompleted`, `customerConfirm`, `raiseDispute`, `resolveDispute`,
  `cancelBookingWithRefund`, `adminSettleEscrow`, `autoVerifyExpiredBookings`).
  They change the status and move the money in one transaction.
- Refunds update the ledger only. Nothing sends money back through Stripe/Paystack/PayPal/M-Pesa;
  admins get a notification with the payment reference.
- Money columns are `Float`. Round to 2 decimals with the helpers in `escrow.ts`.

## Conventions

- Booking status is UPPERCASE (`PENDING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`,
  `DISPUTED`, `CANCELLED`). Older rows may be lowercase. Compare with `isStatus()` and filter with
  `statusVariants()` from `src/lib/booking-status.ts`. Never compare with a string literal.
- Throw `AppError(message, status)` for errors that are safe to show; `handleApiError` returns them
  as-is. Any other error becomes a generic message in production.
- API routes: `successResponse` / `errorResponse` / `handleApiError` from `src/lib/api-utils.ts`.
- The release job is `GET /api/cron/release-escrow` (daily, see `vercel.json`). It needs
  `CRON_SECRET`.

## Web screens that touch bookings and money

- Show booking status with `BookingStatusBadge` / `bookingStatusMeta` and test it with `isStatus`,
  `isUpcoming`, `isDone` (all in `src/lib/booking-status.ts`, safe to import in client components).
- The bookings API returns the database names `time` and `totalPrice` plus `payments[]` and
  `reviews[]` arrays. `useBookings` maps them to `startTime` / `totalAmount` once; don't map again.
- Customer confirm, report-a-problem and cancel live in `src/components/booking/BookingEscrowActions.tsx`;
  admin escrow is `src/components/admin/EscrowPanel.tsx`. Call the API through `api` from
  `src/lib/api-client.ts` (it adds the CSRF header and already shows error toasts, so don't toast twice).
- After an action, call the dashboard's `onBookingsChanged` (a silent refresh) rather than `refetch`,
  which flips the screen back to its skeleton.

## Motion and themes (web)

- Motion tokens exist twice: `src/lib/motion.ts` (framer-motion) and CSS variables in `src/app/globals.css`.
  `tests/motion.test.ts` keeps them equal. Use them, not literal durations or easings. They are the same
  tokens as the Figma file and the Flutter app (`claude/figma-design-status.md` in the Project).
- Reduced motion is applied globally by `MotionSettings` (framer-motion, plus `<html data-motion>`) and the
  rules at the end of `globals.css`. Don't add per-component checks. Use `.press` for press feedback and
  `Skeleton` / `.shimmer` for loading shapes.
- Themes are CSS variables in `globals.css`: `:root` is graphite, `.light` is ivory. Use semantic tokens
  (`bg-background`, `text-muted-foreground`, `border-input`), not Tailwind palette classes. `--input` is for
  control edges (3:1 contrast); `--border` is for card edges.
- `LaunchSplash` plays once per session and is skipped under reduced motion.

## Don't

- Don't add booking status literals, or write to `Wallet` outside `escrow.ts`.
- Don't commit images over ~500 KB; resize them first.
- Don't commit `.env*`, logs, `.pid`, or database files.
