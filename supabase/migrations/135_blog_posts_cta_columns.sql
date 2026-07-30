-- 135_blog_posts_cta_columns.sql
-- SS-358: cta_label and cta_url have been live on blog_posts, populated on
-- all 7 rows, since before this migration existed -- no migration file
-- ever added them (confirmed by grepping every file in this directory).
-- Written to make schema history match live schema, not to change
-- anything: `if not exists` so this is a no-op against the current
-- database and only matters for a fresh environment built from the
-- migrations from scratch.
--
-- Each post's CTA links back into the app -- e.g. "See this on your
-- Dashboard" -> /dashboard -- which is why the property-scoped blog view
-- (app/properties/[id]/blog/[slug]/page.tsx, components/BlogPostDetail.tsx)
-- reads these columns; the public marketing blog (app/blog/[slug]) does not.
alter table blog_posts
  add column if not exists cta_label text,
  add column if not exists cta_url text;
