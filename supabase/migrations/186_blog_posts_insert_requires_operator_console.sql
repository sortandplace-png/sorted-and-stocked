-- 186_blog_posts_insert_requires_operator_console.sql
-- Applied live 4 Aug 2026; repo copy written after the fact.

-- SS-654 part 2: the INSERT policy, brought in line with 184.
--
-- Reported before it was changed, per instruction. Verbatim, the old
-- WITH CHECK was:
--   EXISTS (SELECT 1 FROM property_members pm
--           WHERE pm.user_id = auth.uid()
--             AND pm.role = ANY (ARRAY['owner','manager']))
-- roles = {public}, qual = NULL. The NULL qual is not a defect: an INSERT
-- policy has no USING clause, only WITH CHECK, which is why it reads that
-- way in pg_policy.
--
-- It did NOT reproduce SS-614, and that distinction is worth keeping: a
-- WITH CHECK is only evaluated on INSERT, and the public blog never
-- inserts, so anon never reached property_members through it. The defect
-- was authorisation, not availability -- any owner/manager of any property
-- could create a post.
--
-- Left as-is, the write side was incoherent: after 184 a non-operator
-- manager could CREATE a post but not edit or delete one.
--
-- TO authenticated IS LOAD BEARING. See migration 183.
DROP POLICY IF EXISTS blog_posts_insert_managers ON public.blog_posts;

CREATE POLICY blog_posts_insert_managers ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM property_members pm
    JOIN properties p ON p.id = pm.property_id
    WHERE pm.user_id = auth.uid()
      AND pm.role = ANY (ARRAY['owner','manager']::member_role[])
      AND (p.feature_flags->>'operator_console')::boolean IS TRUE
  )
);
