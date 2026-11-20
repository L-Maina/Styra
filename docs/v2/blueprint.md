# Styra v2 blueprint

Status: draft 1 · 2026-11-20 · design by the web/backend chat · **builder: Claude Code (the user asked Code to handle everything)**.
The money rules in section 5 are mandatory: keep them, or replace them with something at least as strict and equally tested. Everything else is Code's call; record any change in a "Decision log" at the end of this file. Section 12 lists what only the user can decide.

## 1. Why a rebuild

The v1 problems were structural, not a handful of bugs: one client-routed page, statuses in two spellings, money as floats, an escrow ledger that lived only in application code, 56 tables for a small product, and hundreds of hard-coded colours. v2 keeps the product idea and the brand layer, and replaces everything else. No v1 data needs to move (the live database holds test data only).

## 2. Principles

1. **The database refuses wrong money.** Balanced ledger, append-only history, no double booking, no escrow/booking mismatch are enforced by Postgres constraints, not by hope.
2. **Pure core, thin shell.** Money, state machines, policies and slot maths are plain TypeScript with no I/O (`src/core`), tested without a database. Services only glue core to SQL.
3. **One way to do each thing.** One money type (integer minor units), one status list per entity (UPPERCASE, checked by the database), one error type, one API envelope, one session mechanism.
4. **Contract first.** Web and mobile call the same `/api/v2` API. The contract is written (and validated with zod) before screens.
5. **Kenya first, safe by default.** M-Pesa is the primary rail. Fake payments exist only outside production, and production fails closed if no provider is configured.
6. **Small surface.** The core loop done well beats thirty half-finished pages.
7. **Design and words are part of the build.** Every screen, web and mobile, is Liquid Glass at Apple level and uses the voice and motto in `docs/v2/design-language.md`, with the user's skills (section 2 there). It is a gate, not polish for later.

## 3. Scope

| In v2.0 | Out for now |
|---|---|
| Accounts (customer, provider, admin) | Blog, careers, press, advertise, premium listings, insurance claims |
| Business profile, services, staff, weekly availability, time off | In-app chat (use phone / WhatsApp link) |
| Search and browse, business page, reviews, favourites | Multi-currency pricing (schema supports it; KES at launch) |
| Booking with a 15-minute slot hold, single service per booking | Multi-service bookings, deposits, packages, gift cards |
| Payment into escrow, release, refund queue, payouts | Automatic provider-side refunds (queued for admin first) |
| Disputes and admin console | Loyalty, discount codes |
| Notifications through a transactional outbox | Realtime chat, push (hooks only) |

## 4. The loop

```
PENDING --pay--> CONFIRMED --provider done--> COMPLETED --customer confirms or 24h--> VERIFIED
   |                |  \--no-show--> NO_SHOW (same window as COMPLETED)                   (provider paid)
   |                |                                  \--customer reports a problem--> DISPUTED --admin--> VERIFIED | CANCELLED
   |                \--cancel/decline--> CANCELLED (refund by policy)
   \--15 min unpaid--> EXPIRED          (late payment on EXPIRED/CANCELLED => captured, then refunded in full)
```

Escrow state follows the booking: `NONE` (nothing held) → `HELD` (customer money in escrow) → `SETTLED` (all moved out). The database only allows these combinations:
PENDING/EXPIRED+NONE · CONFIRMED/COMPLETED/NO_SHOW/DISPUTED+HELD · VERIFIED+SETTLED · CANCELLED+NONE or SETTLED.

## 5. Money rules

| # | Rule | Enforced by |
|---|---|---|
| R1 | Amounts are integer minor units (`bigint`); no floats anywhere | column types, `core/money` |
| R2 | Every journal's lines sum to zero | deferred constraint trigger |
| R3 | Ledger rows are never updated or deleted | append-only triggers |
| R4 | A money event can only post once (idempotency key per event) | unique key on `journals` |
| R5 | Escrow per booking, provider balances, pending payouts and pending refunds can never go negative | deferred constraint trigger |
| R6 | A booking's `escrow_state` always agrees with its ledger balance | deferred constraint triggers on both tables |
| R7 | Only `src/server/booking-engine.ts` changes a booking's status together with money, in one transaction under a row lock | code + review |
| R8 | A staff member cannot have two overlapping PENDING/CONFIRMED bookings | exclusion constraint |
| R9 | Price and parties of a booking are frozen once money is held | trigger |
| R10 | Provider payouts reserve the balance when requested, not when paid | ledger design |

