-- 136_sop_posters_private_bucket.sql
-- SS-363: sop-posters was public, serving reference photos of the house
-- interior to anyone with a URL. Lower risk than a fully enumerable bucket
-- (paths aren't sequential), but the same treatment as training-videos
-- (SS-362) applies -- private bucket, signed URLs, same reasoning.
update storage.buckets set public = false where id = 'sop-posters';

-- No SELECT policy existed (never needed one while public=true). Any
-- signed-in user, matching sop_library's own read policy (sop_read ->
-- auth.uid() is not null) -- staff read posters same as they read SOP text.
create policy "sop-posters: authenticated can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'sop-posters');
