# Styra v2 cutover plan

Cutover means `rebuild/v2` replaces `main` and v2 serves the live site. **Nothing here happens without the
user's explicit yes**, and dropping the v1 tables is a separate yes after that.

## Before the yes (checklist)

- [ ] Every PR into `rebuild/v2` merged with tests green and previews built.
- [ ] Payment keys in Vercel env (Production): M-Pesa Daraja (`MPESA_ENV=production`, consumer key and
      secret, shortcode, passkey, a random `MPESA_CALLBACK_SECRET`) and `PAYSTACK_SECRET_KEY`. One real
      KSh 10 booking paid and refunded end to end on production keys.
- [ ] `APP_URL` set to the live domain (M-Pesa callbacks and Paystack return links use it).
- [ ] `CRON_SECRET` set; Vercel cron hits `/api/v2/cron/tick` daily, and Supabase `pg_cron` + `pg_net`
      every 5 minutes (expiring holds and releasing payments on time needs the 5-minute one).
- [ ] Supabase Storage bucket `business-photos` exists (migration applied) and
      `SUPABASE_SERVICE_ROLE_KEY` is set for Production.
- [ ] Remove the demo businesses: `delete from styra.users where email like '%@demo.styra.test'`
      (cascades to their businesses, services, hours and photos; no money was ever posted for them).
- [ ] An admin account: register normally, then `update styra.users set role = 'ADMIN' where email = …`.
- [ ] Security and performance advisors clean for `styra`.
- [ ] Design gate screenshots refreshed for every screen (`scripts/v2/screens.py`).
- [ ] Mobile app pointed at the live API and submitted to the stores (separate review).

## The switch (about 15 minutes, low traffic hour)

1. Announce a short maintenance window (v1 has test data only, so no customer migration is needed).
2. Merge `rebuild/v2` into `main` (fast-forward or merge commit); Vercel builds Production.
3. Watch the build and the first requests: `get_runtime_errors` for `styra`, then a scripted browser run
   on the live domain: browse, book, pay (real KSh 10), provider completes, customer confirms, admin
   ledger balanced. Refund the KSh 10 through the admin queue.
4. Keep `/legacy` reachable for a week for comparison, then remove the route (with a yes).

## Rollback

Vercel "Instant Rollback" to the last v1 production deployment. v2 data stays in `styra` untouched; v1
tables were never changed, so v1 resumes exactly where it was.

## Afterwards (separate yes)

- Drop the v1 tables in `public` (back them up first with `pg_dump`).
- Consolidate the three Vercel projects (`styra`, `styra-repo`, `styra-project`) into one.
- Remove the v1 code (Prisma, `src/lib/escrow.ts` and friends, the `prisma/*.sql` files).
