-- 219_sop_write_manager_on_sort_place_property.sql
-- SS-800, corrected ruling. Applied live 6 Aug 2026.
--
-- sop_library's sop_write policy granted ALL to any owner OR manager of
-- ANY ONE property, with no property scoping in qual or with_check --
-- zero blast radius while every property belongs to Sort + Place, real
-- the day the first outside household gets an owner.
--
-- THE CORRECTED MODEL: owner and manager are not a permission ladder,
-- they are different kinds of party. Owner means the client family
-- (Jessica on Henderson; the Strauss family on Main and Country). Manager
-- means Sort + Place. sop_write must be manager ON A SORT + PLACE
-- PROPERTY -- never owner, and never unscoped.
--
-- THE TRAP THIS AVOIDS: Racquel holds owner on all five of her own
-- properties, because owner was the only tier that granted what she
-- needed before this fix and service_provider (SS-437) was never built.
-- That makes the live data LOOK like owner is the top tier, but it is a
-- workaround, not the model. A naive manager-only policy would look like
-- it locks the author out -- except it does not: verified live before
-- writing this, Racquel's own working account (sortandplace@gmail.com,
-- already documented elsewhere in this codebase as "the account she
-- actually works from") holds manager on all five properties already,
-- alongside fischlchaya@gmail.com (Blimie). Her owner-tier personal
-- login (racq1020@gmail.com) is the household-owner identity; her
-- manager-tier login is the Sort + Place identity. No membership row
-- needed to change -- only the policy. Verified after applying:
-- fischlchaya@gmail.com and sortandplace@gmail.com can write,
-- racq1020@gmail.com and jessicahndrsn5@gmail.com (Henderson's owner)
-- cannot.
--
-- sort_place_managed is a NEW flag, deliberately distinct from
-- operator_console (which is Lax-only, a different and narrower concept
-- -- the cross-house business console). This flag means "Sort + Place
-- operates this property," which is true of all five real properties
-- today and would be false for a future fully self-service household
-- with no Sort + Place involvement at all.
update public.properties
set feature_flags = feature_flags || '{"sort_place_managed": true}'::jsonb
where name in ('Main', 'Low', 'Country', 'Lax', 'Henderson');

drop policy if exists sop_write on public.sop_library;

-- TO authenticated IS LOAD BEARING (see migration 183/184's own hard-won
-- lesson, SS-614): without it this policy is evaluated by PUBLIC too, and
-- an anon caller can error inside the EXISTS subquery rather than simply
-- getting zero rows.
create policy sop_write on public.sop_library
for all
to authenticated
using (
  exists (
    select 1 from property_members pm
    join properties p on p.id = pm.property_id
    where pm.user_id = auth.uid()
      and pm.role = 'manager'
      and (p.feature_flags->>'sort_place_managed')::boolean is true
  )
)
with check (
  exists (
    select 1 from property_members pm
    join properties p on p.id = pm.property_id
    where pm.user_id = auth.uid()
      and pm.role = 'manager'
      and (p.feature_flags->>'sort_place_managed')::boolean is true
  )
);

comment on policy sop_write on public.sop_library is
  'SS-800. Manager on a Sort + Place-managed property, never owner (owner is the client family, not a permission tier) and never property-unscoped. See this migration file for the full ruling and the trap it avoids.';
