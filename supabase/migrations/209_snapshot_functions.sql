-- 209_snapshot_functions.sql
-- SS-092. Applied live 6 Aug 2026; repo copy written after the fact.
--
-- Two functions, driven by cron at 03:15 and 03:30 UTC:
--   capture_table_census()      cheap count of 13 watched tables, flags drops
--   capture_table_snapshot(t)   full jsonb copy of one table, 30 day window
--
-- The census is what NOTICES; the snapshot is what RESTORES. SS-001 lost
-- 240 inventory rows and had neither.

create or replace function public.capture_table_census()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  c bigint;
  prev bigint;
  d bigint;
  -- Watched list is a literal rather than a table because this must keep
  -- working when the thing that broke is a table.
  watched text[] := array[
    'inventory_items','master_tasks','recipes','recipe_ingredients',
    'rooms','properties','work_items','sop_library','blog_posts',
    'meal_plans','shopping_list_items','household_knowledge','training_videos'
  ];
begin
  foreach t in array watched loop
    -- A watched table that does not exist is skipped, not an error: one
    -- renamed table must not stop the census for the other twelve.
    if to_regclass('public.'||t) is null then
      continue;
    end if;
    execute format('select count(*) from public.%I', t) into c;
    select row_count into prev
      from public.table_row_counts
      where table_name = t
      order by captured_at desc
      limit 1;
    d := case when prev is null then null else c - prev end;
    insert into public.table_row_counts (table_name, row_count, delta_since_previous, alert, note)
    values (
      t, c, d,
      -- Two thresholds, not one: 10 rows catches a small table losing a
      -- meaningful slice, 5 percent catches a large one where 10 rows is
      -- noise. SS-001's 240 rows trips both.
      coalesce(d, 0) <= -10 or (prev is not null and prev > 0 and c < prev * 0.95),
      case
        when d is null then 'first census'
        when d <= -10 then 'DROP of '||abs(d)||' rows since previous census'
        when prev > 0 and c < prev * 0.95 then 'row count fell more than 5 percent'
        else null
      end
    );
  end loop;
end;
$$;

create or replace function public.capture_table_snapshot(p_table text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  c bigint;
begin
  if to_regclass('public.'||p_table) is null then
    raise exception 'unknown table %', p_table;
  end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb), count(*) from public.%I t', p_table)
    into payload, c;
  insert into public.table_snapshots (table_name, row_count, payload)
  values (p_table, c, payload);
  -- Pruned in the same call that writes, so retention cannot drift by
  -- someone forgetting to schedule a separate cleanup job.
  delete from public.table_snapshots
   where table_name = p_table
     and captured_at < now() - interval '30 days';
  return c;
end;
$$;

-- security definer + revoke: these read every row of the watched tables,
-- so they must be reachable only by the cron/service role.
revoke all on function public.capture_table_census() from anon, authenticated;
revoke all on function public.capture_table_snapshot(text) from anon, authenticated;
