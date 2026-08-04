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

-- NOT CHANGED HERE, reported instead: blog_posts_insert_managers still reads
-- roles = {public} with a NULL qual, because its restriction lives in
-- WITH CHECK. Read verbatim, that WITH CHECK is:
--   EXISTS (SELECT 1 FROM property_members pm
--           WHERE pm.user_id = auth.uid()
--             AND pm.role = ANY (ARRAY['owner','manager']))
-- So it carries the same two defects as UPDATE and DELETE did -- no
-- TO authenticated and no operator_console gate -- and any owner/manager of
-- any property can still CREATE a post. It does NOT reproduce SS-614: a
-- WITH CHECK is only evaluated on INSERT, and the public blog never inserts,
-- so anon never reaches property_members through it.
-- Left alone because the instruction was to report before changing it. The
-- fix is the same shape as the two above, and until it lands the write side
-- is in a mixed state: a non-operator manager can create a post but not edit
-- or delete one.
