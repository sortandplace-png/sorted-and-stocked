-- 233_master_task_number_seq_self_heals.sql
-- Applied live 7 Aug 2026.
--
-- Racquel found master_task_number_seq at 966 while master_tasks' real max
-- was 2,267 -- 1,301 behind, causing INSERTs to fail on duplicate
-- task_number. She ran setval to realign it, but flagged (correctly) that
-- a manual realignment is not a fix: master_tasks.task_number already
-- defaults to nextval('master_task_number_seq'), so the drift can only
-- come from something inserting a row WITH an explicit task_number (a
-- data migration, an import, a clone/reconcile pass -- this codebase has
-- had several: Henderson onboarding, Lax/Main reconciliation, staple
-- seeding) that bypasses the default and never advances the sequence.
--
-- Same shape as the work_items register's own next_work_item_id() lesson
-- (SS-806/SS-814: a generator can fall behind live writes) but the fix
-- here is a self-healing trigger rather than a re-check-before-insert
-- convention, because task_number is DB-default-generated, not
-- app-computed: after every insert, if the row's own task_number is
-- higher than the sequence has ever produced, the sequence catches up to
-- it. A future explicit-value insert (another import, another clone
-- pass) can no longer leave the sequence behind -- it corrects itself in
-- the same transaction that caused the gap, so there is nothing left to
-- remember to re-run.
--
-- VERIFIED before trusting this: inserted a test row with an explicit
-- task_number far above the then-current sequence value (rolled back
-- after), confirmed last_value moved to match, then inserted a normal
-- default-generated row and confirmed no collision. The test's own
-- setval was non-transactional and survived the rollback (Postgres
-- sequence behavior, expected) -- reset back to the real max(task_number)
-- afterward so this migration does not leave a gap of its own.
create or replace function public.sync_master_task_number_seq()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_num int;
  v_current bigint;
begin
  v_num := nullif(regexp_replace(new.task_number, '\D', '', 'g'), '')::int;
  if v_num is not null then
    select last_value into v_current from master_task_number_seq;
    if v_num > v_current then
      perform setval('master_task_number_seq', v_num);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_master_task_number_seq on public.master_tasks;
create trigger trg_sync_master_task_number_seq
after insert on public.master_tasks
for each row
execute function public.sync_master_task_number_seq();

comment on function public.sync_master_task_number_seq() is
  'Keeps master_task_number_seq caught up to the real max(task_number) after every insert, including ones that supply an explicit task_number and bypass the column default. Fixes the drift class Racquel found live (sequence 1,301 behind), permanently rather than by re-running setval.';
