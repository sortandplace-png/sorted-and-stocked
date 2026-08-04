-- SS-616/SS-624: reading unpublished drafts now requires membership of a
-- property carrying the operator_console flag, not merely owner/manager
-- anywhere. Lax is the only property carrying it, which is the point.
--
-- TO authenticated IS LOAD BEARING AND MUST NEVER BE DROPPED.
-- Without it the policy applies to PUBLIC, so ANON evaluates this USING
-- clause on every public blog read. The clause reaches property_members,
-- whose own RLS calls is_property_member(), and anon ERRORS there rather
-- than returning zero rows -- taking the whole public blog down. That is
-- not hypothetical: it is SS-614, a 35-minute outage on 2026-08-04,
-- caused by exactly this omission in migration 180's first version.
-- A draft-reading policy has no business being evaluated by a signed-out
-- visitor at all; anon reads are served entirely by
-- blog_posts_read_published.
DROP POLICY IF EXISTS blog_posts_read_drafts_managers ON public.blog_posts;

CREATE POLICY blog_posts_read_drafts_managers ON public.blog_posts
FOR SELECT
TO authenticated
USING (
  published_at IS NULL
  AND EXISTS (
    SELECT 1 FROM property_members pm
    JOIN properties p ON p.id = pm.property_id
    WHERE pm.user_id = auth.uid()
      AND pm.role = ANY (ARRAY['owner','manager']::member_role[])
      AND (p.feature_flags->>'operator_console')::boolean IS TRUE
  )
);
