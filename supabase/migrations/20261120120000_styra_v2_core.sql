-- Styra v2 core schema (blueprint Appendix A and B).
-- Additive: everything lives in schema `styra`; v1 tables in `public` are untouched.
-- Idempotent: safe to apply more than once.

create schema if not exists styra;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- helpers
create or replace function styra.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function styra.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'ledger is append-only: % on %.% is not allowed', tg_op, tg_table_schema, tg_table_name
    using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------- identity
create table if not exists styra.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  password_hash text,
  name text not null,
  role text not null default 'CUSTOMER',
  status text not null default 'ACTIVE',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check check (role in ('CUSTOMER', 'PROVIDER', 'ADMIN')),
  constraint users_status_check check (status in ('ACTIVE', 'SUSPENDED')),
  constraint users_contact_check check (email is not null or phone is not null)
);
create unique index if not exists users_email_key on styra.users (lower(email));
create unique index if not exists users_phone_key on styra.users (phone);

create table if not exists styra.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references styra.users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint sessions_token_hash_key unique (token_hash)
);
create index if not exists sessions_user_id_idx on styra.sessions (user_id);
create index if not exists sessions_expires_at_idx on styra.sessions (expires_at);

-- ---------------------------------------------------------------- marketplace
create table if not exists styra.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references styra.users (id),
  slug text not null,
  name text not null,
  category text not null,
  description text,
  phone text,
  address text,
  city text,
  lat double precision,
  lng double precision,
  timezone text not null default 'Africa/Nairobi',
  status text not null default 'DRAFT',
  commission_bps integer,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_slug_key unique (slug),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint businesses_status_check check (status in ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED')),
  constraint businesses_commission_check check (commission_bps is null or commission_bps between 0 and 5000)
);
create index if not exists businesses_owner_id_idx on styra.businesses (owner_id);
create index if not exists businesses_status_city_idx on styra.businesses (status, city);

create table if not exists styra.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references styra.businesses (id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  duration_min integer not null,
  price_minor bigint not null,
  currency char(3) not null default 'KES',
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_duration_check check (duration_min between 5 and 720),
  constraint services_price_check check (price_minor >= 0)
);
create index if not exists services_business_id_idx on styra.services (business_id);
create index if not exists services_active_idx on styra.services (business_id) where active;

create table if not exists styra.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references styra.businesses (id) on delete cascade,
  user_id uuid references styra.users (id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_business_id_idx on styra.staff (business_id);
create index if not exists staff_user_id_idx on styra.staff (user_id);

create or replace function styra.add_default_staff() returns trigger
language plpgsql as $$
begin
  insert into styra.staff (business_id, name) values (new.id, 'Main chair');
  return new;
end $$;
drop trigger if exists businesses_default_staff on styra.businesses;
create trigger businesses_default_staff after insert on styra.businesses
  for each row execute function styra.add_default_staff();

create table if not exists styra.availability_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references styra.staff (id) on delete cascade,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_weekday_check check (weekday between 0 and 6),
  constraint availability_window_check check (end_time > start_time)
);
create index if not exists availability_rules_staff_id_idx on styra.availability_rules (staff_id);

create table if not exists styra.time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references styra.staff (id) on delete cascade,
  during tstzrange not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_not_empty check (not isempty(during))
);
create index if not exists time_off_staff_during_idx on styra.time_off using gist (staff_id, during);

