-- 122_help_articles.sql
-- Property-agnostic in-app Help Center content -- one FAQ library shared by
-- Main and Country House, not scoped to property_id at all.

create table if not exists help_articles (
  id text primary key,
  category text not null,
  question text not null,
  short_answer text not null,
  detailed_answer text not null,
  question_es text,
  short_answer_es text,
  detailed_answer_es text,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table help_articles enable row level security;

-- Read: every authenticated role, both properties -- this is reference
-- content, not something to RLS-restrict by property or role. Not modeled
-- on household_knowledge (that table is manager-only for read AND write --
-- checked directly against its real policy, not assumed), this is its own
-- deliberately-open pattern per the explicit "visible to all roles" spec.
create policy "help_articles_read_all" on help_articles
  for select using (auth.role() = 'authenticated');

-- Write: manager/owner only, split into insert/update/delete rather than a
-- single "for all" -- a "for all" policy is also evaluated on SELECT, and
-- its EXISTS subquery against property_members trips that table's own RLS
-- (is_property_member(), which anon/some contexts can't execute), breaking
-- reads entirely. Confirmed live via the real PostgREST API before landing
-- this shape, not assumed. No property_id scoping (this table has none --
-- unlike household_knowledge's per-property check), so this is "owner or
-- manager of any property," matching the property-agnostic content.
create policy "help_articles_insert_managers" on help_articles
  for insert with check (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid()
        and pm.role = any(array['owner'::member_role, 'manager'::member_role])
    )
  );

create policy "help_articles_update_managers" on help_articles
  for update using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid()
        and pm.role = any(array['owner'::member_role, 'manager'::member_role])
    )
  );

create policy "help_articles_delete_managers" on help_articles
  for delete using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid()
        and pm.role = any(array['owner'::member_role, 'manager'::member_role])
    )
  );
