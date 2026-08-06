-- 205_property_counts_and_henderson_onboarding.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.
--
-- bedrooms/bathrooms are REAL COLUMNS, and staple_repeatable rooms are
-- instantiated N times from bedrooms. That is what lets the count be
-- edited later and recompute scope, instead of forcing re-onboarding.

alter table public.properties
  add column if not exists bedrooms integer,
  add column if not exists bathrooms numeric;

comment on column public.properties.bedrooms is
  'Set at onboarding, editable after. rooms.staple_repeatable rooms are instantiated N times from this, so changing it recomputes scope rather than forcing re-onboarding.';

update public.properties set bedrooms = 3, bathrooms = 2.5 where name = 'Henderson';

-- Observance is read from calendar_layers, never from a module flag, so a
-- non-observant house simply does not get the staple_observant_only rooms.
with lax as (select id from properties where name = 'Lax'),
hend as (select id, coalesce(bedrooms, 2) as beds from properties where name = 'Henderson'),
observant as (
  select coalesce((select 'jewish' = any(calendar_layers) from properties where name='Henderson'), false) as is_observant
),
fixed as (
  insert into rooms (property_id, name_en, name_es, floor, sort_order, active, is_staple, staple_repeatable, staple_observant_only)
  select (select id from hend), r.name_en, r.name_es, r.floor, r.sort_order, true, true, false, r.staple_observant_only
  from rooms r, observant o
  where r.property_id = (select id from lax)
    and r.is_staple and not r.staple_repeatable
    and (o.is_observant or not r.staple_observant_only)
  returning id
),
template as (
  select r.name_es, r.floor, r.sort_order from rooms r
  where r.property_id = (select id from lax) and r.is_staple and r.staple_repeatable
  order by r.name_en limit 1
),
beds as (
  insert into rooms (property_id, name_en, name_es, floor, sort_order, active, is_staple, staple_repeatable)
  select (select id from hend), 'Bedroom ' || g, regexp_replace(t.name_es, '\d+$', '') || g,
         t.floor, t.sort_order + g, true, true, true
  from template t, generate_series(1, (select beds from hend)) g
  returning id
)
select (select count(*) from fixed) as fixed_rooms, (select count(*) from beds) as bedrooms_made;