-- ---------------------------------------------------------------- bookings
create table if not exists styra.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  customer_id uuid not null references styra.users (id),
  business_id uuid not null references styra.businesses (id),
  staff_id uuid not null references styra.staff (id),
  service_id uuid not null references styra.services (id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  during tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
  price_minor bigint not null,
  currency char(3) not null default 'KES',
  status text not null default 'PENDING',
  escrow_state text not null default 'NONE',
  notes text,
  cancelled_by text,
  cancel_reason text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_code_key unique (code),
  constraint bookings_time_check check (end_at > start_at),
  constraint bookings_price_check check (price_minor >= 0),
  constraint bookings_status_check check (status in ('PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DISPUTED', 'VERIFIED', 'CANCELLED', 'EXPIRED')),
  constraint bookings_escrow_state_check check (escrow_state in ('NONE', 'HELD', 'SETTLED')),
  constraint bookings_status_escrow_check check (
    (status in ('PENDING', 'EXPIRED') and escrow_state = 'NONE')
    or (status in ('CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DISPUTED') and escrow_state = 'HELD')
    or (status = 'VERIFIED' and escrow_state = 'SETTLED')
    or (status = 'CANCELLED' and escrow_state in ('NONE', 'SETTLED'))
  ),
  constraint bookings_cancelled_by_check check (cancelled_by is null or cancelled_by in ('CUSTOMER', 'PROVIDER', 'ADMIN', 'SYSTEM')),
  constraint bookings_no_overlap exclude using gist (staff_id with =, during with &&) where (status in ('PENDING', 'CONFIRMED'))
);
create index if not exists bookings_customer_id_idx on styra.bookings (customer_id, start_at desc);
create index if not exists bookings_business_id_idx on styra.bookings (business_id, start_at desc);
create index if not exists bookings_service_id_idx on styra.bookings (service_id);
create index if not exists bookings_staff_id_idx on styra.bookings (staff_id);
create index if not exists bookings_pending_expiry_idx on styra.bookings (expires_at) where status = 'PENDING';
create index if not exists bookings_window_idx on styra.bookings (completed_at) where status in ('COMPLETED', 'NO_SHOW');

-- R9: price and parties frozen once money is held
create or replace function styra.freeze_held_booking() returns trigger
language plpgsql as $$
begin
  if old.escrow_state <> 'NONE' and (
       new.price_minor is distinct from old.price_minor
    or new.currency is distinct from old.currency
    or new.customer_id is distinct from old.customer_id
    or new.business_id is distinct from old.business_id
    or new.service_id is distinct from old.service_id
    or new.staff_id is distinct from old.staff_id
    or new.start_at is distinct from old.start_at
    or new.end_at is distinct from old.end_at) then
    raise exception 'booking % is frozen: price and parties cannot change once payment is held', old.id
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bookings_freeze on styra.bookings;
create trigger bookings_freeze before update on styra.bookings
  for each row execute function styra.freeze_held_booking();

-- ---------------------------------------------------------------- payments
create table if not exists styra.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references styra.bookings (id),
  provider text not null,
  provider_ref text,
  idempotency_key text not null,
  amount_minor bigint not null,
  currency char(3) not null default 'KES',
  status text not null default 'INITIATED',
  payer_phone text,
  failure_reason text,
  raw jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_idempotency_key_key unique (idempotency_key),
  constraint payments_amount_check check (amount_minor > 0),
  constraint payments_provider_check check (provider in ('MPESA', 'PAYSTACK', 'STRIPE', 'PAYPAL', 'FAKE')),
  constraint payments_status_check check (status in ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED'))
);
create index if not exists payments_booking_id_idx on styra.payments (booking_id);
create unique index if not exists payments_provider_ref_key on styra.payments (provider, provider_ref) where provider_ref is not null;

create table if not exists styra.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  constraint webhook_events_provider_event_key unique (provider, event_id)
);

-- ---------------------------------------------------------------- refunds, payouts, disputes
create table if not exists styra.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references styra.bookings (id),
  amount_minor bigint not null,
  currency char(3) not null default 'KES',
  status text not null default 'PENDING',
  provider_ref text,
  reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refunds_amount_check check (amount_minor > 0),
  constraint refunds_status_check check (status in ('PENDING', 'SUBMITTED', 'PAID', 'FAILED'))
);
create index if not exists refunds_booking_id_idx on styra.refunds (booking_id);
create index if not exists refunds_open_idx on styra.refunds (created_at) where status in ('PENDING', 'SUBMITTED');

create table if not exists styra.payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references styra.businesses (id),
  amount_minor bigint not null,
  currency char(3) not null default 'KES',
  method text not null,
  destination text not null,
  status text not null default 'REQUESTED',
  idempotency_key text not null,
  provider_ref text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payouts_idempotency_key_key unique (idempotency_key),
  constraint payouts_amount_check check (amount_minor > 0),
  constraint payouts_method_check check (method in ('MPESA', 'BANK')),
  constraint payouts_status_check check (status in ('REQUESTED', 'PROCESSING', 'PAID', 'FAILED'))
);
create index if not exists payouts_business_id_idx on styra.payouts (business_id, created_at desc);

