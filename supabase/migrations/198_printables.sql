-- 198_printables.sql
-- The rail offered four printables under invented labels. The labels were
-- written in a component; nothing checked that a real deliverable sat
-- behind them. A ROW CANNOT EXIST WITHOUT A PATH; a hardcoded label can.
-- That is the whole reason this is a table.
--
-- CORRECTION TO THE REPORT THAT PROMPTED IT: the four did NOT 404. All
-- four return HTTP 200 application/pdf. They are 1-page, roughly 4KB
-- ReportLab stubs, so the rail was offering four real sounding documents
-- and delivering four near-empty pages. Different defect, same remedy.
create table if not exists public.printables (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_en text not null,
  label_es text not null,
  pdf_path text not null,
  cover_image_url text,
  gated boolean not null default false,
  sort_order integer not null default 100,
  active boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.printables enable row level security;

drop policy if exists printables_read_active on public.printables;
create policy printables_read_active
  on public.printables for select to anon, authenticated
  using (active and not gated);

insert into public.printables (slug, label_en, label_es, pdf_path, gated, sort_order, active, notes) values
  ('reset-day', 'The Reset Day', 'El día de reinicio', 'printables/reset-day.pdf', true, 1, false,
   'CLEAN. Lives in the PRIVATE printables bucket and is gated behind the email (SS-686), so it is not a free rail printable.'),
  ('training-staff', 'Training Staff', 'Capacitación del personal', 'printables/training-staff.pdf', true, 2, false,
   'CLEAN. Private bucket, gated behind the email (SS-686).'),
  ('weekly-pantry-reset', 'The Weekly Pantry Reset', 'El reinicio semanal de la despensa', 'printables/weekly-pantry-reset.pdf', true, 3, false,
   'CLEAN per SS-696, regenerated arrow free. NOT YET UPLOADED to any bucket.'),
  ('pantry-hierarchy', 'Pantry Hierarchy', 'Jerarquía de la despensa', 'printables/pantry-hierarchy.pdf', true, 4, false,
   'DEFECTIVE, do not ship. SS-687: gibberish strip, INTERACTIVE FILL IN is false.'),
  ('shabbos-prep', 'Shabbos Prep', 'Preparación para Shabbos', 'printables/shabbos-prep.pdf', true, 5, false,
   'DEFECTIVE, do not ship. SS-685: design brief on the artwork, banned phrase, em dash, wrong page size.')
on conflict (slug) do nothing;

comment on table public.printables is
  'Printables the site may offer. pdf_path is NOT NULL because the defect this replaces was a hardcoded label with no asset behind it. The rail reads active AND NOT gated AND a cover image, so a row cannot reach a reader until all three are real. Everything seeds active=false: fail closed.';
