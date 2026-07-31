-- 163_recipe_new_badge.sql
-- SS-450 (O), GO ruling 31 Jul: NEW badge on the 6-July batch.
--
-- new_badge_until: the badge shows while current_date <= it, so it
-- expires by itself -- no cleanup pass, and nothing pollutes the
-- user-facing tags array. Any future batch gets the same treatment by
-- setting a date; clearing is setting it null (nothing deleted, R21).
--
-- The batch is precisely addressable: 6 July has 207 recipes in three
-- waves, and the ruled "~50-recipe batch" is the single 50-row insert at
-- 16:51:59.329387 UTC, all on Main -- matched by exact created_at below
-- (one bulk INSERT = one shared timestamp), not by date, so the other
-- 157 recipes that day stay untouched.

alter table recipes add column new_badge_until date;

comment on column recipes.new_badge_until is
  'SS-450: show the NEW! / ¡NUEVO! badge while current_date <= this. Null or past = no badge. Self-expiring.';

update recipes
set new_badge_until = date '2026-08-31'
where created_at = timestamptz '2026-07-06 16:51:59.329387+00';
