-- 229_security_advisor_findings_219_to_228.sql
-- Applied live 6 Aug 2026. Security advisor run after migrations
-- 219-228; three findings, all introduced by that batch, fixed via
-- lightweight ALTER -- no function/view body redefined, only metadata
-- changed, so none of the verified behavior from those migrations is
-- at risk of a copy-paste regression.

-- ERROR: v_calendar_horizon, v_low_stock_combined and v_master_tasks
-- were all SECURITY DEFINER views (Postgres's default when unset) --
-- each runs with its OWNER's privileges, not the querying user's, which
-- can bypass RLS on the underlying property-scoped tables entirely.
-- Same defect SS-606 already fixed on v_low_stock_summary, reintroduced
-- by this batch.
alter view public.v_calendar_horizon set (security_invoker = true);
alter view public.v_low_stock_combined set (security_invoker = true);
alter view public.v_master_tasks set (security_invoker = true);

-- WARN: every function migrations 220/224 introduced had a mutable
-- search_path -- migrations 048-053 already hardened everything else in
-- this project against exactly this class of issue and these were
-- simply missed at the time.
alter function public.eastern_today() set search_path = public;
alter function public.jewish_calendar_dates(date, date) set search_path = public;
alter function public.hebrew_holidays_for_year(int) set search_path = public;
alter function public.hebrew_year_is_leap(int) set search_path = public;
alter function public.hebrew_year_elapsed_days(int) set search_path = public;
alter function public.hebrew_year_days(int) set search_path = public;
alter function public.hebrew_months_in_year(int) set search_path = public;
alter function public.hebrew_month_length(int, int) set search_path = public;
alter function public.hebrew_month_name(int, int) set search_path = public;
alter function public.hebrew_date_to_absolute(int, int, int) set search_path = public;
alter function public.hebrew_date_to_gregorian(int, int, int) set search_path = public;

-- WARN: guard_archiving_last_reachable_property is a SECURITY DEFINER
-- trigger function, never meant to be called directly -- but PostgREST
-- exposes any function with EXECUTE granted to PUBLIC as an RPC
-- regardless of intent, and this one was missed when the others
-- (list_property_scoped_tables, sop_visible_to_property, etc.) were
-- already revoked in their own migrations.
revoke all on function public.guard_archiving_last_reachable_property() from public, anon, authenticated;
