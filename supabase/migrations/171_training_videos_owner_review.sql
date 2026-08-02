-- 171_training_videos_owner_review.sql
-- SS-430 (ruled 2 Aug eve): owner-only clip review queue -- the 24
-- placed-but-inactive sop clips need an in-app surface where Racquel
-- watches each (her R18 check) and approves it, flipping active=true.
-- training_videos previously had ONE policy (read where active=true) and
-- no client write path at all, so the reviewer could not even see the
-- queue. These two policies are scoped to an OWNER of the
-- operator-console property specifically -- not any owner of any house,
-- and never managers/staff: R18 review is hers alone.
create policy "training_videos_review_select_operator_owner"
  on training_videos for select
  using (
    exists (
      select 1 from property_members pm
      join properties p on p.id = pm.property_id
      where pm.user_id = auth.uid()
        and pm.role = 'owner'
        and (p.feature_flags ->> 'operator_console')::boolean is true
    )
  );

create policy "training_videos_review_update_operator_owner"
  on training_videos for update
  using (
    exists (
      select 1 from property_members pm
      join properties p on p.id = pm.property_id
      where pm.user_id = auth.uid()
        and pm.role = 'owner'
        and (p.feature_flags ->> 'operator_console')::boolean is true
    )
  )
  with check (true);

grant update (active) on training_videos to authenticated;
