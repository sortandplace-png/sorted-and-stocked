-- 220_hebcal_computed_calendar.sql
-- SS-200/SS-798/SS-805 (register numbering varied across sessions;
-- all the same ticket). Applied live 6 Aug 2026.
--
-- yom_tov_dates held 42 hand-built rows ending 2027-10-24. Three
-- functions read it -- check_shabbos_only_scheduling,
-- is_recipe_eligible_for_date, is_tip_trigger_active -- with eleven
-- trigger rules and 90 tips behind the third. On 2027-10-25 every lookup
-- would have returned nothing, silently, no error. Chanukah, Purim and
-- Rosh Chodesh were separately marked 'unresolvable' (SS-599) only
-- because that hand-built table never contained them, blocking 27 tips
-- on Rosh Chodesh alone.
--
-- R1: computed, never a finite table; DB tables for household overrides
-- only. This migration implements the actual Hebrew calendar arithmetic
-- (the same deterministic, closed-form algorithm hebcal.com itself
-- computes from -- Dershowitz & Reingold's molad-based calculation, not
-- an external API call) natively in PL/pgSQL, so every consumer gets a
-- synchronous, zero-network-dependency answer that works for any date,
-- indefinitely.
--
-- VERIFICATION DONE BEFORE THIS WAS TRUSTED (not asserted, checked):
--   - All 42 rows of yom_tov_dates reproduced exactly (date AND name)
--     across both Hebrew years (5787, 5788) by the new function.
--   - Chanukah 2026 (25 Kislev) and Purim 2027 (Adar II 14, a leap year)
--     independently verified against hebcal.com and other public sources
--     via web search -- both matched exactly.
--   - Confirmed working past the old table's 2027-10-24 cutoff, out to
--     2100, with no special-casing required.
--   - Every trigger_type re-tested end to end against real dates
--     (pre_pesach, sukkot, omer, yom_kippur, shabbos, and the three newly
--     resolved: chanukah, purim, rosh_chodesh) after fixing a real bug
--     caught by that regression pass (see the note on is_tip_trigger_
--     active's yomtov_match branch below).

-- ============================================================
-- CORE ARITHMETIC. Hebrew year length, month lengths, and the single
-- Hebrew<->Gregorian date conversion everything else is built on.
-- ============================================================

create or replace function public.hebrew_year_is_leap(hy int) returns boolean language sql immutable as $$
  select ((7 * hy + 1) % 19) < 7
$$;

create or replace function public.hebrew_year_elapsed_days(hy int) returns int language plpgsql immutable as $$
declare
  months_elapsed int; parts_elapsed int; hours_elapsed int; conj_day int; conj_parts int; alt_day int;
begin
  months_elapsed := (235 * ((hy - 1) / 19)) + (12 * ((hy - 1) % 19)) + ((7 * ((hy - 1) % 19) + 1) / 19);
  parts_elapsed := 204 + 793 * (months_elapsed % 1080);
  hours_elapsed := 5 + 12 * months_elapsed + 793 * (months_elapsed / 1080) + (parts_elapsed / 1080);
  conj_day := 1 + 29 * months_elapsed + (hours_elapsed / 24);
  conj_parts := 1080 * (hours_elapsed % 24) + (parts_elapsed % 1080);
  -- Postponement rules (dechiyot): Rosh Hashana never falls such that it
  -- would leave the year in an invalid length or fall on Sun/Wed/Fri.
  if conj_parts >= 19440
     or ((conj_day % 7 = 2) and conj_parts >= 9924 and not public.hebrew_year_is_leap(hy))
     or ((conj_day % 7 = 1) and conj_parts >= 16789 and public.hebrew_year_is_leap(hy - 1))
  then alt_day := conj_day + 1; else alt_day := conj_day; end if;
  if (alt_day % 7) in (0, 3, 5) then alt_day := alt_day + 1; end if;
  return alt_day;
end;
$$;

create or replace function public.hebrew_year_days(hy int) returns int language sql immutable as $$
  select public.hebrew_year_elapsed_days(hy + 1) - public.hebrew_year_elapsed_days(hy)
$$;

create or replace function public.hebrew_months_in_year(hy int) returns int language sql immutable as $$
  select case when public.hebrew_year_is_leap(hy) then 13 else 12 end
$$;

-- Tishrei-indexed month numbering (month 1 = Tishrei, matching the
-- internal convention hebrew_year_elapsed_days is built on). Nisan
-- onward shifts by +1 in a leap year, since Adar II is inserted at
-- position 7.
create or replace function public.hebrew_month_length(hy int, hm int) returns int language plpgsql immutable as $$
declare yd int; base int; leap boolean; nm int;
begin
  leap := public.hebrew_year_is_leap(hy);
  yd := public.hebrew_year_days(hy);
  base := yd - (case when leap then 30 else 0 end);
  if hm = 1 then return 30; end if;                                       -- Tishrei
  if hm = 2 then return case when base = 355 then 30 else 29 end; end if; -- Cheshvan
  if hm = 3 then return case when base = 353 then 29 else 30 end; end if; -- Kislev
  if hm = 4 then return 29; end if;                                       -- Tevet
  if hm = 5 then return 30; end if;                                       -- Shevat
  if hm = 6 then return case when leap then 30 else 29 end; end if;       -- Adar I (leap) / Adar
  if leap and hm = 7 then return 29; end if;                              -- Adar II
  nm := case when leap then hm - 1 else hm end;
  if nm = 7 then return 30; end if;   -- Nisan
  if nm = 8 then return 29; end if;   -- Iyar
  if nm = 9 then return 30; end if;   -- Sivan
  if nm = 10 then return 29; end if;  -- Tammuz
  if nm = 11 then return 30; end if;  -- Av
  if nm = 12 then return 29; end if;  -- Elul
  raise exception 'bad hebrew month % for year %', hm, hy;
end;
$$;

create or replace function public.hebrew_month_name(hy int, hm int) returns text language plpgsql immutable as $$
declare leap boolean := public.hebrew_year_is_leap(hy); nm int;
begin
  if hm = 1 then return 'Tishrei'; end if;
  if hm = 2 then return 'Cheshvan'; end if;
  if hm = 3 then return 'Kislev'; end if;
  if hm = 4 then return 'Tevet'; end if;
  if hm = 5 then return 'Shevat'; end if;
  if hm = 6 then return case when leap then 'Adar I' else 'Adar' end; end if;
  if leap and hm = 7 then return 'Adar II'; end if;
  nm := case when leap then hm - 1 else hm end;
  return case nm when 7 then 'Nisan' when 8 then 'Iyar' when 9 then 'Sivan'
    when 10 then 'Tammuz' when 11 then 'Av' when 12 then 'Elul' end;
end;
$$;

create or replace function public.hebrew_date_to_absolute(hy int, hm int, hd int) returns int language plpgsql immutable as $$
declare total int := 0; m int;
begin
  for m in 1..(hm-1) loop total := total + public.hebrew_month_length(hy, m); end loop;
  return public.hebrew_year_elapsed_days(hy) + total + (hd - 1);
end;
$$;

-- R.D. 1 = date '0001-01-01' (Postgres's own proleptic Gregorian date
-- type). -1373429 was solved empirically against the known Gregorian
-- dates of Rosh Hashana 5787/5788 (2026-09-12 / 2027-10-02), then
-- confirmed against every one of the 42 yom_tov_dates rows plus two
-- externally-verified new dates (Chanukah 2026, Purim 2027) before being
-- trusted for anything live.
create or replace function public.hebrew_date_to_gregorian(hy int, hm int, hd int) returns date language sql immutable as $$
  select (date '0001-01-01' + (public.hebrew_date_to_absolute(hy, hm, hd) - 1373429))::date
$$;

-- ============================================================
-- HOLIDAY DERIVATION. One Hebrew year's worth of named days, computed
-- from a handful of Gregorian anchor dates plus plain date arithmetic --
-- deliberately NOT chasing exact Hebrew dates for every day of a
-- contiguous span (e.g. Chanukah crossing Kislev into Tevet): once one
-- Hebrew date is anchored to a real Gregorian date, everything else in
-- the same contiguous span is just +N days.
-- ============================================================

create or replace function public.hebrew_holidays_for_year(hy int)
returns table(hdate date, holiday_name text, holiday_name_es text)
language plpgsql immutable as $$
declare
  rh1 date; ykippur date; sukkot1 date; pesach1 date; shavuot1 date; chanukah1 date; purim date;
  leap boolean := public.hebrew_year_is_leap(hy);
  months int := public.hebrew_months_in_year(hy);
  nisan_month int := case when leap then 8 else 7 end;
  purim_month int := case when leap then 7 else 6 end;
  hm int;
begin
  rh1 := public.hebrew_date_to_gregorian(hy, 1, 1);
  ykippur := public.hebrew_date_to_gregorian(hy, 1, 10);
  sukkot1 := public.hebrew_date_to_gregorian(hy, 1, 15);
  pesach1 := public.hebrew_date_to_gregorian(hy, nisan_month, 15);
  shavuot1 := public.hebrew_date_to_gregorian(hy, nisan_month + 2, 6);
  chanukah1 := public.hebrew_date_to_gregorian(hy, 3, 25);
  purim := public.hebrew_date_to_gregorian(hy, purim_month, 14);

  return query values
    (rh1 - 1, 'Erev Rosh Hashana', 'Erev Rosh Hashaná'),
    (rh1,     'Rosh Hashana ' || hy::text, 'Rosh Hashaná ' || hy::text),
    (rh1 + 1, 'Rosh Hashana II', 'Rosh Hashaná II'),
    (ykippur - 1, 'Erev Yom Kippur', 'Erev Yom Kipur'),
    (ykippur,     'Yom Kippur', 'Yom Kipur'),
    (sukkot1 - 1, 'Erev Sukkot', 'Erev Sucot'),
    (sukkot1,     'Sukkot I', 'Sucot I'),
    (sukkot1 + 1, 'Sukkot II', 'Sucot II'),
    (sukkot1 + 2, 'Chol Hamoed Sukkot', 'Jol Hamoed Sucot'),
    (sukkot1 + 3, 'Chol Hamoed Sukkot', 'Jol Hamoed Sucot'),
    (sukkot1 + 4, 'Chol Hamoed Sukkot', 'Jol Hamoed Sucot'),
    (sukkot1 + 5, 'Chol Hamoed Sukkot', 'Jol Hamoed Sucot'),
    (sukkot1 + 6, 'Hoshana Rabbah', 'Hoshaná Rabá'),
    (sukkot1 + 7, 'Shmini Atzeret', 'Shminí Atzéret'),
    (sukkot1 + 8, 'Simchat Torah', 'Simjat Torá'),
    (pesach1 - 1, 'Erev Pesach', 'Erev Pésaj'),
    (pesach1,     'Pesach I', 'Pésaj I'),
    (pesach1 + 1, 'Pesach II', 'Pésaj II'),
    (pesach1 + 2, 'Chol Hamoed Pesach', 'Jol Hamoed Pésaj'),
    (pesach1 + 3, 'Chol Hamoed Pesach', 'Jol Hamoed Pésaj'),
    (pesach1 + 4, 'Chol Hamoed Pesach', 'Jol Hamoed Pésaj'),
    (pesach1 + 5, 'Chol Hamoed Pesach', 'Jol Hamoed Pésaj'),
    (pesach1 + 6, 'Pesach VII', 'Pésaj VII'),
    (pesach1 + 7, 'Pesach VIII', 'Pésaj VIII'),
    (shavuot1 - 1, 'Erev Shavuot', 'Erev Shavuot'),
    (shavuot1,     'Shavuot I', 'Shavuot I'),
    (shavuot1 + 1, 'Shavuot II', 'Shavuot II'),
    -- SS-599/SS-200: Chanukah, previously unresolvable.
    (chanukah1,     'Chanukah I', 'Janucá I'),
    (chanukah1 + 1, 'Chanukah II', 'Janucá II'),
    (chanukah1 + 2, 'Chanukah III', 'Janucá III'),
    (chanukah1 + 3, 'Chanukah IV', 'Janucá IV'),
    (chanukah1 + 4, 'Chanukah V', 'Janucá V'),
    (chanukah1 + 5, 'Chanukah VI', 'Janucá VI'),
    (chanukah1 + 6, 'Chanukah VII', 'Janucá VII'),
    (chanukah1 + 7, 'Chanukah VIII', 'Janucá VIII'),
    -- SS-599/SS-200: Purim, previously unresolvable. Adar II in a leap
    -- year (purim_month above), plain Adar otherwise. Purim Katan (Adar I
    -- 14, leap years only) is deliberately NOT emitted as "Purim" -- it
    -- is a minor, non-obligatory observance, and conflating it with the
    -- real date would misfire every yomtov_match rule keyed to 'Purim%'.
    (purim - 1, 'Erev Purim', 'Erev Purim'),
    (purim,     'Purim', 'Purim'),
    (purim + 1, 'Shushan Purim', 'Shushan Purim');

  -- SS-599/SS-200: Rosh Chodesh, previously unresolvable. Months 2..N
  -- (Cheshvan through Elul) -- month 1/Tishrei excluded on purpose, since
  -- Rosh Hashana occupies that role instead of Rosh Chodesh. Two-day
  -- Rosh Chodesh when the PRECEDING month has 30 days; one day otherwise.
  for hm in 2..months loop
    if public.hebrew_month_length(hy, hm - 1) = 30 then
      return query select
        public.hebrew_date_to_gregorian(hy, hm - 1, 30),
        'Rosh Chodesh ' || public.hebrew_month_name(hy, hm),
        'Rosh Jodesh ' || public.hebrew_month_name(hy, hm);
    end if;
    return query select
      public.hebrew_date_to_gregorian(hy, hm, 1),
      'Rosh Chodesh ' || public.hebrew_month_name(hy, hm),
      'Rosh Jodesh ' || public.hebrew_month_name(hy, hm);
  end loop;
end;
$$;

-- ============================================================
-- PUBLIC ENTRY POINT. Computes for every Hebrew year that could overlap
-- [p_from, p_to] (a one-year margin either side covers any Hebrew<->
-- Gregorian correspondence uncertainty), then filters to the exact
-- window. Cheap: a handful of Hebrew years' worth of holidays for any
-- real caller, never an unbounded scan.
-- ============================================================

create or replace function public.jewish_calendar_dates(p_from date, p_to date)
returns table(date date, holiday_name text, holiday_name_es text)
language sql stable as $$
  select h.hdate, h.holiday_name, h.holiday_name_es
  from generate_series(
         extract(year from p_from)::int - 1 + 3761,
         extract(year from p_to)::int + 1 + 3761
       ) as hy
  cross join lateral public.hebrew_holidays_for_year(hy) h
  where h.hdate between p_from and p_to
$$;

-- ============================================================
-- HOUSEHOLD OVERRIDES. Per R1: DB tables hold household-specific
-- deviations ONLY, never the calendar itself. Not how the calendar is
-- populated in bulk -- for the rare case one property's practice differs
-- from the computed default.
-- ============================================================

create table if not exists public.household_calendar_overrides (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  override_date date not null,
  holiday_name text not null,
  holiday_name_es text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists household_calendar_overrides_property_date_idx
  on public.household_calendar_overrides (property_id, override_date);

alter table public.household_calendar_overrides enable row level security;

drop policy if exists household_calendar_overrides_read on public.household_calendar_overrides;
create policy household_calendar_overrides_read on public.household_calendar_overrides
  for select to authenticated
  using (exists (select 1 from property_members pm where pm.property_id = household_calendar_overrides.property_id and pm.user_id = auth.uid()));

drop policy if exists household_calendar_overrides_write on public.household_calendar_overrides;
create policy household_calendar_overrides_write on public.household_calendar_overrides
  for all to authenticated
  using (exists (select 1 from property_members pm where pm.property_id = household_calendar_overrides.property_id and pm.user_id = auth.uid() and pm.role = any(array['owner','manager']::member_role[])))
  with check (exists (select 1 from property_members pm where pm.property_id = household_calendar_overrides.property_id and pm.user_id = auth.uid() and pm.role = any(array['owner','manager']::member_role[])));

comment on table public.household_calendar_overrides is
  'SS-200/R1. Household-specific deviations from the computed Hebrew calendar (jewish_calendar_dates). NOT how the calendar is populated -- the calendar is computed, never stored. This is for the rare case a specific property needs a specific date to read differently.';

-- ============================================================
-- REWIRE THE THREE CONSUMERS off yom_tov_dates.
-- ============================================================

create or replace function public.check_shabbos_only_scheduling()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  recipe_is_shabbos_only BOOLEAN;
  dow INTEGER;
  is_yom_tov BOOLEAN;
BEGIN
  IF NEW.recipe_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT is_shabbos_only INTO recipe_is_shabbos_only FROM recipes WHERE id = NEW.recipe_id;
  IF recipe_is_shabbos_only IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  dow := EXTRACT(DOW FROM NEW.plan_date);
  IF dow IN (5,6) THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.jewish_calendar_dates(NEW.plan_date, NEW.plan_date)) INTO is_yom_tov;
  IF is_yom_tov THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Recipe % is marked Shabbos/Yom Tov only and cannot be scheduled on %, which is a regular weekday.', NEW.recipe_id, NEW.plan_date;
END;
$function$;

create or replace function public.is_recipe_eligible_for_date(p_recipe_id uuid, p_date date, p_property_id uuid)
returns table(eligible boolean, blocking_reasons text[], warnings text[])
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_kosher_type text;
  v_is_pesach boolean;
  v_is_shabbos_only boolean;
  v_is_yom_tov boolean;
  v_dow integer;
  v_is_shabbos boolean;
  v_in_nine_days boolean;
  v_pesach_holiday text;
  v_blocking text[] := '{}';
  v_warnings text[] := '{}';
  v_unconfirmed_ingredient_count integer;
BEGIN
  SELECT kosher_type, is_pesach, is_shabbos_only, is_yom_tov
  INTO v_kosher_type, v_is_pesach, v_is_shabbos_only, v_is_yom_tov
  FROM recipes WHERE id = p_recipe_id;

  v_dow := extract(dow from p_date);
  v_is_shabbos := v_dow IN (5, 6);

  IF v_kosher_type = 'Meat' AND NOT v_is_shabbos THEN
    SELECT EXISTS(SELECT 1 FROM nine_days_windows WHERE p_date BETWEEN start_date AND end_date)
    INTO v_in_nine_days;
    IF v_in_nine_days THEN
      v_blocking := array_append(v_blocking, 'Meat recipe scheduled during the Nine Days on a non-Shabbos weekday.');
    END IF;
  END IF;

  SELECT holiday_name INTO v_pesach_holiday
    FROM public.jewish_calendar_dates(p_date, p_date)
   WHERE holiday_name ILIKE '%pesach%'
   LIMIT 1;
  IF v_pesach_holiday IS NOT NULL AND NOT COALESCE(v_is_pesach, false) THEN
    v_blocking := array_append(v_blocking, format('Date is %s but this recipe is not marked Kosher for Passover.', v_pesach_holiday));
  END IF;

  IF COALESCE(v_is_pesach, false) THEN
    SELECT count(*) INTO v_unconfirmed_ingredient_count
    FROM recipe_ingredients ri
    JOIN inventory_items ii ON ii.id = ri.inventory_item_id
    WHERE ri.recipe_id = p_recipe_id AND ii.pesach_status = 'needs_review';
    IF v_unconfirmed_ingredient_count > 0 THEN
      v_warnings := array_append(v_warnings, format('Recipe is marked Pesach-safe but has %s linked ingredient(s) whose Pesach status is still unconfirmed.', v_unconfirmed_ingredient_count));
    END IF;
  END IF;

  IF COALESCE(v_is_shabbos_only, false) AND NOT v_is_shabbos AND v_pesach_holiday IS NULL THEN
    v_blocking := array_append(v_blocking, 'Recipe is Shabbos-only but this date is a non-Shabbos weekday.');
  END IF;

  RETURN QUERY SELECT (array_length(v_blocking, 1) IS NULL), v_blocking, v_warnings;
END;
$function$;

create or replace function public.is_tip_trigger_active(p_trigger text, p_date date DEFAULT CURRENT_DATE)
returns boolean
language plpgsql
stable
set search_path to 'public'
as $function$
DECLARE
  r         public.tip_trigger_rules%ROWTYPE;
  pat       text;
  hit       boolean := false;
  omer_from date;
  omer_to   date;
BEGIN
  SELECT * INTO r FROM public.tip_trigger_rules WHERE trigger_type = p_trigger;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF r.rule_kind IN ('evergreen','cadence') THEN
    RETURN true;

  ELSIF r.rule_kind = 'unresolvable' THEN
    RETURN false;

  ELSIF r.rule_kind = 'shabbos' THEN
    RETURN EXTRACT(dow FROM p_date) IN (5,6);

  ELSIF r.rule_kind = 'gregorian_months' THEN
    IF r.month_start <= r.month_end THEN
      RETURN EXTRACT(month FROM p_date) BETWEEN r.month_start AND r.month_end;
    ELSE
      RETURN EXTRACT(month FROM p_date) >= r.month_start
          OR EXTRACT(month FROM p_date) <= r.month_end;
    END IF;

  ELSIF r.rule_kind = 'fast_day' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.fast_days f
      WHERE p_date BETWEEN f.date - r.lead_days AND f.date
    );

  ELSIF r.rule_kind = 'nine_days' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.nine_days_windows w
      WHERE p_date BETWEEN w.start_date AND w.end_date
    );

  ELSIF r.rule_kind = 'omer' THEN
    SELECT max(date) INTO omer_from
      FROM public.jewish_calendar_dates(p_date - 90, p_date)
     WHERE holiday_name = 'Pesach II';
    SELECT min(date) INTO omer_to
      FROM public.jewish_calendar_dates(p_date, p_date + 90)
     WHERE holiday_name = 'Shavuot I';
    RETURN omer_from IS NOT NULL AND omer_to IS NOT NULL
       AND p_date BETWEEN omer_from AND omer_to;

  ELSIF r.rule_kind = 'yomtov_match' THEN
    -- p_date BETWEEN y.date - lead_days AND y.date means the HOLIDAY
    -- comes at or after p_date, within lead_days -- so the window to
    -- search is [p_date, p_date + lead_days]. (A backward window was the
    -- first draft and failed a live regression check on pre_pesach
    -- before this was applied -- caught before it shipped, not after.)
    FOREACH pat IN ARRAY string_to_array(coalesce(r.holiday_pattern,''), '|') LOOP
      IF EXISTS (
        SELECT 1 FROM public.jewish_calendar_dates(p_date, p_date + r.lead_days) y
        WHERE y.holiday_name LIKE pat
          AND p_date BETWEEN y.date - r.lead_days AND y.date
      ) THEN
        hit := true;
      END IF;
    END LOOP;
    RETURN hit;
  END IF;

  RETURN false;
