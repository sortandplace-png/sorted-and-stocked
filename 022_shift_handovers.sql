-- ============================================================================
-- 022: Shift handover notes
-- ============================================================================
-- Lets outgoing staff leave a quick photo, short audio note, and/or text for
-- whoever's coming on next -- instead of a long typed summary. Media is
-- stored inline as base64 text (small, occasional records: a handful per
-- property per day). If this ever grows into hundreds of records a day with
-- large media, move photo/audio to a real Supabase Storage bucket instead --
-- not needed at this scale.
-- ============================================================================

create table public.shift_handovers (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties(id) on delete cascade,
  created_by       uuid not null references auth.users(id) on delete cascade,
  note_text        text,
  photo_data_url   text,
  audio_data_url   text,
  created_at       timestamptz not null default now()
);

create index idx_shift_handovers_property on public.shift_handovers(property_id, created_at desc);

alter table public.shift_handovers enable row level security;

-- Same visibility as everything else property-scoped: any member (staff
-- included -- this feature is *for* staff) can read and leave notes.
create policy "shift_handovers_select_member"
  on public.shift_handovers for select
  using (public.is_property_member(property_id));

create policy "shift_handovers_insert_member"
  on public.shift_handovers for insert
  with check (created_by = auth.uid() and public.is_property_member(property_id));

-- No update/delete policies: a handover log is an append-only record of what
-- was said at shift change, not editable state.
