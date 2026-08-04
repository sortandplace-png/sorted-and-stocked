-- Register drafts section (Racquel's ruling, 3 Aug late): 32 unpublished
-- posts had no readable surface anywhere - the only SELECT policy was
-- read_published, so even the owner could not read her own drafts through
-- any client path, and the blog-39..43 numbering/date decision was blocked
-- on reading them. This adds a drafts-only SELECT for owner/manager
-- members. Anonymous and staff reads of drafts remain impossible.
--
-- TO authenticated IS LOAD-BEARING, learned live: the first applied
-- version omitted it, so ANON blog reads started evaluating the EXISTS
-- on property_members, whose own RLS calls is_property_member() - a
-- function anon has no EXECUTE on. Every anonymous blog_posts SELECT
-- errored: the public blog index rendered "No posts yet" and every
-- article 404ed for roughly 35 minutes (3-4 Aug, ~23:40-00:15 UTC)
-- until the policy was rescoped. With TO authenticated, anon never
-- evaluates this policy at all and read_published alone governs anon.
--
-- Applied live via MCP (blog_posts_read_drafts_managers, then
-- blog_posts_read_drafts_managers_fix_anon); this file records the
-- corrected final state in the repo history.
CREATE POLICY blog_posts_read_drafts_managers ON blog_posts
  FOR SELECT TO authenticated USING (
    published_at IS NULL AND EXISTS (
      SELECT 1 FROM property_members pm
      WHERE pm.user_id = auth.uid() AND pm.role = ANY (ARRAY['owner'::member_role, 'manager'::member_role])
    )
  );