END;
$function$;

-- ============================================================
-- The three trigger rules SS-599 marked 'unresolvable'. Now resolvable,
-- via the same yomtov_match mechanism every other festival already uses
-- -- only the data source changed, not the matching logic.
-- ============================================================

update tip_trigger_rules
set rule_kind = 'yomtov_match', holiday_pattern = 'Chanukah%', lead_days = 7
where trigger_type = 'chanukah';

update tip_trigger_rules
set rule_kind = 'yomtov_match', holiday_pattern = 'Purim|Erev Purim|Shushan Purim', lead_days = 30
where trigger_type = 'purim';

update tip_trigger_rules
set rule_kind = 'yomtov_match', holiday_pattern = 'Rosh Chodesh%', lead_days = 1
where trigger_type = 'rosh_chodesh';

-- ============================================================
-- yom_tov_dates is superseded, not dropped (R21).
-- ============================================================

comment on table public.yom_tov_dates is
  'SS-200. SUPERSEDED as the source of truth for check_shabbos_only_scheduling, is_recipe_eligible_for_date and is_tip_trigger_active, all of which now call public.jewish_calendar_dates() (computed, unbounded) instead. Left in place per R21 (never delete) as a historical/audit artifact -- it was hand-populated, ends 2027-10-24, and nothing should be built to depend on it going forward.';
