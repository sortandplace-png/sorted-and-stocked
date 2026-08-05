-- 189_seed_low_staff_slots.sql
-- Low has 225 active master_tasks and ZERO staff_slots, so the Task Center
-- currently offers it no assignment target at all: the slot group in the
-- assign control renders empty and there is nothing to bulk assign a room
-- to. Country, Lax, Main and QA Demo each already have four.
--
-- Four slots, the same shape and the same labels as the existing 16, so
-- Low reads identically to every other house.
--
-- DELIBERATELY NOT SEEDED:
--   Henderson  zero master_tasks, so slots would be four rows nobody can
--              ever assign anything to.
--   QA Demo    already has four, and is a demo property under separate
--              review.
--
-- Idempotent via NOT EXISTS on (property_id, slot_number) rather than ON
-- CONFLICT: there is no unique constraint on that pair to conflict against,
-- so ON CONFLICT would have nothing to key on and would raise.
insert into public.staff_slots (property_id, slot_number, label_en, label_es, active, sort_order)
select v.property_id, v.slot_number, v.label_en, v.label_es, true, v.slot_number
from (values
  ('3389f7cb-2f4f-4752-bc47-44b7b22841f1'::uuid, 1, 'Housekeeper 1', 'Ama de llaves 1'),
  ('3389f7cb-2f4f-4752-bc47-44b7b22841f1'::uuid, 2, 'Housekeeper 2', 'Ama de llaves 2'),
  ('3389f7cb-2f4f-4752-bc47-44b7b22841f1'::uuid, 3, 'Housekeeper 3', 'Ama de llaves 3'),
  ('3389f7cb-2f4f-4752-bc47-44b7b22841f1'::uuid, 4, 'Housekeeper 4', 'Ama de llaves 4')
) as v(property_id, slot_number, label_en, label_es)
where not exists (
  select 1 from public.staff_slots ss
  where ss.property_id = v.property_id
    and ss.slot_number = v.slot_number
);