Accounts: `PSP_CLEARING` (asset: money at payment providers), `ESCROW` (per booking), `PROVIDER_BALANCE` (per business), `PAYOUT_PENDING`, `REFUND_PENDING`, `PLATFORM_REVENUE`. Convention: debit positive, credit negative; liabilities show as `-sum`.

Settlement of a booking is one journal: escrow debited by the price; the provider's balance, the platform's commission and any refund owed to the customer are credited. Refunds are a visible queue (`REFUND_PENDING` plus a `refunds` row); nothing claims money was sent back until an admin or a provider API confirms it.

**Decision (editable in `settings`)**: commission 10 %, verification window 24 h, hold 15 min, customer cancellation refund 100 % at 24 h or more before start, 50 % from 4 h, 0 % later; provider cancel or decline is always 100 %.

## 6. Architecture

```
src/core        pure TS: money, ledger postings, booking state machine, policies, slots
src/server      db adapter, services, booking engine, payment providers, auth, outbox
src/contracts   zod schemas = the API contract
src/app         Next.js 16 routes: pages (RSC first) + /api/v2 handlers
supabase/migrations   plain SQL, idempotent, applied by Supabase
tests           bun test: core (pure) and db (real Postgres, local)
brand + ui layer      kept: tokens, logo, motion, shadcn primitives
```

