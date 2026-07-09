-- ============================================================================
-- 037: Local Takeout Directory redesign — extra fields
-- ============================================================================
-- No live hours/open-status data source exists in this app, so `hours` is a
-- static free-text note (not a computed open/closed indicator, which would
-- be misleading without real-time data).

alter table public.local_food_directory
  add column if not exists hours text,
  add column if not exists delivery_available boolean,
  add column if not exists rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5));

comment on column public.local_food_directory.hours is
  'Free-text hours note (e.g. "Sun-Thu 11am-9pm, Fri 11am-2pm") — no live hours data source exists, so this is a static note rather than a computed open/closed status.';
comment on column public.local_food_directory.delivery_available is 'Null = unknown, not false.';
comment on column public.local_food_directory.rating is '0-5, one decimal. Null = no rating yet.';
