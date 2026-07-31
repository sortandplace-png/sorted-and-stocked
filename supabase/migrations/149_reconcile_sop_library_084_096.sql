-- 149_reconcile_sop_library_084_096.sql
-- Reconciles 13 SOPs (SOP-084..SOP-096) created live by direct SQL at
-- 02:18 UTC 31 Jul, not a migration (same reasoning as 138/145/147). These
-- back the 13 new Lax master_tasks T-00352..T-00364 (see 150). Row data is
-- captured verbatim from the live database; multi-line step text is kept as
-- real newlines inside the literals. Bilingual EN/ES at creation per R19.
-- default_frequency_id is NULL on all 13: frequency lives on the task, not
-- the SOP, for this batch.

insert into sop_library (id, sop_code, zone_type, zone_type_es, task_en, task_es, sop_en, sop_es, pass_fail_en, pass_fail_es, failures_en, failures_es, default_frequency_id, estimated_minutes, active, created_at, expected_appearance_url, photo_verification) values
  ('d85b9259-9b90-426a-b1e7-5b1929fbc452', 'SOP-084', 'Basement', 'Sótano', 'Basement Steps & Mechanical Area Floor', 'Escaleras Sótano y Área Mecánica', '1. Sweep steps top-to-bottom.
2. Vacuum edges and corners.
3. Mop with damp mop + cleaner.
4. Wipe baseboards at bottom.', '1. Barrer escaleras arriba a abajo.
2. Aspirar bordes y esquinas.
3. Trapear con mopa húmeda + limpiador.
4. Limpiar zócalos inferiores.', 'Steps free of dust and debris top to bottom. Corners and edges clear. Baseboards wiped.', 'Escaleras sin polvo ni residuos. Esquinas y bordes limpios. Zócalos limpios.', 'Dust left in stair corners. Baseboards skipped. Mopping before sweeping, which spreads construction dust.', 'Polvo en esquinas. Zócalos omitidos. Trapear antes de barrer, lo que esparce el polvo.', NULL, '15', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('c731a595-e9c6-4559-b569-e9d5fcaa4069', 'SOP-085', 'Basement', 'Sótano', 'Basement Toaster Oven (Temporary)', 'Horno Tostador Sótano (Temporal)', '1. UNPLUG and let cool completely.
2. Remove crumb tray, shake out, wipe with soapy cloth.
3. Wipe interior and glass door.
4. Wipe exterior. Plug in only when fully dry.', '1. DESENCHUFAR y dejar enfriar por completo.
2. Retirar bandeja de migas, sacudir, limpiar con paño jabonoso.
3. Limpiar interior y puerta de vidrio.
4. Limpiar exterior. Enchufar solo cuando esté seco.', 'Unplugged before starting. Crumb tray empty and clean. Glass clear. Fully dry before plugging in.', 'Desenchufado antes de empezar. Bandeja vacía y limpia. Vidrio transparente. Seco antes de enchufar.', 'Cleaning while plugged in or still hot. Plugging back in while damp. Crumb tray left out.', 'Limpiar enchufado o caliente. Enchufar mojado. Dejar la bandeja afuera.', NULL, '5', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('96e5c261-5aa2-43b9-bc09-c778ffccb0c9', 'SOP-086', 'Basement', 'Sótano', 'Vacuum Under Basement Microwave', 'Aspirar Debajo del Microondas del Sótano', '1. Slide the microwave forward 2-3 inches.
2. Vacuum crumbs underneath with the crevice tool.
3. Wipe the counter underneath.
4. Slide back and wipe the exterior.', '1. Deslizar el microondas 5-7 cm hacia adelante.
2. Aspirar migas debajo con la boquilla estrecha.
3. Limpiar la encimera debajo.
4. Regresar y limpiar el exterior.', 'No crumbs under or behind. Counter wiped. Microwave returned to position and exterior clean.', 'Sin migas debajo ni detrás. Encimera limpia. Microondas en su lugar y exterior limpio.', 'Wiping around it without moving it. Leaving it pulled forward.', 'Limpiar alrededor sin moverlo. Dejarlo fuera de lugar.', NULL, '3', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('c99b8cef-d48e-4684-b1bb-8a95f2a82113', 'SOP-087', 'Kitchen', 'Cocina', 'Pesach Kitchen Dishwasher Front', 'Frente del Lavavajillas de la Cocina Pesach', '1. Spray Windex on the cloth, never directly on the machine.
2. Wipe with the grain, top to bottom.
3. Buff dry with a second dry cloth.
4. Check the handle for prints.', '1. Rociar Windex en el paño, nunca directo en la máquina.
2. Limpiar con la veta, de arriba a abajo.
3. Pulir en seco con un segundo paño.
4. Revisar la manija por huellas.', 'No streaks. Wiped with the grain. Handle free of prints. Two cloths used, one damp one dry.', 'Sin marcas. Limpiado con la veta. Manija sin huellas. Dos paños, uno húmedo y uno seco.', 'Spraying directly on stainless, which streaks and runs into seams. Wiping against the grain. Using one cloth.', 'Rociar directo en el acero, que deja marcas. Limpiar contra la veta. Usar un solo paño.', NULL, '2', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('afa39d73-06cc-4b38-a770-1d0910371ba1', 'SOP-088', 'Basement', 'Sótano', 'Basement Fridge Door Front', 'Puerta de la Heladera del Sótano', '1. Spray on the cloth.
2. Wipe the entire front, handle and sides.
3. Buff dry. Use a warm soapy cloth for sticky spots.', '1. Rociar en el paño.
2. Limpiar todo el frente, manija y lados.
3. Pulir en seco. Usar paño jabonoso tibio para lo pegajoso.', 'Front, handle and sides clean and streak-free.', 'Frente, manija y lados limpios y sin marcas.', 'Handle skipped. Sticky spots smeared rather than lifted.', 'Manija omitida. Manchas pegajosas esparcidas en vez de retiradas.', NULL, '2', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('89a7cc81-bf82-44ec-bdb9-a7297d283f30', 'SOP-089', 'Outdoor', 'Exterior', 'Front Outdoor Steps — Spill Removal', 'Escalones Exteriores — Retirar Derrames', '1. Sweep loose dirt.
2. Scrub the dried spill with a soapy stiff brush.
3. Rinse with clean water or a hose.
4. Air dry and check for stickiness.', '1. Barrer tierra suelta.
2. Fregar el derrame seco con cepillo duro jabonoso.
3. Enjuagar con agua limpia o manguera.
4. Secar al aire y revisar pegajosidad.', 'No residue and no stickiness underfoot once dry.', 'Sin residuo ni pegajosidad al secarse.', 'Rinsing without scrubbing first. Leaving it wet so dirt sticks again.', 'Enjuagar sin fregar primero. Dejarlo mojado para que se pegue la tierra otra vez.', NULL, '10', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('92982d5a-f6df-45d3-92ea-987acfe3ba5a', 'SOP-090', 'Gym', 'Gimnasio', 'Basement Gym Floor & Mat', 'Piso y Colchoneta del Gimnasio del Sótano', '1. Pick up wrappers, vacuum the floor and mat.
2. Spray disinfectant and wipe food stains.
3. Use a Magic Eraser gently on scuffs.
4. Straighten the mat.', '1. Recoger envoltorios, aspirar el piso y la colchoneta.
2. Rociar desinfectante y limpiar manchas de comida.
3. Usar borrador mágico suave en las marcas.
4. Acomodar la colchoneta.', 'Mat clean, disinfected and lying straight. Floor free of wrappers and crumbs.', 'Colchoneta limpia, desinfectada y derecha. Piso sin envoltorios ni migas.', 'Harsh cleaner on the mat surface. Scrubbing scuffs hard enough to mark the mat. Mat left crooked.', 'Limpiador fuerte en la colchoneta. Frotar tan fuerte que marca. Colchoneta torcida.', NULL, '10', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('f4e792af-fb9f-4e12-9092-2146ac7ed871', 'SOP-091', 'Bedroom', 'Dormitorio', 'Master Closet Full-Length Mirror', 'Espejo de Cuerpo Entero del Vestidor', '1. Spray Windex lightly.
2. Wipe in an S-pattern, top to bottom.
3. Buff the edges where dust collects.', '1. Rociar Windex ligeramente.
2. Limpiar en patrón S, de arriba a abajo.
3. Pulir los bordes donde se junta polvo.', 'No streaks in any light. Edges and corners clear.', 'Sin marcas con ninguna luz. Bordes y esquinas limpios.', 'Circular wiping, which leaves swirl marks. Edges skipped. Over-spraying so it runs into the frame.', 'Limpiar en círculos, que deja marcas. Omitir bordes. Rociar de más y que escurra al marco.', NULL, '3', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('1d610919-3a40-4bb7-8847-d0b1b4fecf89', 'SOP-092', 'Bathroom', 'Baño', 'Bathroom Exhaust Vent Cover', 'Tapa de Ventilación del Baño', '1. Turn off the vent fan and set the step stool safely.
2. Vacuum the vent cover with the brush attachment.
3. Wipe the slats with a damp soapy cloth.
4. Dry, then turn the fan back on.', '1. Apagar el extractor y colocar el banquito de forma segura.
2. Aspirar la tapa con el cepillo.
3. Limpiar las rejillas con paño húmedo jabonoso.
4. Secar y encender el extractor.', 'Slats free of lint and dust. Fan running normally afterwards.', 'Rejillas sin pelusa ni polvo. Extractor funcionando normal después.', 'Cleaning with the fan running, which pulls dust further in. Standing on the tub edge instead of a stool.', 'Limpiar con el extractor encendido, que mete más polvo. Pararse en el borde de la tina en vez del banquito.', NULL, '5', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('fd175816-ab88-4e07-bd80-afc2368def9a', 'SOP-093', 'Bathroom', 'Baño', 'Bathroom Walls & Ceiling — Scuff Removal', 'Paredes y Techo del Baño — Quitar Marcas', '1. Dip the eraser in water and squeeze it out.
2. Dab marked areas lightly. Do not scrub hard on flat paint.
3. Wipe dry with a towel.
4. STOP if any paint lifts.', '1. Sumergir el borrador en agua y escurrir.
2. Frotar suave las marcas. No frotar fuerte en pintura mate.
3. Secar con toalla.
4. PARAR si sale pintura.', 'Scuffs lifted with no change to the paint finish. Tested in a hidden spot first.', 'Marcas quitadas sin cambiar el acabado. Probado antes en un lugar oculto.', 'Scrubbing flat paint, which burnishes a shiny patch worse than the original mark. Skipping the spot test.', 'Frotar pintura mate, que deja un brillo peor que la marca. Omitir la prueba.', NULL, '10', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('01d3d282-21e5-404f-86eb-95c7f7d935d1', 'SOP-094', 'Bathroom', 'Baño', 'Overhead Shower Head Top Ledge', 'Parte Superior del Cabezal de Ducha', '1. Make sure the shower is dry and set the stool.
2. Dust the top of the overhead fixture.
3. Wipe with a damp cloth, then dry.
4. Check for limescale and report if heavy.', '1. Asegurar que la ducha esté seca y colocar el banquito.
2. Quitar el polvo de la parte superior del cabezal.
3. Limpiar con paño húmedo y secar.
4. Revisar la cal y reportar si hay mucha.', 'Top surface free of dust. Limescale reported rather than scraped.', 'Superficie superior sin polvo. Cal reportada, no raspada.', 'Standing in a wet shower. Scraping limescale, which damages the finish. Skipping the top because it is not visible.', 'Pararse en ducha mojada. Raspar la cal, que daña el acabado. Omitir la parte de arriba por no verse.', NULL, '2', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('6dcd4b79-cf37-4896-8edb-07925a0c0431', 'SOP-095', 'Bedroom', 'Dormitorio', 'Desk Interior Reset', 'Reinicio del Interior del Escritorio', '1. Take everything out.
2. Vacuum crumbs and dust inside.
3. Wipe interior surfaces with a damp cloth, then dry.
4. Put everything back neatly organised.', '1. Sacar todo.
2. Aspirar migas y polvo del interior.
3. Limpiar superficies interiores con paño húmedo y secar.
4. Colocar todo ordenado.', 'Drawers empty of debris, wiped and dry. Contents returned in order, not piled.', 'Cajones sin residuos, limpios y secos. Contenido ordenado, no amontonado.', 'Wiping around the contents instead of emptying. Returning items damp. Putting things back unsorted.', 'Limpiar alrededor sin vaciar. Devolver cosas mojadas. Guardar sin ordenar.', NULL, '15', 't', '2026-07-31 02:18:57.571829+00', NULL, 't'),
  ('9767b572-3bea-45f7-9fec-5c3c04fbd0f4', 'SOP-096', 'Bedroom', 'Dormitorio', 'Wall Behind Moved Furniture', 'Pared Detrás de Muebles Movidos', '1. Move the furniture slightly to reach the wall.
2. Spot test the eraser in a corner.
3. Gently erase scuffs on the newly exposed area.
4. Wipe dry and push the furniture back.', '1. Mover el mueble un poco para alcanzar la pared.
2. Probar el borrador en una esquina.
3. Borrar suave las marcas del área expuesta.
4. Secar y regresar el mueble.', 'Newly exposed wall matches the surrounding paint. Furniture returned to position.', 'La pared expuesta se ve igual que el resto. Mueble en su lugar.', 'Skipping the spot test. Scrubbing so the cleaned patch looks brighter than the rest of the wall.', 'Omitir la prueba. Frotar tanto que el área queda más clara que el resto.', NULL, '10', 't', '2026-07-31 02:18:57.571829+00', NULL, 't')
on conflict (id) do nothing;
