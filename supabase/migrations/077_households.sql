-- Real household/client grouping above properties. Properties (Main,
-- Country) were flat, unrelated rows -- "Strauss" was only a hardcoded
-- label on the properties picker screen, not real data. This is the
-- foundation for that screen showing one box per household instead of
-- one box per property, and for this to scale to multiple households
-- (multiple clients) as more are added, not just one household with
-- exactly two properties.
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Nullable: the "+ Add a property" flow (NewPropertyForm.tsx) doesn't know
-- about households yet and doesn't set this -- a real, separate follow-up
-- (prompting for which household a new property joins, or defaulting to
-- the creator's existing household) rather than something to force through
-- here by making this NOT NULL and silently breaking that flow.
alter table public.properties add column household_id uuid references public.households(id);

-- Backfill: both real existing properties (Main, Country) belong to the
-- same real household, created by the same user (confirmed live).
with new_household as (
  insert into public.households (name, created_by)
  values ('Strauss', 'd4924019-58d1-49ec-97ae-25614e334340')
  returning id
)
update public.properties
set household_id = (select id from new_household)
where household_id is null;

alter table public.households enable row level security;

-- Readable by anyone who's a member of at least one property under this
-- household -- same membership concept the rest of the app already uses,
-- not a new permission model.
create policy households_select_member on households for select
  using (exists (
    select 1 from public.properties p
    where p.household_id = households.id and public.is_property_member(p.id)
  ));
