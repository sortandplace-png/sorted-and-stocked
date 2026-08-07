-- 224_eastern_today_helper.sql
-- SS-208. Applied live 6 Aug 2026.
--
-- current_date/CURRENT_DATE/now()::date all read the DATABASE SERVER's
-- own time zone (UTC on Supabase), not the household's. Live and
-- reproducing every night from roughly 8pm to midnight Eastern:
-- current_date is already tomorrow while it is still today in Lakewood/
-- Brick, NJ. Every real property today is Eastern (verified live: Main,
-- Low, Country, Lax and Henderson are all NJ/NY zips -- "Henderson NV"
-- in an old code comment was a hypothetical naming example, not live
-- data, checked before this was built rather than assumed).
--
-- ONE HELPER, reused everywhere, per the ruling: an audit that finds 46
-- call sites and patches each one by hand IS the hand-kept enumeration
-- this project keeps failing on elsewhere (yom_tov_dates, the 44-table
-- backup list). A single function is also the only way to fix
-- DEFAULT CURRENT_DATE in a signature at all -- that can't be patched at
-- the call site, only in the function itself.
--
-- Hardcoded to America/New_York for now, matching every real property
-- live today. This function is deliberately the ONE place that would
-- need to change (e.g. to accept a property id and look up a future
-- per-property timezone column) the day a client house genuinely isn't
-- Eastern -- not yet built because no property needs it yet, but this is
-- where it would go.
create or replace function public.eastern_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/New_York')::date
$$;

comment on function public.eastern_today() is
  'SS-208. The household calendar day, not the database server''s own (UTC on Supabase, which runs ~4-5 hours ahead of Eastern every evening). Use this everywhere a function needs "today" -- never bare current_date/CURRENT_DATE/now()::date. Hardcoded to America/New_York: the single point to extend if a future property is genuinely not Eastern.';
