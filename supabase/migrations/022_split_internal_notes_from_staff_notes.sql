-- 022_split_internal_notes_from_staff_notes.sql
-- Applied live 22 Jul 2026; repo copy written after the fact (SS-256/SS-796).
--
-- NUMBER COLLISION, DELIBERATELY LEFT AS-IS (R21: never renumber, never
-- delete). A second, unrelated migration also named "022_" exists in
-- supabase_migrations -- 022_add_dip_vege_course_values, applied 16 days
-- earlier on 2026-07-06. Postgres orders both correctly by their real
-- timestamp (this one is 20260722221235, the other is 20260706140948), so
-- nothing is broken at the database level. The collision only bites
-- anything that reads or groups migrations by their three-digit prefix as
-- if it were a unique key -- it is not, here. See that file for the same
-- note from its side. (023b_split_mixed_notes_sequential and
-- 024_split_mixed_notes_corrected continue this same internal_notes
-- effort and are also still missing their own repo files -- a separate,
-- still-open gap, not fixed by this pass.)
--
-- Racquel's notes field was being used for two different things: genuine
-- staff-facing guidance (substitutions, kashrus context, sourcing
-- requirements) and admin/audit-trail breadcrumbs left behind by past
-- data-fix sessions (e.g. "Reorder link replaced 2026-07-19: previous
-- link was..."). The second kind was rendering on item cards in the app,
-- visible to anyone at the residence -- confirmed directly on Organic
-- Bananas ("Reorder link replaced 2026-07-19: previous link was a bare
-- Instacart product ID..."), which is meaningless and slightly odd for
-- staff to see while grabbing bananas.
--
-- internal_notes holds that audit trail so it isn't lost, but is not
-- rendered anywhere in the app. notes stays reserved for what staff
-- actually need to see.
alter table inventory_items add column if not exists internal_notes text;

-- Move whole-string matches of known pure-admin patterns. Deliberately
-- excludes any note containing " | " -- that delimiter means multiple
-- notes got concatenated over time, and some of those combine an admin
-- breadcrumb with real kashrus/sourcing guidance (e.g. the Dagim tuna
-- note: a photo-confirmation breadcrumb PLUS "Fish is kashrus-critical
-- and this household sources it from Kosher West"). Those 195 mixed
-- notes are left untouched on purpose -- splitting them safely needs a
-- read of each one, not a pattern match, or real guidance could get
-- silently hidden along with the clutter.
update inventory_items
set internal_notes = notes, notes = null
where notes is not null
  and notes not like '%|%'
  and notes ~* '^(Reorder link replaced|Added as household staple|Copied from Main|Split from combined record|Added from order history|Manufacturer page \(product reference|Par/Min sourced from Estate Procurement Sheet|Real photo confirmed via contact sheet|No hechsher needed for unprocessed fruits)';

-- Empty-string notes carried zero information either way -- just clear them.
update inventory_items set notes = null where notes = '';
