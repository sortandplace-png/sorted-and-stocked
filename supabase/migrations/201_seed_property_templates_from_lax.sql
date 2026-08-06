-- 201_seed_property_templates_from_lax.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.
--
-- THE MODULE SET IS BYTE IDENTICAL BETWEEN THE TWO ROWS. Observance is
-- carried entirely by calendar_layers and tip_sets. There is no such thing
-- as a Jewish module, and operator_console never travels into a template.

insert into public.property_templates
(template_key, label_en, label_es, description_en, description_es,
 feature_flags, calendar_layers, tip_sets, default_retailer,
 default_bedrooms, default_bathrooms, derived_from, sort_order, notes)
values
(
 'observant_household',
 'Observant Household',
 'Hogar Observante',
 'Full feature set with the Jewish calendar layer on. Shabbos and Yom Tov rendering, candle lighting, fast days and Omer all appear. Kashrut tagging is active across inventory and recipes.',
 'Conjunto completo de funciones con la capa del calendario judio activada. Shabbos y Yom Tov, encendido de velas, dias de ayuno y Omer aparecen todos. El etiquetado de kashrut esta activo en inventario y recetas.',
 '{"module_staff":true,"module_tools":true,"module_recipes":true,"module_handover":true,"module_shopping":true,"module_inventory":true,"module_meal_plan":true}'::jsonb,
 array['jewish','civil'],
 array['universal','jewish'],
 'amazon',
 3, 2.5,
 'Lax',
 10,
 'Derived from Lax, the master property. operator_console is deliberately excluded: it belongs to Lax alone and is never part of a template.'
),
(
 'non_observant_household',
 'Non Observant Household',
 'Hogar No Observante',
 'The same full feature set with the civil calendar only. No Shabbos or Yom Tov rendering, no candle lighting, no fast days. Allergen and dietary tagging remain active because they are universal.',
 'El mismo conjunto completo de funciones con solo el calendario civil. Sin Shabbos ni Yom Tov, sin encendido de velas, sin dias de ayuno. El etiquetado de alergenos y dietas permanece activo porque es universal.',
 '{"module_staff":true,"module_tools":true,"module_recipes":true,"module_handover":true,"module_shopping":true,"module_inventory":true,"module_meal_plan":true}'::jsonb,
 array['civil'],
 array['universal'],
 'walmart',
 3, 2.5,
 'Lax',
 20,
 'Module set is byte identical to the observant template. The only differences are calendar_layers, tip_sets and default_retailer. There is no such thing as a Jewish module.'
);
