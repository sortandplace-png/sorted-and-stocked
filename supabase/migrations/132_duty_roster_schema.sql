-- 132_duty_roster_schema.sql
-- Schema for the unified Staff Duty Roster (PROMPT A, 27 July 2026).
--
-- Three independent changes, one migration because the roster page needs all
-- three before it can render honestly:
--   A1  reset checklists gain a calendar trigger
--   A2  a task can carry more than one SOP
--   A3  SOPs gain the two missing "what does done look like" fields
--
-- Deliberately NOT here: dropping master_tasks.sop_id. A column drop does not
-- belong in the same migration that introduces its replacement -- if A2 needs
-- to be rolled back, the old column still holds the data.

begin;

-- ---------------------------------------------------------------------------
-- A1. Reset checklists get a trigger
-- ---------------------------------------------------------------------------
-- task_templates had no frequency at all, which is why "freeze extra ice" and
-- "sharpen knives" could not be scheduled: nothing said when the checklist
-- fires.
alter table task_templates
  add column if not exists frequency_id uuid references frequencies(id);

-- post_shabbos did not exist (verified: 0 rows). Sorted 95 -- between
-- erev_shabbos (90) and pre_yom_tov (100), since it is the same weekly cycle.
-- interval_days 7 mirrors erev_shabbos; both are Shabbos-anchored and weekly.
insert into frequencies (code, label_en, label_es, recurrence_kind, interval_days, sort_order)
values ('post_shabbos', 'After Shabbos', 'Después de Shabat', 'hebrew', 7, 95)
on conflict (code) do nothing;

-- Names matched by pattern rather than exact literal so an em-dash/hyphen
-- difference in the source data cannot silently match zero rows.
update task_templates t set frequency_id = f.id
  from frequencies f where f.code = 'erev_shabbos'  and t.template_name = 'Erev Shabbos Prep';

update task_templates t set frequency_id = f.id
  from frequencies f where f.code = 'post_shabbos'  and t.template_name = 'Post-Shabbos Deep Reset';

update task_templates t set frequency_id = f.id
  from frequencies f where f.code = 'pre_yom_tov'   and t.template_name like 'Post-Yom Tov Reset%General';

update task_templates t set frequency_id = f.id
  from frequencies f where f.code = 'post_sukkos'   and t.template_name like 'Post-Yom Tov Reset%Sukkos';

update task_templates t set frequency_id = f.id
  from frequencies f where f.code = 'pre_pesach'    and t.template_name like 'Post-Yom Tov Reset%Pesach';

-- ---------------------------------------------------------------------------
-- A2. One task, many SOPs
-- ---------------------------------------------------------------------------
-- Bathroom cleaning genuinely needs Toilet Detail + Sink Basin + Chrome
-- Fixtures. A single sop_id column cannot express that.
create table if not exists master_task_sops (
  id uuid primary key default gen_random_uuid(),
  master_task_id uuid not null references master_tasks(id) on delete cascade,
  sop_id uuid not null references sop_library(id) on delete cascade,
  is_primary boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (master_task_id, sop_id)
);

alter table master_task_sops enable row level security;

-- master_task_sops has no property_id of its own, so both policies reach the
-- property through master_tasks. Same shape as the tasks_read / tasks_write
-- pair already on master_tasks.
drop policy if exists master_task_sops_read on master_task_sops;
create policy master_task_sops_read on master_task_sops
  for select using (
    exists (
      select 1 from master_tasks mt
      where mt.id = master_task_sops.master_task_id
        and is_property_member(mt.property_id)
    )
  );

drop policy if exists master_task_sops_write on master_task_sops;
create policy master_task_sops_write on master_task_sops
  for all using (
    exists (
      select 1 from master_tasks mt
      join property_members pm on pm.property_id = mt.property_id
      where mt.id = master_task_sops.master_task_id
        and pm.user_id = auth.uid()
        and pm.role = any (array['owner'::member_role, 'manager'::member_role])
    )
  ) with check (
    exists (
      select 1 from master_tasks mt
      join property_members pm on pm.property_id = mt.property_id
      where mt.id = master_task_sops.master_task_id
        and pm.user_id = auth.uid()
        and pm.role = any (array['owner'::member_role, 'manager'::member_role])
    )
  );

create index if not exists master_task_sops_task_idx on master_task_sops (master_task_id);

-- Carry the one existing link across (T-00063 -> SOP-017, verified). Marked
-- primary: it is that task's only SOP.
insert into master_task_sops (master_task_id, sop_id, is_primary, sort_order)
select mt.id, mt.sop_id, true, 10
from master_tasks mt
where mt.sop_id is not null
on conflict (master_task_id, sop_id) do nothing;

-- ---------------------------------------------------------------------------
-- A3. "This is what done looks like"
-- ---------------------------------------------------------------------------
alter table sop_library
  add column if not exists expected_appearance_url text,
  add column if not exists photo_verification boolean not null default false;

commit;
