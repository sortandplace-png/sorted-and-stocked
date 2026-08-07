-- 221_v_calendar_horizon_repointed_to_computed_feed.sql
-- SS-809. Applied live 6 Aug 2026.
--
-- Racquel's ruling: point v_calendar_horizon at the new computed source,
-- don't retire it (R21 -- this is not authority to remove yom_tov_dates
-- or the monthly cron, both stay in place).
--
-- The view previously counted rows in yom_tov_dates. Now that nothing
-- reads that table (migration 220 rewired all three consumers to
-- public.jewish_calendar_dates), "443 days of runway" measured nothing
-- real -- it was the trailing edge of the 18-month rolling window the
-- monthly cron maintains, so it would sit near that number permanently
-- and never warn about anything that could actually happen.
--
-- The only real failure mode left is the computed feed itself breaking
-- (a bug in the arithmetic, the function being dropped, etc.), which a
-- row count can never detect. So the gauge changes meaning from "how
-- much runway is left" to "does the computed calendar still answer" --
-- tested by calling jewish_calendar_dates over a window far enough out
-- (current_date + 5 to + 6 years) that no plausible rolling-window
-- maintenance job could be the reason it comes back empty. OK when that
-- window returns rows; CRITICAL when it returns none. No WARNING/EXPIRED
-- tiers -- a computed source either still answers or it is broken, there
-- is no "running low."
--
-- Column names and count unchanged so nothing downstream breaks.
create or replace view public.v_calendar_horizon as
select
  (select max(date) from public.jewish_calendar_dates((current_date + interval '5 years')::date, (current_date + interval '6 years')::date)) as last_known_date,
  (select max(date) from public.jewish_calendar_dates((current_date + interval '5 years')::date, (current_date + interval '6 years')::date)) - current_date as days_of_runway,
  (select count(*) from public.jewish_calendar_dates((current_date + interval '5 years')::date, (current_date + interval '6 years')::date)) as rows_in_table,
  (select count(*) from public.jewish_calendar_dates((current_date + interval '5 years')::date, (current_date + interval '6 years')::date)
     where date >= current_date) as future_rows,
  (select count(*) from tip_trigger_rules where rule_kind = any (array['yomtov_match','omer'])) as dependent_rules,
  (select count(*) from dashboard_tips dt join tip_trigger_rules r on r.trigger_type = dt.trigger_type
     where r.rule_kind = any (array['yomtov_match','omer'])) as dependent_tips,
  case
    when (select count(*) from public.jewish_calendar_dates((current_date + interval '5 years')::date, (current_date + interval '6 years')::date)) = 0
      then 'CRITICAL'
    else 'OK'
  end as status,
  'SS-200/SS-809. yom_tov_dates is superseded (migration 220); nothing reads it any more, so counting its rows measured nothing real. This view now calls public.jewish_calendar_dates() over a window 5-6 years out and checks that the computed calendar still answers. CRITICAL means the computed source itself is broken -- a real, actionable failure, not a rolling window running low.' as note;

comment on view public.v_calendar_horizon is
  'SS-809. Repointed from counting yom_tov_dates rows to calling public.jewish_calendar_dates() directly. Tests that the COMPUTED calendar still answers, not how much of a hand-maintained table is left -- that table is superseded (see migration 220) and this view no longer reads it.';
