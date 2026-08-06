-- 199_blog_rules_and_free_printable_rows.sql
--
-- blog_rules: rules live in the DATABASE, never in the codebase. The day
-- someone hardcodes a rule is the day the generator starts producing last
-- quarter's blog. Changing a rule is changing a ROW.
create table if not exists public.blog_rules (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  rule_key text not null unique,
  rule_text text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

alter table public.blog_rules enable row level security;

drop policy if exists blog_rules_read_operator on public.blog_rules;
create policy blog_rules_read_operator
  on public.blog_rules for select to authenticated
  using (
    exists (
      select 1 from public.property_members pm
      join public.properties p on p.id = pm.property_id
      where pm.user_id = auth.uid()
        and pm.role = any (array['owner'::member_role, 'manager'::member_role])
        and ((p.feature_flags ->> 'operator_console')::boolean) is true
    )
  );

-- THE THIRD OCCURRENCE RULE. This defect has now shipped on three separate
-- sheets, so it stops being a note and becomes a rule.
insert into public.blog_rules (section, rule_key, rule_text, sort_order) values
  ('assets', 'no_layout_brief_on_artwork',
   'NEVER render the layout brief on the artwork. No TOP ZONE, no BOTTOM ZONE, no percentages, no dimensions, no zone names, no placeholder words such as Handwriting. Layout instruction is for the generator, never for the reader. This has shipped on three separate sheets: SS-646 Shabbos, SS-690 pantry bin map, and the universal housekeeping SOP template.',
   10),
  ('assets', 'no_par_levels_ever',
   'No par levels, no reorder points, no min or max, no base stock, no restock thresholds on any asset ever. Permanently out of scope: not a phrase to reword, the premise of the artefact. inventory_items.min_qty exists and NOTICING what is low is in scope; SETTING reorder levels is not.',
   20),
  ('assets', 'no_lettering_in_generated_artwork',
   'No small lettering inside generated artwork: no jar labels, no packaging, no appliance badges, no dials. The generator cannot be trusted with text and has produced gibberish on SS-642, SS-688 and SS-689. Every word in an asset must be magnified and read before it ships.',
   30),
  ('assets', 'no_people_in_generated_artwork',
   'No people in generated artwork. Hands only where a technique needs showing, and never holding an item a procedure forbids handling.',
   40),
  ('copy', 'no_dashes_in_marketing_copy',
   'No em dashes and no en dashes in marketing copy. App interior is exempt. Enforced at build time by scripts/check-no-dashes.js, which strips comments and flags JSX text as well as string literals.',
   50)
on conflict (rule_key) do update set rule_text = excluded.rule_text, sort_order = excluded.sort_order, updated_at = now();

-- The four NEW free sheets. gated=false: these are DIFFERENT ASSETS from
-- the five SS-686 rows, created today and never gated.
--
-- ALL FOUR SEED active=false, including the two marked READY, and that is
-- deliberate rather than a contradiction of the instruction. active=true
-- would put a tile on a live page pointing at a pdf_path that does not
-- exist yet: no PDF has been produced and no cover image uploaded. That is
-- the exact defect migration 198 corrected. They flip to true when the
-- asset and the cover are real, which the rail also enforces independently
-- by requiring cover_image_url.
insert into public.printables (slug, label_en, label_es, pdf_path, gated, sort_order, active, notes) values
  ('room-by-room-inventory-intake-sheet', 'Room by Room Inventory Intake', 'Inventario habitación por habitación',
   'downloads/room-by-room-inventory-intake-sheet.pdf', false, 10, false,
   'READY as artwork. Par Level column removed; four columns now. Source JPEG is in Drive. Awaiting Letter PDF conversion and a cover image, then active=true.'),
  ('universal-housekeeping-sop-template', 'Universal Housekeeping SOP Template', 'Plantilla universal de SOP de limpieza',
   'downloads/universal-housekeeping-sop-template.pdf', false, 20, false,
   'READY as artwork. Printed layout brief painted out, verified by OCR. Source JPEG NOT yet in Drive. Awaiting source, Letter PDF conversion and a cover image, then active=true.'),
  ('household-system-health-check', 'Household System Health Check', 'Chequeo del sistema del hogar',
   'downloads/household-system-health-check.pdf', false, 30, false,
   'NOT READY. Regeneration lost four of five row descriptions and put Sort + Place in the checklist as a row. Awaiting a corrected version.'),
  ('weekly-rhythm-schedule', 'Weekly Rhythm Schedule', 'Ritmo semanal',
   'downloads/weekly-rhythm-schedule.pdf', false, 40, false,
   'NOT READY. Content is clean but the asset is 1376x768 LANDSCAPE, which is a graphic and not a printable sheet. Needs regenerating in Letter proportion.')
on conflict (slug) do update set notes = excluded.notes, gated = excluded.gated, sort_order = excluded.sort_order;
