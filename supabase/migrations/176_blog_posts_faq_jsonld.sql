-- 176: per-post FAQPage JSON-LD (home-inventory article, 2 Aug). The SEO
-- content package ships each cluster article with a Schema.org FAQPage
-- block; the public post template renders it as a JSON-LD script when
-- present. Stored as jsonb, not embedded in body_markdown -- the markdown
-- renderer builds JSX and must never emit script content.
alter table blog_posts add column if not exists faq_jsonld jsonb;

comment on column blog_posts.faq_jsonld is
  'Optional Schema.org FAQPage object rendered as a JSON-LD script on the public post page (SEO package articles ship with one). NULL = none.';
