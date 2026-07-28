-- 133_meal_slots.sql
-- SS-109: add the Jewish-calendar meal slots.
--
-- SMALLER THAN THE TICKET ASSUMED. Verified live before writing:
--
--   meal_plan_entries_meal_slot_check ALREADY allows
--     ('breakfast', 'lunch', 'dinner', 'other')
--
-- So `lunch` is not blocked by the database and never was. All 4,428 rows are
-- 'dinner' because nothing in the UI ever writes anything else -- the gap is
-- in the interface, not the schema. Widening the constraint alone will not
-- produce a single lunch row.
--
-- Likewise the uniqueness requirement in the ticket is already satisfied:
--   meal_plan_entries_unique_slot_course
--     UNIQUE (property_id, plan_date, meal_slot, course, sequence)
-- already keys on meal_slot. No change needed.
--
-- What genuinely does not exist is the four Jewish-calendar slots. That is all
-- this migration adds.
--
-- 'other' is retained rather than dropped (R21) -- removing a permitted value
-- from a CHECK is a delete in everything but name, and nothing has been shown
-- to be unable to use it.

begin;

alter table meal_plan_entries
  drop constraint if exists meal_plan_entries_meal_slot_check;

alter table meal_plan_entries
  add constraint meal_plan_entries_meal_slot_check
  check (meal_slot = any (array[
    'breakfast'::text,
    'lunch'::text,
    'dinner'::text,
    'seudah_shlishit'::text,   -- Shabbos afternoon, third meal
    'melaveh_malka'::text,     -- motzei Shabbos
    'seudah_hamafsekes'::text, -- the meal before a fast
    'break_fast'::text,        -- the meal after a fast ends
    'other'::text
  ]));

-- Existing 4,428 rows stay 'dinner'. They are dinners; there is nothing to
-- infer and no backfill worth guessing at.

commit;
