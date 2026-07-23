-- 123_blog_posts.sql
-- Public marketing blog -- meant to be reachable and indexable without a
-- login, unlike every other table in this app. published_at null = draft,
-- not shown on the public read policy below.

create table if not exists blog_posts (
  slug text primary key,
  title text not null,
  body_markdown text not null,
  excerpt text,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table blog_posts enable row level security;

-- Read: unauthenticated (anon) and authenticated both -- this has to work
-- for a logged-out visitor and a search-engine crawler, not just app users.
-- Drafts (published_at is null) stay invisible to this policy either way.
create policy "blog_posts_read_published" on blog_posts
  for select using (published_at is not null);

-- Write: manager/owner only, split into insert/update/delete rather than a
-- single "for all" policy -- confirmed live (via the real PostgREST API,
-- anon key) that a "for all" policy here breaks anonymous reads entirely:
-- it's also evaluated on SELECT, and its EXISTS subquery against
-- property_members trips that table's own RLS (is_property_member(), which
-- anon can't execute), surfacing as a bare 42501 permission error instead
-- of the intended empty/filtered result. No property_id scoping, same as
-- help_articles -- this table has none either.
create policy "blog_posts_insert_managers" on blog_posts
  for insert with check (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid()
        and pm.role = any(array['owner'::member_role, 'manager'::member_role])
    )
  );

create policy "blog_posts_update_managers" on blog_posts
  for update using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid()
        and pm.role = any(array['owner'::member_role, 'manager'::member_role])
    )
  );

create policy "blog_posts_delete_managers" on blog_posts
  for delete using (
    exists (
      select 1 from property_members pm
      where pm.user_id = auth.uid()
        and pm.role = any(array['owner'::member_role, 'manager'::member_role])
    )
  );
