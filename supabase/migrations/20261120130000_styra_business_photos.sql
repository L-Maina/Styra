-- Business logo, cover (banner) and gallery photos. Additive and idempotent.
create table if not exists styra.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references styra.businesses (id) on delete cascade,
  kind text not null,
  url text not null,
  storage_path text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint business_photos_kind_check check (kind in ('LOGO', 'COVER', 'GALLERY')),
  constraint business_photos_caption_length check (caption is null or char_length(caption) <= 140)
);
create index if not exists business_photos_business_idx on styra.business_photos (business_id, kind, position);
-- One logo and one cover per business; the gallery holds many.
create unique index if not exists business_photos_one_logo_cover on styra.business_photos (business_id, kind) where kind in ('LOGO', 'COVER');
alter table styra.business_photos enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on styra.business_photos from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on styra.business_photos from authenticated';
  end if;
  -- Public bucket for photos (Supabase only; skipped on a plain Postgres).
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('business-photos', 'business-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
