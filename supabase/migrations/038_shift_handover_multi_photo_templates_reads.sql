-- ============================================================================
-- 038: Shift Handover redesign — multiple photos, template tags, unread reads
-- ============================================================================

alter table public.shift_handovers
  add column if not exists photo_data_urls text[],
  add column if not exists template_tag text;

-- No "unread" concept existed anywhere in the app — real new table, not a
-- fake badge. One row per (property, user); last_read_at advances whenever
-- that user views the Handover tab. Unread count = handovers newer than
-- this, excluding the viewer's own posts.
create table if not exists public.shift_handover_reads (
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (property_id, user_id)
);

alter table public.shift_handover_reads enable row level security;

create policy shift_handover_reads_select on public.shift_handover_reads
  for select using (is_property_member(property_id));

create policy shift_handover_reads_upsert on public.shift_handover_reads
  for insert with check (user_id = auth.uid() and is_property_member(property_id));

create policy shift_handover_reads_update on public.shift_handover_reads
  for update using (user_id = auth.uid());