create table if not exists styra.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references styra.bookings (id),
  opened_by uuid not null references styra.users (id),
  reason text not null,
  details text,
  status text not null default 'OPEN',
  outcome text,
  refund_bps integer,
  resolved_by uuid references styra.users (id),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_booking_id_key unique (booking_id),
  constraint disputes_status_check check (status in ('OPEN', 'RESOLVED')),
  constraint disputes_outcome_check check (outcome is null or outcome in ('RELEASE', 'REFUND', 'SPLIT')),
  constraint disputes_resolved_check check (status <> 'RESOLVED' or outcome is not null),
  constraint disputes_split_check check (outcome is distinct from 'SPLIT' or refund_bps between 0 and 10000)
);
create index if not exists disputes_opened_by_idx on styra.disputes (opened_by);
create index if not exists disputes_resolved_by_idx on styra.disputes (resolved_by);
create index if not exists disputes_open_idx on styra.disputes (created_at) where status = 'OPEN';

-- ---------------------------------------------------------------- ledger
create table if not exists styra.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  business_id uuid references styra.businesses (id),
  currency char(3) not null default 'KES',
  created_at timestamptz not null default now(),
  constraint ledger_accounts_kind_check check (kind in ('PSP_CLEARING', 'ESCROW', 'PROVIDER_BALANCE', 'PAYOUT_PENDING', 'REFUND_PENDING', 'PLATFORM_REVENUE')),
  constraint ledger_accounts_business_check check ((kind = 'PROVIDER_BALANCE') = (business_id is not null)),
  constraint ledger_accounts_kind_business_currency_key unique nulls not distinct (kind, business_id, currency)
);
create index if not exists ledger_accounts_business_id_idx on styra.ledger_accounts (business_id);

create table if not exists styra.journals (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  idempotency_key text not null,
  booking_id uuid references styra.bookings (id),
  payment_id uuid references styra.payments (id),
  refund_id uuid references styra.refunds (id),
  payout_id uuid references styra.payouts (id),
  memo text,
  created_by uuid references styra.users (id),
  created_at timestamptz not null default now(),
  constraint journals_idempotency_key_key unique (idempotency_key),
  constraint journals_kind_check check (kind in ('CAPTURE', 'SETTLEMENT', 'REFUND_PAID', 'PAYOUT_REQUEST', 'PAYOUT_PAID', 'PAYOUT_FAILED', 'ADJUSTMENT'))
);
create index if not exists journals_booking_id_idx on styra.journals (booking_id);
create index if not exists journals_payment_id_idx on styra.journals (payment_id);
create index if not exists journals_refund_id_idx on styra.journals (refund_id);
create index if not exists journals_payout_id_idx on styra.journals (payout_id);
create index if not exists journals_created_by_idx on styra.journals (created_by);

create table if not exists styra.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references styra.journals (id),
  account_id uuid not null references styra.ledger_accounts (id),
  booking_id uuid references styra.bookings (id),
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_amount_check check (amount_minor <> 0)
);
create index if not exists ledger_entries_journal_id_idx on styra.ledger_entries (journal_id);
create index if not exists ledger_entries_account_booking_idx on styra.ledger_entries (account_id, booking_id);
create index if not exists ledger_entries_booking_id_idx on styra.ledger_entries (booking_id);

-- R3: append-only
drop trigger if exists journals_append_only on styra.journals;
create trigger journals_append_only before update or delete on styra.journals
  for each row execute function styra.forbid_change();
drop trigger if exists journals_no_truncate on styra.journals;
create trigger journals_no_truncate before truncate on styra.journals
  for each statement execute function styra.forbid_change();
drop trigger if exists ledger_entries_append_only on styra.ledger_entries;
create trigger ledger_entries_append_only before update or delete on styra.ledger_entries
  for each row execute function styra.forbid_change();
drop trigger if exists ledger_entries_no_truncate on styra.ledger_entries;
create trigger ledger_entries_no_truncate before truncate on styra.ledger_entries
  for each statement execute function styra.forbid_change();

-- ESCROW lines must carry a booking; other lines must not.
create or replace function styra.check_entry_booking() returns trigger
language plpgsql as $$
declare
  k text;
