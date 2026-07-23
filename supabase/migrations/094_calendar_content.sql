-- calendar_content already exists live (created directly against the DB,
-- currently empty on purpose) -- this migration brings the tracked
-- history and repo in sync with what's actually running. Holds
-- rotating Today-card tip/reflection copy: content_type distinguishes
-- 'tip' vs 'reflection', trigger_type is which calendar moment it's
-- meant for (rosh_chodesh / pre_yomtov / omer / fast_day / general as a
-- catch-all when nothing calendar-specific applies today). No CHECK
-- constraint on either -- deliberately left as plain text since this is
-- content-editor-facing, not enforced by the app's own logic beyond how
-- it queries by trigger_type.
create table if not exists public.calendar_content (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  content_type text not null,
  trigger_type text not null default 'general',
  title_en text not null,
  title_es text,
  body_en text not null,
  body_es text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists calendar_content_property_trigger_idx
  on public.calendar_content (property_id, trigger_type)
  where active;

alter table public.calendar_content enable row level security;

drop policy if exists calendar_content_select_member on public.calendar_content;
create policy calendar_content_select_member on public.calendar_content
  for select using (is_property_member(property_id));

drop policy if exists calendar_content_insert_member on public.calendar_content;
create policy calendar_content_insert_member on public.calendar_content
  for insert with check (is_property_member(property_id));

drop policy if exists calendar_content_update_member on public.calendar_content;
create policy calendar_content_update_member on public.calendar_content
  for update using (is_property_member(property_id)) with check (is_property_member(property_id));

drop policy if exists calendar_content_delete_owner_manager on public.calendar_content;
create policy calendar_content_delete_owner_manager on public.calendar_content
  for delete using (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));
