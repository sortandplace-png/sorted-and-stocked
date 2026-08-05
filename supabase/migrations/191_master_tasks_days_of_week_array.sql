-- 191_master_tasks_days_of_week_array.sql
-- SS-701. A task can fall on more than one day. The Low master closet
-- hamper is Monday AND Thursday and exists as two rows, T-00997 and
-- T-00998, purely because the column could only hold one integer. Lax
-- carries the same workaround as T-01018 and T-01019. The master bath is
-- twice a week and would have hit the same wall next.
--
-- THIS IS THE EXPAND HALF OF EXPAND/CONTRACT. It adds days_of_week and
-- backfills it. day_of_week STAYS, still populated, still read by the four
-- call sites that have not moved yet:
--     app/properties/[id]/my-day/page.tsx
--     components/StaffDutyOverview.tsx
--     components/DutyRosterClient.tsx  (matchDay, and the save path)
-- Dropping the scalar in the same migration would break every one of them
-- between deploy and cutover. A follow-up migration drops it once they
-- read the array.
--
-- THE DOMAIN IS ISO 1..7, NOT 0..6, AND THAT IS A CORRECTION.
-- The old constraint was CHECK (day_of_week >= 0 AND day_of_week <= 6),
-- but every consumer numbers days ISO, 1=Mon..7=Sun: my-day and
-- StaffDutyOverview both build { Mon:1 ... Sun:7 }, and DutyRosterClient's
-- DAY_PICKER_OPTIONS literally contains { iso: 7, key: 'daySun' }. So the
-- picker offered Sunday and the constraint rejected it: SUNDAY HAS NEVER
-- BEEN STORABLE. Meanwhile 0 was accepted and means nothing in ISO. The
-- domain was off by one at both ends.
--
-- The four rows that carry a day hold 1 and 4, which are already correct
-- ISO Monday and Thursday, so the backfill is a straight copy and no data
-- is reinterpreted. This is the cheap moment: 4 of 998 rows, and Racquel
-- is setting days room by room right now.

alter table public.master_tasks
  add column if not exists days_of_week integer[];

-- Every element must be a real ISO weekday, and an empty array is not a
-- way of saying "no day": that is what NULL means, and allowing both would
-- give two encodings for one state.
alter table public.master_tasks
  drop constraint if exists master_tasks_days_of_week_check;

alter table public.master_tasks
  add constraint master_tasks_days_of_week_check
  check (
    days_of_week is null
    or (
      cardinality(days_of_week) > 0
      and days_of_week <@ array[1,2,3,4,5,6,7]
    )
  );

-- Duplicates and ordering are NORMALISED rather than rejected.
-- ARRAY[4,1], ARRAY[1,4] and ARRAY[1,1,4] all mean the same schedule, and
-- a CHECK cannot dedupe because Postgres forbids a subquery in a CHECK
-- (0A000). Rejecting ARRAY[4,1] would also be hostile to a UI that appends
-- as the user taps days. So the trigger sorts and dedupes on write and the
-- stored value is always canonical, which is what makes days_of_week = and
-- ORDER BY behave.
--
-- Touches only NEW, never reads a table, so it runs safely as the invoking
-- user and needs no SECURITY DEFINER. search_path is pinned regardless.
create or replace function public.normalize_days_of_week()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.days_of_week is not null then
    new.days_of_week := array(
      select distinct d from unnest(new.days_of_week) as d order by d
    );
  end if;
  return new;
end;
$$;

drop trigger if exists master_tasks_normalize_days_of_week on public.master_tasks;
create trigger master_tasks_normalize_days_of_week
  before insert or update of days_of_week on public.master_tasks
  for each row execute function public.normalize_days_of_week();

-- Straight copy. Only rows with a day get an array; everything else stays
-- NULL, which continues to mean "every day" exactly as before.
update public.master_tasks
   set days_of_week = array[day_of_week]
 where day_of_week is not null
   and days_of_week is null;

comment on column public.master_tasks.days_of_week is
  'ISO weekdays, 1=Mon..7=Sun. NULL means every day, same as day_of_week did. Replaces the scalar day_of_week, which could not hold the Monday-and-Thursday tasks and could not represent Sunday at all (its CHECK was 0..6 against ISO consumers). day_of_week is retained until the last reader moves.';

-- v_master_tasks selects day_of_week, so it is recreated here to expose
-- BOTH columns. Consumers can move to days_of_week without a second
-- migration, and nothing reading day_of_week breaks in the meantime.
-- CREATE OR REPLACE cannot add a column in the middle of a view, so this
-- is a drop and recreate, reproducing the definition exactly with one
-- column added after day_of_week.
drop view if exists public.v_master_tasks;

create view public.v_master_tasks as
 SELECT t.id,
    t.task_number,
    t.property_id,
    r.name_en AS room_en,
    r.name_es AS room_es,
    z.name_en AS zone_en,
    z.name_es AS zone_es,
    f.code AS frequency_code,
    f.label_en AS frequency_en,
    f.label_es AS frequency_es,
    f.interval_days,
    t.task_en,
    t.task_es,
    t.sop_en,
    t.sop_es,
    t.estimated_minutes,
    t.assigned_role,
    t.job_type,
    t.day_of_week,
    t.days_of_week,
    t.time_of_day,
    t.active,
    ( SELECT count(*) AS count
           FROM task_supplies ts
          WHERE ts.task_id = t.id) AS supply_count,
    t.sort_order,
    t.updated_at
   FROM master_tasks t
     LEFT JOIN rooms r ON r.id = t.room_id
     LEFT JOIN zones z ON z.id = t.zone_id
     LEFT JOIN frequencies f ON f.id = t.frequency_id;

-- A GIN index so "tasks on Tuesday" (days_of_week @> array[2]) does not
-- table-scan once Racquel has populated the house.
create index if not exists master_tasks_days_of_week_idx
  on public.master_tasks using gin (days_of_week);

-- DELIBERATELY NOT DONE HERE, per instruction: T-00997/T-00998 and
-- T-01018/T-01019 are left as two rows each. Collapsing them to one row
-- carrying array[1,4] is a content decision for Racquel once the UI reads
-- the array, not a side effect of a schema change.
