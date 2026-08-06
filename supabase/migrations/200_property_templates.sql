-- 200_property_templates.sql
-- Applied live 6 Aug 2026; repo copy written after the fact to close the
-- migration drift (apply_migration does not write a repo file).

create table if not exists public.property_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  label_en text not null,
  label_es text not null,
  description_en text not null,
  description_es text not null,
  feature_flags jsonb not null default '{}'::jsonb,
  calendar_layers text[] not null default '{}',
  tip_sets text[] not null default '{}',
  default_retailer text,
  default_bedrooms integer,
  default_bathrooms numeric(3,1),
  derived_from text,
  active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.property_templates is
  'Named starting configurations for new properties. Rows, not code: change the row, never the onboarding source. Observance is expressed ONLY through calendar_layers and tip_sets, never through a module flag.';

alter table public.property_templates enable row level security;

drop policy if exists property_templates_select_authenticated on public.property_templates;
create policy property_templates_select_authenticated
  on public.property_templates for select to authenticated using (true);

grant select on public.property_templates to authenticated;
