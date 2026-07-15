create table public.dashboard_widget_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  property_id uuid not null references public.properties(id),
  widget_key text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, property_id, widget_key)
);
alter table public.dashboard_widget_prefs enable row level security;

create policy "users manage their own widget prefs"
  on dashboard_widget_prefs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
