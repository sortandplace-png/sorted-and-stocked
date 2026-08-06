-- 184_blog_posts_write_requires_operator_console.sql
-- Applied live 4 Aug 2026; repo copy written after the fact.

-- SS-654: writing to blog_posts requires membership of a property carrying
-- operator_console, not merely owner/manager anywhere. Migration 183 fixed the
-- read side and left these two behind.
--
-- TO authenticated IS LOAD BEARING. See migration 183. Without it these
-- policies are evaluated by PUBLIC, the USING clause reaches property_members,
-- and anon errors inside is_property_member() rather than returning zero rows.
-- That is SS-614, a 35-minute public blog outage on 2026-08-04.

DROP POLICY IF EXISTS blog_posts_update_managers ON public.blog_posts;

CREATE POLICY blog_posts_update_managers ON public.blog_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM property_members pm
    JOIN properties p ON p.id = pm.property_id
    WHERE pm.user_id = auth.uid()
      AND pm.role = ANY (ARRAY['owner','manager']::member_role[])
      AND (p.feature_flags->>'operator_console')::boolean IS TRUE
  )
);

DROP POLICY IF EXISTS blog_posts_delete_managers ON public.blog_posts;

CREATE POLICY blog_posts_delete_managers ON public.blog_posts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM property_members pm
    JOIN properties p ON p.id = pm.property_id
    WHERE pm.user_id = auth.uid()
      AND pm.role = ANY (ARRAY['owner','manager']::member_role[])
      AND (p.feature_flags->>'operator_console')::boolean IS TRUE
  )
);