- **Database**: Supabase Postgres, schema `styra` (v1 tables stay untouched in `public` until the user says to drop them). RLS is enabled on every table with no policies; only the server connection reads or writes. Clients never talk to the database directly.
- **Driver**: `pg` (already a dependency), SQL written by hand, no ORM. Tests run the same SQL on a real local Postgres via Bun.
- **Auth**: email + password (bcryptjs), opaque random session tokens stored hashed (`sessions`), cookie for web, `Authorization: Bearer` for mobile. Phone OTP later.
- **Files**: Supabase Storage (public bucket for photos, private bucket + signed URLs for ID documents). Cloudinary is dropped.
- **Jobs**: one endpoint `/api/v2/cron/tick` (expire holds, auto-verify, retry outbox). Triggered by Supabase `pg_cron` + `pg_net` every 5 minutes, and by Vercel cron daily as a safety net.
- **Payments**: provider interface with adapters for M-Pesa (Daraja STK push), Paystack, Stripe, PayPal and a fake one for tests and previews. Webhooks are signature-checked and stored once (`webhook_events`).
- **Errors**: `AppError(code, message, status)`; every API response is `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

## 7. Data model (schema `styra`)

Identity: `users`, `sessions`. Marketplace: `businesses`, `services`, `staff`, `availability_rules`, `time_off`, `reviews`, `favorites`. Booking and money: `bookings`, `payments`, `webhook_events`, `ledger_accounts`, `journals`, `ledger_entries`, `refunds`, `payouts`, `disputes`. Platform: `settings`, `outbox`, `audit_log`. Added with their features: `notifications`, `push_tokens`, `rate_limits`, `kyc_documents`, `business_photos`.

## 8. API v2 outline

Auth `POST /auth/register|login|logout`, `GET /me` · Discovery `GET /businesses`, `/businesses/:slug`, `/businesses/:id/slots?serviceId&date` · Booking `POST /bookings`, `POST /bookings/:id/pay`, `GET /bookings`, `GET /bookings/:code`, `POST /bookings/:id/{cancel,confirm,dispute,review}` · Provider `…/pro/{bookings,services,staff,availability,earnings,payouts}` with `POST /pro/bookings/:id/{decline,complete,no-show}` · Admin `…/admin/{businesses,disputes,refunds,payouts,ledger}` · Webhooks `POST /webhooks/{mpesa,paystack,stripe,paypal}` · Cron `POST /cron/tick`.

## 9. Quality gates

- `src/core` has unit tests for every rule above that the code owns.
- `tests/db` runs the real migrations on a throwaway Postgres database and proves R2–R6, R8 and R9 by trying to break them.
- The booking engine is tested end to end against that database: happy path, cancel by policy, dispute (release, refund, split), expiry, late payment, replayed events, racing requests.
- A preview is only called working after a scripted run through a real browser: browse, book, pay (fake), complete, confirm, see the ledger balanced.
- Every screen, web and mobile, passes the screen gate in `docs/v2/design-language.md` section 12 (apple-design review, contrast numbers, accessibility fallbacks, performance budget, copy from the catalogue).
- No cutover without the user's yes. v1 stays live until then.

## 10. Milestones

| | Deliverable | Done means |
|---|---|---|
| M0 | Blueprint, core modules | core tests green |
| M1 | Database migrations, booking engine | db and engine tests green on real Postgres; migrations applied |
| M2 | Auth, contracts, API v2 for discovery and booking, fake payments | scripted API run passes on a preview |
| M3 | Screens: browse, book, pay, bookings, provider console | scripted browser run passes on a preview; every screen passes the design gate |
| M4 | M-Pesa and Paystack adapters, payouts, admin console, cron | sandbox payment completes end to end |
| M5 | Mobile app on `/api/v2` with the same glass, wording and motto; cutover plan | every screen passes the design gate; user approves cutover |

## 11. Who builds what

- **Code (on the Mac)** builds everything: database, core, booking engine, API, auth, payments, cron, web screens and the Flutter app. It can install, compile and run locally, which is what a rebuild needs.
- **The web/backend chat** (cloud sandbox with Supabase, Vercel, GitHub and a browser, but no package installs) stays on call for operations: apply and check Supabase migrations, read Vercel build logs and runtime errors, share-link and test protected previews in a real browser, merge green PRs. Ask through the Project doc `claude/rebuild-v2-handover.md` (section "Support") or via the user.
- Source of truth: this file. Project doc `claude/rebuild-v2-handover.md` holds facts, rules and process.

## 12. Needs the user

- Approve cutover (replacing the live site with v2) and, separately, dropping the v1 tables.
- Provide or confirm provider accounts for sandbox testing: Safaricom Daraja (consumer key and secret, shortcode, passkey) and Paystack test keys. Never paste them in chat; they go into the Vercel project settings.
- Confirm the commission rate and the cancellation schedule above.

## Appendix A. Database design (schema `styra`)

Conventions: `id uuid primary key default gen_random_uuid()`; `created_at`/`updated_at timestamptz not null default now()` (updated_at by trigger); money is `bigint` minor units plus `currency char(3) not null default 'KES'`; statuses are `text` with a CHECK of UPPERCASE values (easy to evolve, idempotent migrations); every foreign key is indexed; RLS enabled on every table with no policies and `revoke all` from `anon` and `authenticated`; the only extension is `btree_gist` (in schema `extensions`). Migrations are idempotent (`if not exists`, `create or replace`, `drop trigger if exists`) so Supabase can re-apply them safely.

| Table | Columns that matter | Constraints |
|---|---|---|
| users | email, phone, password_hash, name, role (CUSTOMER/PROVIDER/ADMIN), status (ACTIVE/SUSPENDED), locale | unique lower(email); unique phone; email or phone present |
| sessions | user_id, token_hash, expires_at, user_agent | unique token_hash; index user_id, expires_at |
| businesses | owner_id, slug, name, category, description, phone, address, city, lat, lng, timezone ('Africa/Nairobi'), status (DRAFT/PENDING_REVIEW/ACTIVE/SUSPENDED), commission_bps (null = settings default), rating_avg numeric(3,2), rating_count | unique slug (lowercase and hyphens); commission 0..5000 |
| services | business_id, name, description, category, duration_min (5..720), price_minor ≥ 0, currency, active, position | index (business_id) where active |
| staff | business_id, user_id null, name, active | every business gets at least one staff row ("Main chair") |
| availability_rules | staff_id, weekday 0..6 (0 = Sunday), start_time, end_time | end > start; several rows a day allowed |
| time_off | staff_id, during tstzrange, reason | not empty; gist index (staff_id, during) |
| bookings | code (unique, e.g. STY-7K3M9Q), customer_id, business_id, staff_id, service_id, start_at, end_at, during (generated tstzrange '[)'), price_minor, currency, status, escrow_state, notes, cancelled_by, cancel_reason, expires_at, confirmed_at, completed_at, verified_at, cancelled_at | Appendix B |
| payments | booking_id, provider (MPESA/PAYSTACK/STRIPE/PAYPAL/FAKE), provider_ref, idempotency_key, amount_minor > 0, currency, status (INITIATED/PENDING/SUCCEEDED/FAILED/CANCELLED), payer_phone, failure_reason, raw jsonb, confirmed_at | unique idempotency_key; unique (provider, provider_ref) where not null |
| webhook_events | provider, event_id, payload jsonb, received_at, processed_at, error | unique (provider, event_id) |
| ledger_accounts | kind, business_id null, currency | unique (kind, business_id, currency) nulls not distinct; PROVIDER_BALANCE if and only if business_id present |
| journals | kind (CAPTURE/SETTLEMENT/REFUND_PAID/PAYOUT_REQUEST/PAYOUT_PAID/PAYOUT_FAILED/ADJUSTMENT), idempotency_key, nullable FKs booking_id, payment_id, refund_id, payout_id, memo, created_by | unique idempotency_key |
| ledger_entries | journal_id, account_id, booking_id null, amount_minor ≠ 0 (debit +, credit −) | indexes (journal_id), (account_id, booking_id) |
| refunds | booking_id, amount_minor > 0, status (PENDING/SUBMITTED/PAID/FAILED), provider_ref, reason, paid_at | index booking_id |
| payouts | business_id, amount_minor > 0, currency, method (MPESA/BANK), destination (masked), status (REQUESTED/PROCESSING/PAID/FAILED), idempotency_key, provider_ref, failure_reason | unique idempotency_key |
| disputes | booking_id (unique), opened_by, reason, details, status (OPEN/RESOLVED), outcome (RELEASE/REFUND/SPLIT), refund_bps, resolved_by, resolution_note | outcome present when RESOLVED |
| reviews | booking_id (unique), customer_id, business_id, rating 1..5, comment | trigger keeps businesses.rating_avg and rating_count |
| favorites | (user_id, business_id) primary key | |
| settings | key primary key, value jsonb | seed: commission_bps 1000, verification_window_hours 24, hold_minutes 15, cancellation_policy [{hoursBefore:24,refundBps:10000},{hoursBefore:4,refundBps:5000},{hoursBefore:0,refundBps:0}], payout_min_minor 10000 |
| outbox | bigint identity id, topic, payload jsonb, run_after, processed_at, attempts, last_error | partial index (run_after) where processed_at is null |
| audit_log | bigint identity id, actor_id, action, entity, entity_id, data jsonb | append-only |

## Appendix B. Constraints and triggers that guard the money

1. `bookings` CHECK: PENDING/EXPIRED+NONE; CONFIRMED/COMPLETED/NO_SHOW/DISPUTED+HELD; VERIFIED+SETTLED; CANCELLED+NONE or SETTLED. `EXCLUDE USING gist (staff_id WITH =, during WITH &&) WHERE (status IN ('PENDING','CONFIRMED'))`. The service expires stale PENDING holds (`expires_at < now()`) before inserting a booking, in the same transaction.
2. `journals` and `ledger_entries`: BEFORE UPDATE, DELETE and TRUNCATE raise "ledger is append-only".
3. Deferred constraint trigger on `ledger_entries` (after insert): the journal's lines sum to 0 and there are at least 2. A matching one on `journals` catches a journal with no lines.
4. Deferred constraint trigger on `ledger_entries` (after insert): for ESCROW (per booking_id), PROVIDER_BALANCE, PAYOUT_PENDING, REFUND_PENDING and PLATFORM_REVENUE the sum of amounts must be ≤ 0 (a liability balance is `-sum` and must be ≥ 0). ESCROW lines must carry booking_id. PSP_CLEARING is unrestricted.
5. `styra.assert_booking_escrow(booking_id)`, called from deferred triggers on `bookings` (after insert or update) and on `ledger_entries` (ESCROW lines): balance = `-sum(ESCROW lines of the booking)`; HELD means balance = price_minor; NONE means no ESCROW lines; SETTLED means balance 0 and lines exist.
6. `bookings` BEFORE UPDATE: once `old.escrow_state <> 'NONE'`, price_minor, currency, customer_id, business_id, service_id, staff_id, start_at and end_at cannot change.
7. `updated_at` trigger; reviews aggregate trigger.

## Appendix C. Ledger recipes

Sign: debit +, credit −. P price, R refund owed, F platform fee, V provider share, with R + F + V = P.

- Capture (key `capture:<payment_id>`): PSP_CLEARING +P, ESCROW(booking) −P.
- Settlement (key `settle:<booking_id>`): ESCROW(booking) +P; REFUND_PENDING −R if R > 0; PLATFORM_REVENUE −F if F > 0; PROVIDER_BALANCE(business) −V if V > 0. Insert a `refunds` row (PENDING) when R > 0.
- Refund paid (key `refund-paid:<refund_id>`): REFUND_PENDING +R, PSP_CLEARING −R.
- Payout requested (key `payout-request:<payout_id>`): PROVIDER_BALANCE +A, PAYOUT_PENDING −A. Paid: PAYOUT_PENDING +A, PSP_CLEARING −A. Failed: PAYOUT_PENDING +A, PROVIDER_BALANCE −A.
- Global invariant: the sum of every ledger line is 0, always.

## Appendix D. Booking events

| From | Event | To | Money effect |
|---|---|---|---|
| PENDING | PAYMENT_CAPTURED | CONFIRMED | capture |
| PENDING | HOLD_EXPIRED | EXPIRED | none |
| PENDING | CUSTOMER_CANCELLED | CANCELLED | none |
| EXPIRED, CANCELLED | PAYMENT_CAPTURED (late) | CANCELLED | capture, then settle with full refund |
| CONFIRMED | PROVIDER_DECLINED, PROVIDER_CANCELLED, ADMIN_CANCELLED | CANCELLED | settle, full refund |
| CONFIRMED | CUSTOMER_CANCELLED | CANCELLED | settle by cancellation policy (refund share; rest to provider less commission) |
| CONFIRMED | PROVIDER_COMPLETED | COMPLETED | none (starts the window) |
| CONFIRMED | PROVIDER_NO_SHOW | NO_SHOW | none (starts the window) |
| COMPLETED, NO_SHOW | CUSTOMER_CONFIRMED, WINDOW_ELAPSED | VERIFIED | settle, release |
| COMPLETED, NO_SHOW | DISPUTE_OPENED | DISPUTED | none (escrow stays held) |
| DISPUTED | DISPUTE_RESOLVED_RELEASE | VERIFIED | settle, release |
| DISPUTED | DISPUTE_RESOLVED_REFUND | CANCELLED | settle, full refund |
| DISPUTED | DISPUTE_RESOLVED_SPLIT | VERIFIED | settle, split by refund_bps |

Everything else is an invalid transition. VERIFIED is terminal; EXPIRED and CANCELLED only accept a late payment.

## Appendix E. Settlement maths and policies

- `commission(x, bps) = floor((x * bps + 5000) / 10000)` (round half up; use BigInt for the product). Release: R = 0, F = commission(P), V = P − F. Refund: R = P, F = 0, V = 0. Split(refundBps): R = floor(P * refundBps / 10000), rest = P − R, F = commission(rest), V = rest − F.
- Customer cancellation: the first tier of `cancellation_policy` (sorted by hoursBefore, descending) whose hoursBefore ≤ hours until start; at or after the start time counts as 0 %. Provider or admin cancellation: 100 %. Treat the refund share as a split.
- Window: COMPLETED or NO_SHOW plus `verification_window_hours` (24) auto-verifies. Hold: `hold_minutes` (15).
- Copy rule: UI text never promises a dispute timeframe or an automatic refund; it says Styra support reviews and processes refunds.

## Appendix F. Slots

`computeSlots({ date, timeZone, rules, busy, durationMin, bufferMin = 0, stepMin = 15, now, leadMin = 60 })` returns start instants (UTC). For the local date's weekday, walk each rule window in `stepMin` steps and keep a start when `start + duration` fits the window, `start ≥ now + leadMin`, and `[start, start + duration + buffer)` overlaps no busy interval (bookings and time off). Convert wall time to UTC with `Intl.DateTimeFormat` for the business time zone (no extra dependency). Test Africa/Nairobi and a DST zone (Europe/London on 2026-03-29).

## Appendix G. Payments

Provider interface: `initiate({paymentId, amountMinor, currency, payer, reference, callbackUrl}) → {providerRef, action}`; `parseWebhook(headers, rawBody) → {eventId, providerRef, status, amountMinor?} | null` (verifies the signature, returns null when invalid); optional `refund` and `payout`. A webhook is stored once in `webhook_events` (unique per provider and event id), then applied inside one transaction through the booking engine; replays do nothing. The captured amount and currency must equal the booking's price, otherwise the event is parked for an admin. Production without a configured provider answers 503; the fake provider only runs outside production (or behind an explicit flag).

## Appendix H. Test matrix (must exist before cutover)

- **Core**: money parsing and rounding; commission half-up edges; every settlement shape sums to the price; every journal builder balances; every transition row above plus invalid ones; cancellation tiers at their boundaries; slots (windows, buffers, busy overlap, lead time, split shifts, DST).
- **Database (real Postgres)**: unbalanced journal rejected at commit; update and delete of ledger rows rejected; duplicate idempotency key rejected; negative escrow, provider balance, payout or refund balance rejected; booking marked HELD without a capture rejected; capture without updating the booking rejected; price change after capture rejected; overlapping PENDING/CONFIRMED bookings for one staff rejected, adjacent ones accepted; TS status lists equal the CHECK lists in the catalog.
- **Engine (real Postgres)**: happy path; auto-release; dispute with release, refund and split; customer cancel at each policy tier; provider decline; hold expiry; late payment; replayed capture and replayed settlement do nothing; two racing settlements post once; payout request over the balance rejected; payout paid and failed.
- **Browser (preview)**: browse, book, pay (fake), provider completes, customer confirms, admin ledger shows a balanced book.
- **Tooling that worked in the web/backend sandbox**: PostgreSQL 16 plus Bun's built-in `Bun.SQL` (`new Bun.SQL(url)`, `sql.unsafe(text, params)`, `sql.begin`) gave real-database tests with no extra packages. On a Mac use Homebrew `postgresql@16`, Docker, or `supabase start`. Create a fresh database per test file, apply `supabase/migrations/*.sql`, drop it afterwards, and skip the db tests when no database is reachable.

## Decision log

(Code: record changes to the design here, with the reason.)

- 2026-11-20, web/backend chat: added `docs/v2/design-language.md` at the user's request (Liquid Glass at Apple level on web and mobile, the skills to use, wording, tone and motto). Decided for the user, who left design decisions to us: English first with Swahili as the first extra locale, `KSh` for display, 12-hour times in Nairobi time, "Styra fee" instead of "commission" in the UI, Android as the performance baseline.
- 2026-11-20, Code: a late payment on an EXPIRED or CANCELLED booking settles under the key `settle:<booking_id>:<payment_id>` (not `settle:<booking_id>`), so a second late payment for the same booking can still be captured and refunded. Ordinary settlements keep `settle:<booking_id>`.
- 2026-11-20, Code: payout steps have their own keys: `payout-request:<id>`, `payout-paid:<id>`, `payout-failed:<id>`.
- 2026-11-20, Code: a captured amount or currency that differs from the booking is parked on the payment (`failure_reason`, audit row) and answered `PAYMENT_MISMATCH`; nothing posts. An admin decides.
- 2026-11-20, Code: R5 locks the ledger account row inside the deferred check, so two transactions that would together overdraw a balance check one after the other. Only ESCROW lines carry `booking_id` (enforced by a trigger).
- 2026-11-20, Code: `tsconfig` target raised from ES2017 to ES2020 for BigInt literals (money is `bigint`).
