# Styra v2

Grooming marketplace for Kenya. Customers book a service; the payment is held until they confirm the
service (or 24 hours pass), then the business is paid. This branch (`rebuild/v2`) is a rebuild from
scratch. v1 stays live on `main` until the user approves cutover.

Read first: `docs/v2/blueprint.md` (architecture, data model, money rules, test matrix) and
`docs/v2/design-language.md` (Liquid Glass, wording, motto). Both are mandatory. Record design changes in
the blueprint's "Decision log".

## Layout

- `src/core`: pure TypeScript, no I/O: money, ledger postings, booking state machine, policies, slots.
- `src/server`: db adapter (`pg`), services, `booking-engine.ts`, payment providers, auth, outbox.
- `src/contracts`: zod schemas, the `/api/v2` contract shared by web and mobile.
- `src/app`: Next.js routes (RSC first) and `/api/v2` handlers.
- `supabase/migrations`: plain, idempotent SQL for schema `styra`. Additive only until cutover.
- `tests/core` (pure) and `tests/db` (real Postgres; skipped when no database is reachable).
- `apps/mobile`: the Flutter app on `/api/v2`.
- v1 code (`src/lib/escrow.ts`, `verification.ts`, `booking-status.ts`, `api-utils.ts`, Prisma, the
  `prisma/*.sql` files) is legacy. Don't extend it and never run the v1 SQL files.

## Commands

- `bun test tests/core`: pure core tests.
- `bun test tests/db`: database tests. Needs `STYRA_TEST_DATABASE_URL` (a Postgres 16+ server where the
  test can create and drop databases), e.g. `postgres://localhost:5432/postgres`.
- `bun run test` (or `bun test --timeout 20000`): everything, including the v1 tests that still guard the live site. DB tests need the longer timeout on a busy machine.
- `bun run build`, `bun run lint`.

## Money rules (blueprint section 5, mandatory)

- Amounts are integer minor units (`bigint` in SQL, `bigint` in TS). No floats, no `Number` money maths.
- The database enforces the rest: balanced journals, an append-only ledger, one post per idempotency
  key, no negative liability balances, `escrow_state` in step with the ledger, no overlapping bookings
  per staff member, prices frozen once money is held. Don't weaken a constraint to make code pass.
- Only `src/server/booking-engine.ts` changes a booking's status together with money, in one transaction
  under a row lock. Everything else asks the engine.
- Status lists are UPPERCASE and come from `src/core`; `tests/db` checks them against the SQL CHECKs.
- Errors: `AppError(code, message, status)`; responses are `{ ok: true, data }` or
  `{ ok: false, error: { code, message } }`.

## Words and design (design-language.md)

- Glass only on the functional layer (bars, sheets, menus, toasts); content and money stay opaque.
- Every user-facing string comes from `copy/en.json`. No literals in components or widgets.
- No system words in the UI (escrow, ledger, webhook); money words follow the ledger ("on its way"
  until money has moved). Motto: "Your Style, On Demand." exactly.

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

## Brand (web)

- Colours, fonts and logos come from the identity kit (`brand/`, owned by the brand/mobile chat). The web
  copies are in `globals.css`; `tests/brand.test.ts` checks them against the kit and checks WCAG contrast.
  Change a colour in the kit first, then here.
- Fonts: Syne 700 for `h1`, `h2` and `.text-display` (the uppercase hero line), Manrope for everything else,
  loaded with `next/font` in `layout.tsx`. In CSS use `var(--font-syne)` and `var(--font-manrope)`: `@theme inline`
  does not emit `--font-sans` or `--font-heading`. Use `tabular-nums` for prices, times and counts.
- Logos: render `BrandLogo` (`src/components/ui/brand-logo.tsx`); it picks the SVG in `public/brand/logo`
  for the current theme. Never retype, redraw, recolour or add PNG logos.
- Dark `--primary` is a light violet, so text on `bg-primary` or the gradient is `text-primary-foreground`
  (dark), never `text-white`. In the light theme, small accent text uses `text-link`, not `text-primary`.
- Tints (80/50/20%) are for charts and backgrounds, never text. Icons take the ink or primary colour,
  never the accent.

## Don't

- Don't merge `rebuild/v2` into `main`, switch the live site, or drop v1 tables without the user's yes.
- Don't delete branches, Vercel projects, or database data.
- Don't put secrets in the repo, docs or chat. Provider keys go into Vercel env settings via the user.
- Don't commit images over ~500 KB, `.env*`, logs, `.pid`, or database files.
- Don't write copy that promises a dispute timeframe or an automatic refund.
