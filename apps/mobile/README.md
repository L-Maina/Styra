# Styra Mobile (Flutter)

Native iOS/Android client for the Styra grooming marketplace. It talks to the existing Next.js API (`/api/*`) and covers everything the web app does.

## Setup

```bash
cd apps/mobile
./tool/bootstrap.sh          # generates android/ + ios/, applies permissions, runs flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=http://<your-LAN-IP>:3000
```

`API_BASE_URL` defaults to `http://10.0.2.2:3000`, which is your machine's localhost as seen from the Android emulator. iOS simulators can use `http://localhost:3000`. For production builds, pass your deployed domain over https.

## How it talks to the backend

- **Auth** works like the web app: the backend sets an httpOnly `styra-token` cookie. The app keeps cookies in a persistent jar, so no backend changes are needed.
- **CSRF**: the `csrf-token` cookie is sent back as an `X-CSRF-Token` header on POST/PUT/PATCH/DELETE. If the backend rejects it, the app refreshes it once through `/auth/me` and retries.
- **Responses**: `{ success, data }` and `{ success, data, pagination }` are unwrapped in `lib/core/api_client.dart`. Models (`lib/models/models.dart`) read loose JSON, so backend shape changes won't crash the app.

## Design tokens

`lib/core/design_tokens.dart` copies the web tokens in `src/app/globals.css`. The web UI workstream owns the tokens. When they change, update this file to match and don't add new tokens here.

## Structure

```
lib/
  core/       api client, config, tokens, theme, formatting
  models/     tolerant JSON models
  state/      auth controller + Riverpod data providers
  widgets/    shared UI (empty states, cards, status chips, stats)
  features/
    auth/ home/ marketplace/ map/ business/ booking/ bookings/
    payments/ chat/ notifications/ profile/ wallet/ disputes/ claims/
    business_dash/   owner dashboard: overview, services, team, payouts, promotions, onboarding
    admin/           overview, businesses, users, disputes, escrow, claims, support, reports, bans
```

Navigation is role-based. Customers get Home / Explore / Bookings / Messages / Profile, business owners get Dashboard / Bookings / Messages / Profile, and admins get Admin / Explore / Messages / Profile.

## Known limitations

- **Chat** checks for new messages every 4 seconds instead of using Pusher (marked with a TODO in `chat_screens.dart`).
- **Push notifications**: the in-app notification list works, but device push (FCM/APNs) isn't wired up.
- **Image upload** is entered as a URL for now. `ApiClient.upload()` is ready for when an `/api/upload` route exists.
- **Payments**: the app creates the payment and then polls `/payments/:id` or `/payments/check-mpesa`. The backend currently auto-completes payments in dev mode and doesn't yet call the real M-Pesa, Stripe or PayPal APIs.

## Booking and escrow flow (matches the web app and `src/lib/booking-status.ts`)

- Statuses are UPPERCASE. Older rows may be lowercase, so the app normalises them like `normalizeStatus()` on the web.
- The provider moves a booking PENDING → CONFIRMED → IN_PROGRESS → COMPLETED with `PATCH /bookings/:id`. COMPLETED starts the customer's 24-hour window.
- While a booking is COMPLETED, the customer can **confirm** (`POST /bookings/:id/confirm`, which releases escrow and takes an optional rating) or **report a problem** (`POST /bookings/:id/dispute`, 10–2000 characters, which moves it to DISPUTED). If neither happens, the cron job auto-releases the payment.
- VERIFIED means completed and paid out, and that's when a review can be left. DISPUTED shows as "Under review".
- Customers can't cancel less than 24 hours before the appointment. Admins can't change a booking's status.
- Badge labels match the web: COMPLETED is "Awaiting confirmation", VERIFIED is "Completed", DISPUTED is "Under review".

## Backend gaps (checked against `claude/escrow-screens`)
- There's no `/api/upload` route, although the web `uploadFile()` calls it. Image fields take URLs until the route exists.
- There's no favorites endpoint, although the `Favorite` model exists.
