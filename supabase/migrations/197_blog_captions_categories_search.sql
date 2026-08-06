-- 197_blog_captions_categories_search.sql
-- Three net-new pieces the blog layout and rail need. All additive; no
-- existing column changes type and no content is rewritten.

-- 1. HEADER IMAGE CAPTION AND ALT.
--
-- blog_posts carried ZERO caption and ZERO alt columns, so every one of
-- the 11 published posts ships a header image with no alt text. That is a
-- live accessibility defect on the public marketing surface, not a nicety.
--
-- CAPTION AND ALT ARE SEPARATE COLUMNS ON PURPOSE. They are different
-- jobs: the caption is author voice, read by everyone, and says something
-- the picture does not; the alt describes what is SHOWN, for a reader who
-- cannot see it. Using one for both produces alt text that reads as a
-- non-sequitur to a screen reader user and a caption that states the
-- obvious to everyone else.
--
-- Bilingual, both of them, written at creation. Shipped EMPTY: the 43
-- captions are Claude's to write and placeholder text on a live page is
-- worse than none.
--
-- INLINE images are NOT covered here. Their alt already lives in the
-- markdown, ![alt](url), which is the right place for it: it travels with
-- the image. Only the header image is a column, because it is a column.
alter table public.blog_posts
  add column if not exists header_image_caption_en text,
  add column if not exists header_image_caption_es text,
  add column if not exists header_image_alt_en text,
  add column if not exists header_image_alt_es text;

comment on column public.blog_posts.header_image_alt_en is
  'What the header image SHOWS, for screen readers. Not the caption: the caption is author voice and says what the picture does not. Empty on every row at creation; filling them is content work.';

-- 2. CATEGORIES.
--
-- A JOIN TABLE, NOT A TEXT COLUMN, because a post belongs to more than
-- one: an article about erev Shabbos pantry prep is Pantry AND Shabbos and
-- Yom Tov. A text column forces a false primary and a comma-separated one
-- cannot be indexed or filtered honestly.
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_en text not null,
  label_es text not null,
  sort_order integer not null
);

-- Same shape as frequencies and work_sections: code, both labels, order.
-- Adding a category is a row, never a migration.
insert into public.blog_categories (slug, label_en, label_es, sort_order) values
  ('pantry',     'Pantry',              'Despensa',            1),
  ('inventory',  'Inventory',           'Inventario',          2),
  ('staff',      'Staff',               'Personal',            3),
  ('shabbos',    'Shabbos and Yom Tov', 'Shabbos y Yom Tov',   4),
  ('systems',    'Systems',             'Sistemas',            5)
on conflict (slug) do update set sort_order = excluded.sort_order;

create table if not exists public.blog_post_categories (
  post_slug text not null references public.blog_posts(slug) on delete cascade,
  category_id uuid not null references public.blog_categories(id) on delete cascade,
  primary key (post_slug, category_id)
);

create index if not exists blog_post_categories_category_idx
  on public.blog_post_categories (category_id);

-- 3. FULL TEXT SEARCH over title, excerpt and body.
--
-- A GENERATED column, so it can never drift from the post: there is no
-- trigger to forget and no backfill to re-run. Weighted A/B/C, because a
-- word in the title is a stronger match than the same word four thousand
-- characters into the body, and an unweighted index ranks them equally.
--
-- 'english' is deliberate and is a known limitation: it stems English, so
-- Spanish content will match literally but will not stem. The posts are
-- English today. A Spanish column is the fix when Spanish posts exist, not
-- a second guess now.
alter table public.blog_posts
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_markdown, '')), 'C')
  ) stored;

create index if not exists blog_posts_search_idx
  on public.blog_posts using gin (search_tsv);

-- RLS. Both new tables are public reference data for a PUBLIC blog, so
-- anon must read them or the index filters and the rail render empty to
-- every visitor. They carry no household data.
alter table public.blog_categories enable row level security;
alter table public.blog_post_categories enable row level security;

drop policy if exists blog_categories_read_all on public.blog_categories;
create policy blog_categories_read_all
  on public.blog_categories for select to anon, authenticated using (true);

-- Deliberately NOT "using (true)": a category link on an UNPUBLISHED post
-- would leak the existence and slug of a draft to the public blog. The
-- join row is only readable when its post is published, which matches how
-- blog_posts itself is read publicly.
drop policy if exists blog_post_categories_read_published on public.blog_post_categories;
create policy blog_post_categories_read_published
  on public.blog_post_categories for select to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts bp
      where bp.slug = blog_post_categories.post_slug
        and bp.published_at is not null
    )
  );

comment on table public.blog_post_categories is
  'Join, not a text column: a post belongs to more than one category. Read policy is gated on the post being published, so a draft slug cannot leak through its category links.';
