-- 128_maintenance_recurrence.sql
--
-- !! NOT YET APPLIED -- FOR REVIEW. !!
-- Household maintenance schedules: the missing long-interval frequencies,
-- plus the two recurrence shapes interval_days genuinely cannot express.
--
-- CORRECTION TO THE BRIEF, verified against live data before writing this.
-- `frequencies` already holds 13 rows, not 2. The "only daily and weekly"
-- reading is true of which frequencies master_tasks currently *references*
-- (daily x61, weekly x1, every other code x0) -- not of the table's contents.
-- So most of the requested list already exists and is NOT re-added here:
--   monthly (30)      -- already exists
--   quarterly (90)    -- already exists
--   annual (365)      -- already exists, coded `yearly`
--   seasonal          -- already exists (see the seasonal note below)
--   before Pesach     -- already exists, coded `pre_pesach`
-- Only four interval frequencies were genuinely absent, and only those are
-- inserted. Everything is ON CONFLICT (code) DO NOTHING against the existing
-- UNIQUE (code) constraint, so re-running is a no-op and nothing already in
-- use is disturbed.

-- 1. The four genuinely-missing interval frequencies. Bilingual at creation,
-- matching the existing label_en/label_es pattern (the v_master_tasks view
-- surfaces these as frequency_en/frequency_es). sort_order values slot into
-- the existing gaps by duration rather than renumbering rows already in use.
insert into frequencies (code, label_en, label_es, interval_days, sort_order) values
  ('bimonthly',     'Every two months',   'Cada dos meses',       60,   55),
  ('semiannual',    'Twice a year',       'Dos veces al año',     180,  75),
  ('biennial',      'Every two years',    'Cada dos años',        730,  82),
  ('multiyear_3_5', 'Every 3-5 years',    'Cada 3 a 5 años',      1275, 84)
on conflict (code) do nothing;

-- 2. Make the recurrence shape explicit instead of inferred.
-- Today "interval_days IS NULL" conflates three unrelated things:
-- pre_pesach (Hebrew-calendar anchored), as_needed and on_request (no
-- schedule at all). Anything computing a next-due date has no way to tell
-- them apart. recurrence_kind states it.
alter table frequencies
  add column if not exists recurrence_kind text not null default 'interval';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'frequencies_recurrence_kind_check'
  ) then
    alter table frequencies add constraint frequencies_recurrence_kind_check
      check (recurrence_kind in ('interval', 'seasonal', 'hebrew', 'manual'));
  end if;
end $$;

-- Backfill the existing 13 rows to their real shape. erev_shabbos keeps
-- interval_days = 7 but is genuinely Hebrew-anchored (it tracks Shabbos, not
-- a rolling 7-day counter from an arbitrary start date).
update frequencies set recurrence_kind = 'hebrew'
  where code in ('erev_shabbos', 'pre_yom_tov', 'pre_pesach');
update frequencies set recurrence_kind = 'manual'
  where code in ('as_needed', 'on_request');
update frequencies set recurrence_kind = 'seasonal'
  where code = 'seasonal';

-- 3. The Hebrew-calendar anchors that did not exist yet. interval_days stays
-- NULL on purpose: these are computed live from Hebcal at read time via
-- lib/calendar-trigger-type.ts (the same integration already powering the
-- Omer and Rosh Chodesh triggers), never stored as a date table -- Hebrew
-- dates drift against the Gregorian calendar every year, so any stored table
-- is wrong by construction the following year.
insert into frequencies (code, label_en, label_es, interval_days, sort_order, recurrence_kind) values
  ('elul',        'During Elul',      'Durante Elul',          null, 112, 'hebrew'),
  ('post_sukkos', 'After Sukkos',     'Después de Sucot',      null, 114, 'hebrew'),
  ('kislev',      'During Kislev',    'Durante Kislev',        null, 116, 'hebrew'),
  ('adar',        'During Adar',      'Durante Adar',          null, 118, 'hebrew')
on conflict (code) do nothing;

-- 4. Seasonal month window, per task rather than per frequency.
-- `seasonal` already existed with interval_days = 120, which is a rolling
-- 120-day counter -- that is not a season. A season is a fixed Gregorian
-- window and it differs per task ("Spring, Mar-Apr" for one, "Fall, Sep-Oct"
-- for another), so the window belongs on master_tasks, not on the shared
-- frequency row. interval_days is left as-is on that row so nothing that
-- currently reads it breaks; recurrence_kind = 'seasonal' is the signal to
-- prefer the month window.
-- Wrap-around windows are intentionally supported (e.g. Nov->Feb, start 11
-- end 2); consumers must not assume start <= end.
alter table master_tasks
  add column if not exists season_start_month smallint,
  add column if not exists season_end_month smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'master_tasks_season_months_check'
  ) then
    alter table master_tasks add constraint master_tasks_season_months_check
      check (
        (season_start_month is null and season_end_month is null)
        or (season_start_month between 1 and 12 and season_end_month between 1 and 12)
      );
  end if;
end $$;

comment on column master_tasks.season_start_month is
  'Gregorian month (1-12) a seasonal task opens. Paired with season_end_month; both null for non-seasonal tasks. Wrap-around (start > end) is valid, e.g. 11->2.';
comment on column master_tasks.season_end_month is
  'Gregorian month (1-12) a seasonal task closes. See season_start_month.';
comment on column frequencies.recurrence_kind is
  'How the next occurrence is derived: interval (interval_days), seasonal (master_tasks.season_start_month/season_end_month), hebrew (computed live from Hebcal, never stored), manual (no schedule).';
