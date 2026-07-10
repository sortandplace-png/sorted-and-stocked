-- Real Kanban status instead of a boolean, real priority/category fields,
-- and a real property_members reference for assignment (unlocks a real
-- avatar instead of a free-text name). Only one existing row and its
-- assigned_to was already null, so this is a clean conversion with no
-- fuzzy-matching needed -- the old text column is kept (renamed) rather
-- than dropped, in case any historical free-text value is ever needed.

alter table staff_tasks rename column assigned_to to assigned_to_legacy_text;

alter table staff_tasks add column status text not null default 'open'
  check (status in ('open', 'in_progress', 'done'));
update staff_tasks set status = case when completed then 'done' else 'open' end;

alter table staff_tasks add column priority text
  check (priority in ('low', 'medium', 'high'));

alter table staff_tasks add column category text;

alter table staff_tasks add column assigned_to uuid references property_members(id) on delete set null;

comment on column staff_tasks.completed is 'Superseded by status (done <=> completed=true) -- kept in sync by application code for now, not dropped to avoid a breaking change to any other reader.';
