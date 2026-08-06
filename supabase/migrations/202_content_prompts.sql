-- 202_content_prompts.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.

create table if not exists public.content_prompts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('blog_post','printable','pin','sop','ad','other')),
  target_slug text,
  sequence integer,
  prompt_text text not null,
  placement text check (placement in ('header','full','wide','inline','beside')),
  aspect text,
  status text not null default 'draft'
    check (status in ('draft','approved','generated','rejected','superseded')),
  generated_asset_url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_prompts_target_idx
  on public.content_prompts (scope, target_slug, sequence);

comment on table public.content_prompts is
  'Image and asset generation prompts as rows, not files. The Blog Drafts reference panel reads this alongside blog_rules and design_rules. A prompt that lives only in a Drive manifest cannot be shown in the app and cannot be enforced.';

alter table public.content_prompts enable row level security;

drop policy if exists content_prompts_select_authenticated on public.content_prompts;
create policy content_prompts_select_authenticated
  on public.content_prompts for select to authenticated using (true);

grant select on public.content_prompts to authenticated;
