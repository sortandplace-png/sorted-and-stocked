-- 228_v_calendar_horizon_eastern_today.sql
-- SS-208. Applied live 6 Aug 2026.
--
-- v_calendar_horizon's own current_date references swapped for
-- public.eastern_today() -- everything else about the view (the OK/
-- CRITICAL logic from SS-809) is unchanged.
create or replace view public.v_calendar_horizon as
select
  (select max(date) from public.jewish_calendar_dates((public.eastern_today() + interval '5 years')::date, (public.eastern_today() + interval '6 years')::date)) as last_known_date,
  (select max(date) from public.jewish_calendar_dates((public.eastern_today() + interval '5 years')::date, (public.eastern_today() + interval '6 years')::date)) - public.eastern_today() as days_of_runway,
  (select count(*) from public.jewish_calendar_dates((public.eastern_today() + interval '5 years')::date, (public.eastern_today() + interval '6 years')::date)) as rows_in_table,
  (select count(*) from public.jewish_calendar_dates((public.eastern_today() + interval '5 years')::date, (public.eastern_today() + interval '6 years')::date)
     where date >= public.eastern_today()) as future_rows,
  (select count(*) from tip_trigger_rules where rule_kind = any (array['yomtov_match','omer'])) as dependent_rules,
  (select count(*) from dashboard_tips dt join tip_trigger_rules r on r.trigger_type = dt.trigger_type
     where r.rule_kind = any (array['yomtov_match','omer'])) as dependent_tips,
  case
    when (select count(*) from public.jewish_calendar_dates((public.eastern_today() + interval '5 years')::date, (public.eastern_today() + interval '6 years')::date)) = 0
      then 'CRITICAL'
    else 'OK'
  end as status,
  'SS-200/SS-809/SS-208. yom_tov_dates is superseded (migration 220); nothing reads it any more, so counting its rows measured nothing real. This view calls public.jewish_calendar_dates() over a window 5-6 years out, anchored to eastern_today() rather than the server''s own current_date, and checks that the computed calendar still answers. CRITICAL means the computed source itself is broken -- a real, actionable failure, not a rolling window running low.' as note;

comment on view public.v_calendar_horizon is
  'SS-809/SS-208. Calls public.jewish_calendar_dates() directly, anchored to public.eastern_today() rather than the server''s own current_date. Tests that the COMPUTED calendar still answers, not how much of a hand-maintained table is left.';