begin
  select kind into k from styra.ledger_accounts where id = new.account_id;
  if k = 'ESCROW' and new.booking_id is null then
    raise exception 'ESCROW ledger lines must name a booking' using errcode = 'P0001';
  end if;
  if k <> 'ESCROW' and new.booking_id is not null then
    raise exception 'only ESCROW ledger lines carry a booking' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists ledger_entries_booking on styra.ledger_entries;
create trigger ledger_entries_booking before insert on styra.ledger_entries
  for each row execute function styra.check_entry_booking();

-- R2: every journal balances to zero with at least two lines (checked at commit)
create or replace function styra.assert_journal_balanced(p_journal uuid) returns void
language plpgsql as $$
declare
  n integer;
  total numeric;
begin
  select count(*), coalesce(sum(amount_minor), 0) into n, total
    from styra.ledger_entries where journal_id = p_journal;
  if n < 2 then
    raise exception 'journal % needs at least two ledger lines (has %)', p_journal, n using errcode = 'P0001';
  end if;
  if total <> 0 then
    raise exception 'journal % does not balance: lines sum to %', p_journal, total using errcode = 'P0001';
  end if;
end $$;

create or replace function styra.trg_journal_balanced_from_entry() returns trigger
language plpgsql as $$
begin
  perform styra.assert_journal_balanced(new.journal_id);
  return null;
end $$;
create or replace function styra.trg_journal_balanced_from_journal() returns trigger
language plpgsql as $$
begin
  perform styra.assert_journal_balanced(new.id);
  return null;
end $$;
drop trigger if exists ledger_entries_balanced on styra.ledger_entries;
create constraint trigger ledger_entries_balanced after insert on styra.ledger_entries
  deferrable initially deferred for each row execute function styra.trg_journal_balanced_from_entry();
drop trigger if exists journals_balanced on styra.journals;
create constraint trigger journals_balanced after insert on styra.journals
  deferrable initially deferred for each row execute function styra.trg_journal_balanced_from_journal();

-- R5: liability balances never go negative (sum of lines <= 0). Locks the account row so
-- concurrent writers check one after the other.
create or replace function styra.trg_balance_not_negative() returns trigger
language plpgsql as $$
declare
  k text;
  total numeric;
begin
  select kind into k from styra.ledger_accounts where id = new.account_id for update;
  if k = 'PSP_CLEARING' then
    return null;
  end if;
  if k = 'ESCROW' then
    select coalesce(sum(amount_minor), 0) into total
      from styra.ledger_entries where account_id = new.account_id and booking_id = new.booking_id;
  else
    select coalesce(sum(amount_minor), 0) into total
      from styra.ledger_entries where account_id = new.account_id;
  end if;
  if total > 0 then
    raise exception '% balance would go negative (by %)', k, total using errcode = 'P0001';
  end if;
  return null;
end $$;
drop trigger if exists ledger_entries_not_negative on styra.ledger_entries;
create constraint trigger ledger_entries_not_negative after insert on styra.ledger_entries
  deferrable initially deferred for each row execute function styra.trg_balance_not_negative();

-- R6: a booking's escrow_state agrees with its escrow balance (checked at commit)
create or replace function styra.assert_booking_escrow(p_booking uuid) returns void
language plpgsql as $$
declare
  b record;
  n integer;
  balance numeric;
begin
  select escrow_state, price_minor into b from styra.bookings where id = p_booking;
  if not found then
    return;
  end if;
  select count(*), coalesce(-sum(e.amount_minor), 0) into n, balance
    from styra.ledger_entries e join styra.ledger_accounts a on a.id = e.account_id
   where a.kind = 'ESCROW' and e.booking_id = p_booking;
  if b.escrow_state = 'NONE' and n > 0 then
    raise exception 'booking % has escrow lines but escrow_state NONE', p_booking using errcode = 'P0001';
  elsif b.escrow_state = 'HELD' and (n = 0 or balance <> b.price_minor) then
    raise exception 'booking % is HELD but escrow holds % of %', p_booking, balance, b.price_minor using errcode = 'P0001';
  elsif b.escrow_state = 'SETTLED' and (n = 0 or balance <> 0) then
    raise exception 'booking % is SETTLED but escrow still holds %', p_booking, balance using errcode = 'P0001';
  end if;
end $$;

create or replace function styra.trg_booking_escrow_from_booking() returns trigger
language plpgsql as $$
begin
  perform styra.assert_booking_escrow(new.id);
  return null;
