-- ============================================================================
-- 036: Reset checklist sections + persisted progress
-- ============================================================================
-- Backs the redesigned Reset Checklists tool (Post-Shabbos Deep Reset):
-- Kitchen/Dining/Laundry/General sections per task, plus a real progress
-- table so "Save Draft" survives a reload — the older generic checklist
-- runner was intentionally session-only, but this one explicitly needs to
-- persist (someone starts it Motzei Shabbos, finishes the next day).

alter table public.task_templates add column if not exists sections jsonb;

update public.task_templates
set sections = '[
  {"name": "Kitchen", "tasks": ["Empty and rinse urn", "Turn off/empty all crockpots", "Store warming trays", "Audit and label leftovers (freeze/fridge/toss)"]},
  {"name": "Dining", "tasks": ["Wash walls near table (spills, fingerprints)", "Dust every surface in dining/living areas", "Vacuum under furniture and around table", "Polish silver (candlesticks, kiddush cups, flatware)", "Wipe down all chairs and upholstery for crumbs"]},
  {"name": "Laundry", "tasks": ["Strip and launder tablecloths", "Iron and put away laundry"]},
  {"name": "General", "tasks": ["Wipe baseboards", "Clean light switches and door handles", "Mop kitchen and dining floors", "Wipe windowsills", "Clean mirrors", "Check for melted candle wax on surfaces, remove", "Restock candles", "Clean and restock guest bathroom", "Empty all garbage", "Air out rooms", "Return serving pieces to storage", "Sweep entryway/porch"]}
]'::jsonb
where template_name = 'Post-Shabbos Deep Reset';

create table if not exists public.reset_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  template_id uuid not null references public.task_templates(id) on delete cascade,
  section text not null,
  task text not null,
  completed boolean not null default false,
  assignee_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (property_id, template_id, section, task)
);

alter table public.reset_checklist_progress enable row level security;

create policy reset_checklist_progress_select on public.reset_checklist_progress
  for select using (is_property_member(property_id));

create policy reset_checklist_progress_insert on public.reset_checklist_progress
  for insert with check (is_property_member(property_id));

create policy reset_checklist_progress_update on public.reset_checklist_progress
  for update using (is_property_member(property_id));
