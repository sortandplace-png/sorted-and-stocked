-- 121_consultation_requests.sql
-- Stores "Book Your Consultation" submissions from the public root (/)
-- marketing page -- separate from access_requests (that one is the /welcome
-- software-early-access funnel; this one is Sort + Place's own organizing-
-- services consultation intake, a different product pitch with a different
-- field shape). Stored before any notification attempt so a Resend hiccup
-- never loses a real lead, same reasoning as access_requests.
create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  service_interest text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  status text not null default 'new',
  handled_at timestamptz,
  handled_by uuid
);

alter table public.consultation_requests enable row level security;

-- Public-facing form, no signed-in user -- inserts happen via the anon key
-- from app/api/consultation-request, which does its own validation.
create policy consultation_requests_insert_anon
  on public.consultation_requests
  for insert
  to anon, authenticated
  with check (true);

-- Same owner/manager-only read-and-manage shape as access_requests --
-- submitted contact info shouldn't be queryable by every signed-in role.
create policy consultation_requests_manager_read
  on public.consultation_requests
  for select
  to public
  using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid() and pm.role = any (array['owner', 'manager']::member_role[])
    )
  );

create policy consultation_requests_manager_update
  on public.consultation_requests
  for update
  to public
  using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid() and pm.role = any (array['owner', 'manager']::member_role[])
    )
  )
  with check (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid() and pm.role = any (array['owner', 'manager']::member_role[])
    )
  );

create policy consultation_requests_manager_delete
  on public.consultation_requests
  for delete
  to public
  using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid() and pm.role = any (array['owner', 'manager']::member_role[])
    )
  );