end $$;
create or replace function styra.trg_booking_escrow_from_entry() returns trigger
language plpgsql as $$
begin
  if new.booking_id is not null then
    perform styra.assert_booking_escrow(new.booking_id);
  end if;
  return null;
end $$;
drop trigger if exists bookings_escrow_consistent on styra.bookings;
create constraint trigger bookings_escrow_consistent after insert or update on styra.bookings
  deferrable initially deferred for each row execute function styra.trg_booking_escrow_from_booking();
drop trigger if exists ledger_entries_escrow_consistent on styra.ledger_entries;
create constraint trigger ledger_entries_escrow_consistent after insert on styra.ledger_entries
  deferrable initially deferred for each row execute function styra.trg_booking_escrow_from_entry();

-- ---------------------------------------------------------------- reviews, favourites
create table if not exists styra.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references styra.bookings (id),
  customer_id uuid not null references styra.users (id),
  business_id uuid not null references styra.businesses (id),
  rating smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_booking_id_key unique (booking_id),
  constraint reviews_rating_check check (rating between 1 and 5)
);
create index if not exists reviews_business_id_idx on styra.reviews (business_id, created_at desc);
create index if not exists reviews_customer_id_idx on styra.reviews (customer_id);

create or replace function styra.refresh_business_rating() returns trigger
language plpgsql as $$
declare
  biz uuid := coalesce(new.business_id, old.business_id);
begin
  update styra.businesses b
     set rating_count = s.n, rating_avg = coalesce(round(s.avg, 2), 0)
    from (select count(*)::int as n, avg(rating)::numeric as avg from styra.reviews where business_id = biz) s
   where b.id = biz;
  if tg_op = 'UPDATE' and old.business_id is distinct from new.business_id then
    update styra.businesses b
       set rating_count = s.n, rating_avg = coalesce(round(s.avg, 2), 0)
      from (select count(*)::int as n, avg(rating)::numeric as avg from styra.reviews where business_id = old.business_id) s
     where b.id = old.business_id;
  end if;
  return null;
end $$;
drop trigger if exists reviews_rating on styra.reviews;
create trigger reviews_rating after insert or update or delete on styra.reviews
  for each row execute function styra.refresh_business_rating();

create table if not exists styra.favorites (
  user_id uuid not null references styra.users (id) on delete cascade,
  business_id uuid not null references styra.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index if not exists favorites_business_id_idx on styra.favorites (business_id);

-- ---------------------------------------------------------------- platform
create table if not exists styra.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into styra.settings (key, value) values
  ('commission_bps', '1000'),
  ('verification_window_hours', '24'),
  ('hold_minutes', '15'),
  ('cancellation_policy', '[{"hoursBefore":24,"refundBps":10000},{"hoursBefore":4,"refundBps":5000},{"hoursBefore":0,"refundBps":0}]'),
  ('payout_min_minor', '10000')
on conflict (key) do nothing;

create table if not exists styra.outbox (
  id bigint generated always as identity primary key,
  topic text not null,
  payload jsonb not null,
  run_after timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists outbox_due_idx on styra.outbox (run_after) where processed_at is null;

create table if not exists styra.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references styra.users (id),
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_actor_id_idx on styra.audit_log (actor_id);
create index if not exists audit_log_entity_idx on styra.audit_log (entity, entity_id);
drop trigger if exists audit_log_append_only on styra.audit_log;
create trigger audit_log_append_only before update or delete on styra.audit_log
  for each row execute function styra.forbid_change();

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array['users', 'businesses', 'services', 'staff', 'availability_rules', 'time_off', 'bookings',
                           'payments', 'refunds', 'payouts', 'disputes', 'reviews', 'settings'] loop
    execute format('drop trigger if exists %I on styra.%I', t || '_touch', t);
    execute format('create trigger %I before update on styra.%I for each row execute function styra.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- lock down
-- RLS on every table with no policies: only the server connection (table owner / service role) reads or writes.
do $$
declare
  t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'styra' and c.relkind = 'r' loop
    execute format('alter table styra.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema styra from anon';
    execute 'revoke all on schema styra from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema styra from authenticated';
    execute 'revoke all on schema styra from authenticated';
  end if;
end $$;
