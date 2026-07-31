-- 148_reconcile_rooms_low_lax.sql
-- Reconciles rooms created live by direct SQL on 30-31 Jul, not a migration
-- (same reasoning as 138/145/147): 30 rooms on Low (batches at 02:26 and
-- 02:29 UTC) and 2 on Lax (Pesach Kitchen, Gym at 02:23 UTC). Row data is
-- captured verbatim from the live database -- ids included -- so this is a
-- no-op there and a faithful replay anywhere else.
--
-- Low's Kitchen (created 16:18 UTC via the in-app room form, the first room
-- ever created through the UI) is deliberately NOT here: app writes are not
-- migrations.
--
-- FLOORS, so nobody "fixes" what follows:
--   * Low was built WITH floors (Main Floor / Upstairs / Basement) because
--     Racquel described an upstairs and a basement. Hallway & Stairs and
--     Whole House have floor = NULL because they belong to no single floor.
--   * Lax has NO floors. Racquel decided this on 30 Jul (SS-420, resolved):
--     all Lax rooms stay floor = NULL deliberately, and Lax rendering no
--     floor tabs is correct, not a defect. Do not backfill.

insert into rooms (id, property_id, name_en, name_es, sort_order, active, created_at, floor) values
  -- Lax (property a85471e6): no floors, by decision
  ('06f1eace-0e2b-407f-a418-f6716c8f1ff9', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'Pesach Kitchen', 'Cocina Pesach', '20', 't', '2026-07-31 02:23:50.231184+00', NULL),
  ('63461972-769c-440a-b920-059dadbddb58', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'Gym', 'Gimnasio', '21', 't', '2026-07-31 02:23:50.231184+00', NULL),
  -- Low (property 3389f7cb): floors deliberate
  ('1bd71f86-bfa9-4ece-ba66-e9e242619ae1', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Living Room', 'Sala', '11', 't', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('9fd471a0-9d08-49b9-9334-dd5e31e0b512', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Dining Room', 'Comedor', '12', 't', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('8ae7da24-6b81-441b-907d-97307f6519d1', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Entry / Foyer', 'Entrada / Vestíbulo', '13', 't', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('93aa6c1f-77b1-4b6a-9865-0b7bbb13a41c', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Powder Room', 'Medio Baño', '14', 't', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('e980d489-1bc4-49e1-89b3-1106cad20077', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Laundry Room', 'Lavandería', '15', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('419b7116-151e-43f2-b50e-49dcb4208b5f', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Office / Study', 'Oficina / Estudio', '16', 't', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('30ad72d0-3e91-4e19-9acc-4081eca07170', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Playroom', 'Sala de Juegos', '17', 't', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('eb8518a2-a3c8-4185-b1b1-6d03767f48ff', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Pesach Kitchen', 'Cocina Pesach', '18', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('73682287-9495-40e9-b6c2-a2d78a6f8905', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Garage', 'Garaje', '19', 'f', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('3dddd43d-9c8d-4ed3-9f6b-69645de345e6', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Porch', 'Porche', '20', 'f', '2026-07-31 02:26:36.204897+00', 'Main Floor'),
  ('b5b5f197-1229-4237-8d44-8bc2d4bf9c0f', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Master Bedroom', 'Dormitorio Principal', '21', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('e26a6ad3-715f-4621-ae90-dfc06afb6024', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Master Bath', 'Baño Principal', '22', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('5db0ef66-474c-4179-ab49-05dbe921a7e7', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Girl Bedroom', 'Dormitorio de Niña', '23', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('43b01ec2-3c10-45f0-9d79-5fd0619f0b6d', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Girl Bedroom Ensuite Bath', 'Baño de la Niña', '24', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('7934f0cc-e970-4b6b-9490-5115f84e96a9', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Bedroom 2', 'Dormitorio 2', '25', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('aeeec6d1-c306-45af-8cb4-2f8b56071181', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Bedroom 3', 'Dormitorio 3', '26', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('9c00463c-eb33-4fe2-8da8-d760d06c6edb', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Baby Room', 'Cuarto del Bebé', '27', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('07366ec3-5c77-4182-b148-58098192a05c', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Guest Room 1', 'Habitación de Huéspedes 1', '28', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('c2d3357d-f65f-4dd7-8c94-97bbab22193b', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Guest Room 2', 'Habitación de Huéspedes 2', '29', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('1babe90b-80ae-41d7-ad73-7907bdfd22a2', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Hall Bath', 'Baño del Pasillo', '30', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('75dca552-090d-45d7-acd1-27f506c13805', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Upstairs Storage', 'Almacén de Arriba', '31', 't', '2026-07-31 02:26:36.204897+00', 'Upstairs'),
  ('2130aef7-3550-4864-89a8-94c8e96cf5db', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Basement', 'Sótano', '32', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('e32fef67-fe82-4d81-a0d4-8aaa593a24e2', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Basement Bath', 'Baño del Sótano', '33', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('0ce69193-622b-4aee-b654-78bd4707da6a', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Basement Storage', 'Almacén del Sótano', '34', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('d9bdf5f3-dd51-4f09-955b-f83a344021f1', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Basement Playroom', 'Sala de Juegos del Sótano', '35', 't', '2026-07-31 02:26:36.204897+00', 'Basement'),
  ('15003b13-f34e-4a9e-b1dd-d8965c1e3861', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Hallway & Stairs', 'Pasillo y Escaleras', '36', 't', '2026-07-31 02:26:36.204897+00', NULL),
  ('24ba82ec-0b3f-4276-a0ad-fcb7c3a13354', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Whole House', 'Toda la Casa', '37', 't', '2026-07-31 02:26:36.204897+00', NULL),
  ('8539e067-88a5-412b-8971-9cc08c974b7c', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Master Closet', 'Vestidor Principal', '38', 't', '2026-07-31 02:29:14.451394+00', 'Upstairs'),
  ('d85d56b7-f808-4f9d-927c-067fd7f65e73', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Linen Closet', 'Armario de Ropa Blanca', '39', 't', '2026-07-31 02:29:14.451394+00', 'Upstairs'),
  ('9f5d460a-0395-453f-8ef9-d8547044929f', '3389f7cb-2f4f-4752-bc47-44b7b22841f1', 'Towel Closet', 'Armario de Toallas', '40', 't', '2026-07-31 02:29:14.451394+00', 'Upstairs')
on conflict (id) do nothing;
