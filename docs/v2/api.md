# Styra API v2

Base path `/api/v2`. Shared by the web app and the Flutter app. The zod schemas in `src/contracts` are the
source of truth; this page is the readable summary.

## Conventions

- **Envelope.** Success: `{ "ok": true, "data": … }`. Failure: `{ "ok": false, "error": { "code", "message", "fields?" } }`.
  `code` is stable; clients map it to copy from the catalogue (`copy/en.json`). `message` is for logs, never shown.
- **Auth.** `POST /auth/register` or `/auth/login` returns `{ user, token }` and sets an HttpOnly `styra_session`
  cookie. Web uses the cookie; mobile sends `Authorization: Bearer <token>`. Sessions last 30 days.
  Cookie-authenticated writes must come from the site's own origin.
- **Money.** Integer minor units (KES cents) as JSON numbers: `150000` is KSh 1,500. Format with the catalogue's
  money format, never with floats.
- **Time.** ISO 8601 instants in UTC. Show them in the business time zone (`Africa/Nairobi`).
- **Idempotency.** `POST /bookings/:code/pay` accepts an `Idempotency-Key` header; retries with the same key do not
  start a second payment.
- **Actions.** Every booking carries `actions`: what the viewer may do now (`pay`, `cancel`, `confirm`,
  `dispute`, `review` for customers; `complete`, `no-show`, `decline` for the business). Show only those buttons.

## Endpoints

| Method and path | Who | Body or query | Returns |
|---|---|---|---|
| `POST /auth/register` | anyone | `email, password (≥10), name, phone?` | `{ user, token }` 201 |
| `POST /auth/login` | anyone | `email, password` | `{ user, token }` |
| `POST /auth/logout` | signed in | | `{ signedOut }` |
| `GET /me` | signed in | | `{ user }` |
| `GET /businesses` | anyone | `q?, category?, city?, limit?, cursor?` | `{ items[], nextCursor }` |
| `GET /businesses/:slug` | anyone | | `{ business }` with services, staff, hours, reviews |
| `GET /businesses/:slug/slots` | anyone | `serviceId, date (YYYY-MM-DD), staffId?` | `{ date, timeZone, durationMin, slots[{ startAt, staffId }] }` |
| `POST /bookings` | signed in | `serviceId, startAt, staffId?, notes?` | `{ booking }` 201 (PENDING, held 15 min) |
| `GET /bookings` | signed in | | `{ items[] }` (mine as customer) |
| `GET /bookings/:code` | customer, business, admin | | `{ booking }` |
| `POST /bookings/:code/pay` | customer | `method (MPESA, PAYSTACK, FAKE), phone? (M-Pesa)` | `{ booking, next }`: `next.kind` is `DONE`, `WAIT_FOR_PHONE` (poll the booking until CONFIRMED) or `REDIRECT` (open `next.url`) |
| `POST /webhooks/mpesa?payment=&token=` | Safaricom | STK callback | `{ ResultCode: 0 }` |
| `POST /webhooks/paystack` | Paystack (`x-paystack-signature`) | event | `{ received }` |
| `POST /bookings/:code/cancel` | customer | `reason?` | `{ booking }` (refund by policy) |
| `POST /bookings/:code/confirm` | customer | | `{ booking }` (VERIFIED, business paid) |
| `POST /bookings/:code/dispute` | customer | `reason (10–2000), details?` | `{ booking }` (DISPUTED, payment stays held) |
| `POST /bookings/:code/review` | customer | `rating 1–5, comment?` | `{ booking }` |
| `GET /pro/business`, `POST /pro/business` | provider (any user may create one) | `name, category, city, address?, phone?, description?, lat?, lng?` | `{ business }` |
| `POST /pro/services` | provider | `name, category, durationMin, priceMinor, description?` | `{ service }` 201 |
| `PUT /pro/availability` | provider | `staffId?, rules[{ weekday 0–6, start "HH:MM", end }]` | `{ staffId, rules }` |
| `GET /pro/bookings` | provider | | `{ items[] }` |
| `POST /pro/bookings/:id/{complete,no-show,decline,cancel}` | provider | `reason?` | `{ booking }` |
| `POST /admin/businesses/:id/approve` | admin | | `{ business }` |
| `GET /admin/ledger` | admin | | `{ balanced, accounts[{ kind, businessId, businessName, currency, balanceMinor }] }` |
| `POST|GET /cron/tick` | `Authorization: Bearer $CRON_SECRET` | | `{ expired[], verified[] }` |

Coming in M4: payment webhooks, refunds and payouts queues, disputes for admins, provider earnings and payouts.

## Error codes

`VALIDATION` (with `fields`), `UNAUTHENTICATED`, `FORBIDDEN`, `FORBIDDEN_ORIGIN`, `NOT_FOUND`, `EMAIL_TAKEN`,
`PHONE_TAKEN`, `INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED`, `BUSINESS_EXISTS`, `NO_BUSINESS`, `SLOT_TAKEN`,
`SLOT_IN_PAST`, `HOLD_EXPIRED`, `INVALID_STATE`, `PAYMENT_MISMATCH`, `PROVIDER_UNAVAILABLE`, `ALREADY_REVIEWED`,
`INSUFFICIENT_BALANCE`, `BELOW_MINIMUM`, `TOO_EARLY`, `PHONE_INVALID`, `SERVER_ERROR` (with `ref`).

## Booking DTO

```json
{
  "id": "uuid", "code": "STY-7K3M9Q", "status": "CONFIRMED", "escrowState": "HELD",
  "startAt": "2026-11-22T11:30:00.000Z", "endAt": "2026-11-22T12:00:00.000Z",
  "priceMinor": 150000, "currency": "KES", "expiresAt": null, "autoConfirmAt": null, "notes": null,
  "business": { "id": "uuid", "name": "Kinyozi Pro", "slug": "kinyozi-pro", "phone": "0712345678", "address": "Westlands" },
  "service": { "id": "uuid", "name": "Classic cut", "durationMin": 30 },
  "staff": { "id": "uuid", "name": "Main chair" },
  "customer": { "id": "uuid", "name": "Amina Wanjiru" },
  "refund": null, "hasReview": false, "actions": ["cancel"]
}
```
