-- 195_strip_trailing_bio_from_body_markdown.sql
-- SS-709 second half. SHIPS IN THE SAME COMMIT as the render that
-- replaces it (app/blog/[slug]/page.tsx). Neither half is safe alone:
-- this migration without the render silently deletes the line from 31
-- posts, 4 of them published, and the render without this migration
-- prints it twice.
--
-- IT IS NOT AUTHOR COPY. The identical rule-plus-italic line was pasted
-- into 31 body_markdown rows. Verified before writing this: exactly ONE
-- distinct variant across all 31 (single md5), and in all 31 it is the
-- final characters of the field with nothing after it. Zero rows carry it
-- anywhere other than the end. So there is no second wording to lose and
-- no mid-article occurrence to catch by accident.
--
-- WHY IT HAD TO MOVE: a single markdown field cannot be bilingual. As long
-- as the sentence lived in body_markdown, a Spanish reader was always
-- going to be served the English one. It is now a component line following
-- getLocale, and the Spanish version exists for the first time.
--
-- ANCHORED TO END OF FIELD. \s*$ with the rule and the bio as one unit, so
-- a "---" used as a section break mid-article cannot match. Everything
-- above the rule, including the related-post bullets and the services
-- lists, is real author copy and is untouched.
--
-- REVERSIBLE: blog_posts_auto_revision is enabled on this table and
-- captures body_markdown before every change, so all 31 prior bodies land
-- in blog_post_revisions. Confirmed enabled before running.
--
-- IDEMPOTENT: the pattern cannot match a row it has already cleaned,
-- because the bio is gone from it.

update public.blog_posts
   set body_markdown = regexp_replace(
         body_markdown,
         -- optional trailing whitespace, the rule, blank lines, the italic
         -- bio, trailing whitespace, end of field.
         '\s*\n---\s*\n+\*Sort \+ Place is a professional organizing[^*]*\*\s*$',
         ''
       )
 where body_markdown ~ '\n---\s*\n+\*Sort \+ Place is a professional organizing[^*]*\*\s*$';
