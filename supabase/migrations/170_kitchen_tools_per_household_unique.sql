-- 170_kitchen_tools_per_household_unique.sql
-- SS-422, Racquel's GO (2 Aug eve): kitchen_tools had UNIQUE(name)
-- across the whole table, which made household_id unusable -- two
-- households could not both own a "Stand Mixer". Per-household
-- uniqueness replaces it: duplicates within one household stay
-- impossible (the reason the old constraint was never simply dropped),
-- while different households stop colliding. NULL household_id rows
-- (legacy/global) keep their own uniqueness via a partial index, since
-- Postgres UNIQUE treats NULLs as distinct and would otherwise allow
-- unlimited duplicate global names.
alter table kitchen_tools drop constraint if exists kitchen_tools_name_key;
alter table kitchen_tools add constraint kitchen_tools_household_name_key unique (household_id, name);
create unique index if not exists kitchen_tools_global_name_key on kitchen_tools (name) where household_id is null;
