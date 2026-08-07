-- 235_floors_lookup_table.sql
-- Applied live 7 Aug 2026.
--
-- SS-840. rooms.floor is free text with no ordering. Racquel moved Master
-- Bedroom/Bath/Closet to a new Third Floor on Low and Gym to Basement
-- today; Low now has 4 real floor values (Basement 8, Main Floor 9,
-- Upstairs 10, Third Floor 3) plus 2 rooms with no floor. Sorted
-- alphabetically that reads Basement, Main Floor, Third Floor, Upstairs --
-- wrong, Upstairs is the second floor and belongs above Main Floor.
--
-- Checked ALL properties before assuming Low was the only one affected.
-- Live floor values across every property: Basement, Main Floor,
-- "Third Floor" (Low only), Upstairs, and NULL (Country/Henderson/Lax
-- have no floor data at all; Low/Main/QA Demo also each carry rooms with
-- NULL, which correctly stay unfloored -- Whole House, Hallway, Stairs).
--
-- Frequencies-table pattern: id, label_en, label_es, sort_order,
-- bilingual at creation. Correct real-world stacking order, not
-- alphabetical: Basement (0) < Main Floor (1) < Upstairs (2, the second
-- floor) < Third Floor (3).
--
-- R21: this migration adds the table and rooms.floor_id and backfills --
-- it does NOT drop or stop writing rooms.floor. Deprecating the text
-- column is a separate, later pass once every reader has moved to
-- floor_id (DutyRosterClient.tsx is fixed in this same commit; anything
-- else still reading rooms.floor directly needs its own check first).
--
-- Verified after: every non-null rooms.floor row now has a matching
-- floor_id and the correct sort_order (Basement 28 rooms, Main Floor 39,
-- Upstairs 28, Third Floor 3); 93 null-floor rooms stay unmatched, as
-- intended.
create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  label_en text not null unique,
  label_es text not null,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.floors is
  'SS-840. Ordered floor lookup, frequencies-table pattern. Real-world stacking order in sort_order, not alphabetical -- Upstairs (the second floor) sorts above Main Floor, below Third Floor.';

insert into public.floors (label_en, label_es, sort_order) values
  ('Basement', 'Sótano', 0),
  ('Main Floor', 'Planta Principal', 1),
  ('Upstairs', 'Piso Superior', 2),
  ('Third Floor', 'Tercer Piso', 3)
on conflict (label_en) do nothing;

alter table public.rooms add column if not exists floor_id uuid references public.floors(id);

comment on column public.rooms.floor_id is
  'SS-840. Replaces the free-text rooms.floor for ordering/grouping. rooms.floor is kept (R21) until every reader has moved over; do not write floor_id without also writing the matching floor text, and vice versa, until the text column is formally deprecated.';

update public.rooms r
set floor_id = f.id
from public.floors f
where r.floor = f.label_en
  and r.floor_id is null;

alter table public.floors enable row level security;

drop policy if exists floors_read_all on public.floors;
create policy floors_read_all
  on public.floors for select to authenticated
  using (true);
