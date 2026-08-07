-- 022_add_dip_vege_course_values.sql
-- Applied live 6 Jul 2026; repo copy written after the fact (SS-256/SS-796).
--
-- NUMBER COLLISION, DELIBERATELY LEFT AS-IS (R21: never renumber, never
-- delete). A second, unrelated migration also named "022_" exists in
-- supabase_migrations -- 022_split_internal_notes_from_staff_notes,
-- applied 16 days later on 2026-07-22. Postgres orders both correctly by
-- their real timestamp (this one is 20260706140948, the other is
-- 20260722221235), so nothing is broken at the database level. The
-- collision only bites anything that reads or groups migrations by their
-- three-digit prefix as if it were a unique key -- it is not, here.
-- See that file for the same note from its side.

ALTER TABLE recipes DROP CONSTRAINT recipes_course_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_course_check
  CHECK (course = ANY (ARRAY['soup','protein','starch','salad','dessert','kids_platter','dip','vege']));
