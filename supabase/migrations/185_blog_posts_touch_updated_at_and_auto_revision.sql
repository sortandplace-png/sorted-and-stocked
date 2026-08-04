-- SS-655: blog_posts had no triggers. updated_at drifted and revision capture
-- was voluntary. Both are now automatic.

CREATE OR REPLACE FUNCTION public.blog_posts_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER blog_posts_set_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.blog_posts_touch_updated_at();

-- Snapshot the OLD row before any content-bearing change, so a rollback target
-- always exists whether or not anyone thought to take one.
--
-- SECURITY DEFINER IS REQUIRED, and this is the one deviation from the
-- prompt's SQL. public.blog_post_revisions has relrowsecurity = true with
-- ZERO policies, which denies all access to every non-owner role. A trigger
-- function runs as the INVOKING user, so as `authenticated` this INSERT would
-- be rejected by RLS and, being BEFORE UPDATE, would abort the whole
-- statement -- every blog write would fail. The 54 revisions already in the
-- table were all inserted through a privileged role that bypasses RLS, which
-- is why the gap was invisible until now.
--
-- search_path is pinned because SECURITY DEFINER runs with the owner's
-- rights: without it a caller could point `public` at a schema of their own
-- and have this function write somewhere else entirely. pg_temp is last so a
-- temp object can never shadow a real one.
CREATE OR REPLACE FUNCTION public.blog_posts_capture_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.body_markdown IS DISTINCT FROM NEW.body_markdown
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.excerpt IS DISTINCT FROM NEW.excerpt
     OR OLD.published_at IS DISTINCT FROM NEW.published_at THEN
    INSERT INTO public.blog_post_revisions
      (slug, title, body_markdown, excerpt, header_image_url,
       cta_label, cta_url, faq_jsonld, published_at, captured_at, captured_reason)
    VALUES
      (OLD.slug, OLD.title, OLD.body_markdown, OLD.excerpt, OLD.header_image_url,
       OLD.cta_label, OLD.cta_url, OLD.faq_jsonld, OLD.published_at, now(),
       'automatic pre-update snapshot (SS-655)');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER blog_posts_auto_revision
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.blog_posts_capture_revision();

-- Trigger fire order is alphabetical within the same timing, so
-- blog_posts_auto_revision runs before blog_posts_set_updated_at. That is the
-- order you want: the snapshot reads OLD and is unaffected either way, and
-- updated_at is stamped on NEW afterwards.
--
-- Verified live on blog-21 after applying: updated_at moved from
-- 2026-08-03 18:09:34 to 2026-08-04 19:46:12, revisions went 54 -> 55
-- (exactly one), and the new row held the OLD excerpt (139 chars) while the
-- live row carried the edited one (140). The revert then produced a second
-- automatic revision, which is correct and worth knowing: every content
-- write now costs a row, including the ones that undo something.
