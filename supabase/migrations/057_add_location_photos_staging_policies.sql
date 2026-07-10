-- The existing location-photos policies require the upload path's first
-- folder segment to be a real locations.id (matches LocationPhotoUpload.tsx,
-- which already knows the room before uploading). The bulk Photo Review
-- screen uploads BEFORE a room is chosen, staged under {property_id}/..., so
-- it needs its own policy — additive, doesn't touch the existing ones.
create policy "location-photos: members can upload to property staging"
  on storage.objects for insert
  with check (
    bucket_id = 'location-photos'
    and exists (
      select 1 from property_members pm
      where pm.property_id::text = (storage.foldername(objects.name))[1]
        and pm.user_id = auth.uid()
    )
  );

create policy "location-photos: members can read property staging"
  on storage.objects for select
  using (
    bucket_id = 'location-photos'
    and exists (
      select 1 from property_members pm
      where pm.property_id::text = (storage.foldername(objects.name))[1]
        and pm.user_id = auth.uid()
    )
  );
