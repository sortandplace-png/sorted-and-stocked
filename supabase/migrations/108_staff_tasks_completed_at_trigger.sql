-- staff_tasks.completed_at was queried by the weekly-digest edge function
-- ("tasks completed this week") but nothing ever wrote it -- same dead-
-- column shape as the now-dropped `completed` boolean, just not yet
-- fixed. This trigger stamps it the moment status transitions INTO
-- 'done', and clears it back to null if a task is later reopened (status
-- moves away from 'done') so a briefly-done-then-reopened task doesn't
-- keep counting as completed. Pure data accuracy -- doesn't send
-- anything, doesn't touch whether the digest itself runs (that stays on
-- its existing manual-trigger-only hold, untouched by this).
--
-- Covers INSERT too (defensively -- the app's own insert site always
-- hardcodes status: 'open' today, but a future direct insert with
-- status='done' should still get a real completed_at rather than null).
-- OLD isn't available in an INSERT context, hence the tg_op branch.
create or replace function set_staff_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' then
      new.completed_at := now();
    end if;
    return new;
  end if;

  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status is distinct from 'done' and old.status = 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_staff_tasks_completed_at
  before insert or update of status on staff_tasks
  for each row
  execute function set_staff_task_completed_at();
