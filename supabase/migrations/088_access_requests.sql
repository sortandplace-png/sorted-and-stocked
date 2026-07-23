-- 088_access_requests.sql
-- Stores "Request Early Access" submissions from the public marketing page
-- so a submission is retrievable even if the notification email fails to
-- arrive -- not relying on email alone, per the real spec.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  city text,
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;

-- Public-facing form, no signed-in user -- inserts happen via the anon key
-- from app/api/request-access, which itself does the validation. No one
-- (including anon/authenticated users) can read this table directly; only
-- the service role (used nowhere client-side) can, keeping submitted
-- contact info from being queryable by any real app user.
create policy access_requests_insert_anon
  on public.access_requests
  for insert
  to anon, authenticated
  with check (true);
