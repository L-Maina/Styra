-- In-app messaging between a customer and a business. Additive and idempotent.
create table if not exists styra.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references styra.users (id) on delete cascade,
  business_id uuid not null references styra.businesses (id) on delete cascade,
  booking_id uuid references styra.bookings (id) on delete set null,
  last_message_at timestamptz,
  customer_read_at timestamptz,
  business_read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_pair_key unique (customer_id, business_id)
);
create index if not exists conversations_business_idx on styra.conversations (business_id, last_message_at desc);
create index if not exists conversations_customer_idx on styra.conversations (customer_id, last_message_at desc);
create index if not exists conversations_booking_idx on styra.conversations (booking_id);

create table if not exists styra.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references styra.conversations (id) on delete cascade,
  sender_id uuid not null references styra.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 2000)
);
create index if not exists messages_conversation_idx on styra.messages (conversation_id, created_at);
create index if not exists messages_sender_idx on styra.messages (sender_id);

alter table styra.conversations enable row level security;
alter table styra.messages enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on styra.conversations, styra.messages from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on styra.conversations, styra.messages from authenticated';
  end if;
end $$;
