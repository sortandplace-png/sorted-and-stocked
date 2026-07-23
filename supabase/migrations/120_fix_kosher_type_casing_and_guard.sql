-- 120_fix_kosher_type_casing_and_guard.sql
-- Root cause of a reproduced false-positive meat/dairy conflict (Main,
-- 2026-07-01: a Parve recipe was wrongly flagged against real Meat dishes
-- planned that day). check_meat_dairy_conflict()'s own Parve-exemption
-- guard ("if new_kosher_type = 'Parve' then return new") is logically
-- correct but case-sensitive, and 2 of 317 recipes carry a lowercase
-- kosher_type value that doesn't match it:
--   - "Sandwich Steaks" (d66c5112-cd55-4666-ad1c-36a54497c2f8): 'meat'
--   - Vegetarian "Pho" in a Jar (or Bowl) (08f05418-1ccb-46b6-93cd-e269c462b9b2): 'parve'
-- The 'parve' row is the one that produced the reported bug (fell through
-- the Parve guard into the conflict check). The 'meat' row carries a
-- worse but never-yet-triggered risk: it would make the trigger check for
-- the wrong conflicting type (Meat instead of Dairy), silently allowing a
-- genuine Meat+Dairy same-day conflict to pass undetected. Confirmed via
-- full history that no real Dairy recipe has ever coincided with either
-- mistyped row on any shared date, so this has not caused an actual
-- kashrut violation to date -- but nothing was stopping it going forward,
-- since no CHECK constraint governed kosher_type at all.

-- 1. Normalize the 2 known-bad rows to the established convention.
update recipes set kosher_type = 'Meat' where id = 'd66c5112-cd55-4666-ad1c-36a54497c2f8' and kosher_type = 'meat';
update recipes set kosher_type = 'Parve' where id = '08f05418-1ccb-46b6-93cd-e269c462b9b2' and kosher_type = 'parve';

-- 2. Harden the trigger against this bug class recurring through any
-- future insert/update path -- defense in depth underneath the
-- constraint added below, not a substitute for it.
create or replace function public.check_meat_dairy_conflict()
 returns trigger
 language plpgsql
as $function$
declare
  new_kosher_type text;
  conflicting_type text;
  conflict_count integer;
begin
  if new.recipe_id is null then
    return new;
  end if;
  select kosher_type into new_kosher_type from recipes where id = new.recipe_id;
  -- Parve never conflicts with anything; an unclassified recipe (null)
  -- can't be checked, same "skip if unknown" posture as recipe_id being
  -- null above. Case-insensitive so a future case-inconsistent value
  -- can't reopen this bug even if it somehow slips past the constraint.
  if new_kosher_type is null or lower(new_kosher_type) = 'parve' then
    return new;
  end if;
  conflicting_type := case when lower(new_kosher_type) = 'meat' then 'Dairy' else 'Meat' end;
  select count(*) into conflict_count
  from meal_plan_entries mpe
  join recipes r on r.id = mpe.recipe_id
  where mpe.property_id = new.property_id
    and mpe.plan_date = new.plan_date
    and mpe.id != new.id
    and lower(r.kosher_type) = lower(conflicting_type);
  if conflict_count > 0 then
    raise exception 'This % recipe conflicts with a % recipe already planned for % on this property — meat and dairy cannot be scheduled the same day.',
      new_kosher_type, conflicting_type, new.plan_date;
  end if;
  return new;
end;
$function$;

-- 3. Root-cause-level fix: previously nothing prevented a future insert
-- from recreating this exact bug (only recipes_course_check existed;
-- kosher_type had no constraint at all). Null stays allowed -- the
-- trigger above treats an unclassified recipe as exempt, not an error.
alter table recipes
  add constraint recipes_kosher_type_check
  check (kosher_type is null or kosher_type = any (array['Meat', 'Dairy', 'Parve']));
