-- 130_household_level_grants.sql
--
-- !! NOT YET APPLIED -- FOR REVIEW. !!
--
-- Option B: a client-level grant MATERIALISES property_members rows. It does
-- NOT introduce a second source of authority. is_property_member() and
-- has_property_role() are untouched -- verified live that they back 112 of
-- this database's 178 RLS policies, and rewriting those in one step across
-- two live clients (with a third arriving) is not reviewable property by
-- property, and would fail silently by showing one client another's data.
--
-- CORRECTION TO THE BRIEF, verified live before writing: there is no need
-- for a new `clients` table -- `households` ALREADY EXISTS and
-- properties.household_id ALREADY EXISTS. Current data:
--     households: Strauss  -> Main, Country
--     properties: Lax has household_id = NULL
-- So the flat dropdown isn't a missing table, it's one unlinked row. Adding
-- a parallel `clients` table would duplicate a built concept -- exactly the
-- failure mode the check-live-schema rule exists to prevent. This migration
-- uses households throughout.

-- 1. Give Lax its own household and link it. Named separately from Strauss:
-- Lax is a different client, not a Strauss residence.
insert into households (name)
select 'Lax'
where not exists (select 1 from households where name = 'Lax');

update properties
set household_id = (select id from households where name = 'Lax')
where name = 'Lax' and household_id is null;

-- 2. The client-level grant itself. This table is the SOURCE; the rows it
-- creates in property_members are the DERIVED copies.
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  constraint household_members_household_user_key unique (household_id, user_id)
);

create index if not exists household_members_household_id_idx on household_members (household_id);
create index if not exists household_members_user_id_idx on household_members (user_id);

alter table household_members enable row level security;

-- Mirrors the inventory_items shape, but scoped through the household's
-- properties since household_members has no property_id of its own. A member
-- of any property in the household can read the grants; only an owner/manager
-- of one can change them.
create policy "household_members_select_member" on household_members
  for select using (
    exists (select 1 from properties p where p.household_id = household_members.household_id
            and is_property_member(p.id))
  );

create policy "household_members_write_owner_manager" on household_members
  for all using (
    exists (select 1 from properties p where p.household_id = household_members.household_id
            and has_property_role(p.id, array['owner'::member_role, 'manager'::member_role]))
  ) with check (
    exists (select 1 from properties p where p.household_id = household_members.household_id
            and has_property_role(p.id, array['owner'::member_role, 'manager'::member_role]))
  );

-- 3. Provenance. Without this nobody can tell WHY someone has access, and
-- revocation cannot distinguish an inherited row from a directly-granted one.
-- NULL = granted directly on this property. Non-null = derived from a
-- household grant, and safe to remove when that grant goes.
alter table property_members
  add column if not exists granted_via_household_id uuid references households(id) on delete set null;

create index if not exists property_members_granted_via_idx
  on property_members (granted_via_household_id);

comment on column property_members.granted_via_household_id is
  'NULL = direct grant on this property (never removed by household revocation). Non-null = materialised from a household_members grant and removed when that grant is revoked.';

-- 4. Materialisation.
-- NOTE on ON CONFLICT DO NOTHING: property_members has UNIQUE
-- (property_id, user_id), so a user has at most ONE row per property --
-- direct and inherited access cannot coexist as separate rows. DO NOTHING is
-- therefore deliberate: an existing DIRECT grant always wins and is never
-- overwritten or downgraded by a household grant arriving later.
create or replace function materialise_household_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into property_members (property_id, user_id, role, granted_via_household_id)
  select p.id, new.user_id, new.role, new.household_id
  from properties p
  where p.household_id = new.household_id
  on conflict (property_id, user_id) do nothing;
  return new;
end;
$$;

create or replace function revoke_household_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only rows this grant created. A direct grant (granted_via_household_id
  -- null) is never touched.
  delete from property_members pm
  using properties p
  where pm.property_id = p.id
    and p.household_id = old.household_id
    and pm.user_id = old.user_id
    and pm.granted_via_household_id = old.household_id;
  return old;
end;
$$;

-- 5. Inheritance on property creation, as a TRIGGER rather than application
-- code, so a property inserted by direct SQL still gets its grantees and the
-- rule cannot be bypassed.
create or replace function inherit_household_grants_on_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.household_id is null then
    return new;
  end if;
  insert into property_members (property_id, user_id, role, granted_via_household_id)
  select new.id, hm.user_id, hm.role, hm.household_id
  from household_members hm
  where hm.household_id = new.household_id
  on conflict (property_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_materialise_household_grant on household_members;
create trigger trg_materialise_household_grant
  after insert on household_members
  for each row execute function materialise_household_grant();

drop trigger if exists trg_revoke_household_grant on household_members;
create trigger trg_revoke_household_grant
  after delete on household_members
  for each row execute function revoke_household_grant();

-- Fires on INSERT and on a property being moved INTO a household later.
drop trigger if exists trg_inherit_household_grants on properties;
create trigger trg_inherit_household_grants
  after insert or update of household_id on properties
  for each row execute function inherit_household_grants_on_property();

-- 6. Blimie's grant, expressed at household level rather than per property.
-- She is already a manager on all three properties, so materialisation will
-- DO NOTHING for the existing rows -- those stay DIRECT grants and are
-- correctly not removable by revoking the household grant. The value here is
-- forward-looking: the next Strauss property inherits her automatically,
-- which is the failure that had to be fixed by hand for Lax.
insert into household_members (household_id, user_id, role)
select h.id, pr.id, 'manager'::member_role
from households h
cross join profiles pr
join auth.users u on u.id = pr.id
where h.name = 'Strauss' and u.email = 'fischlchaya@gmail.com'
on conflict (household_id, user_id) do nothing;
