-- recipe-photos had zero storage.objects RLS policies -- RLS is enabled on
-- the table, so every client-side (authenticated-role) upload attempt was
-- silently denied. Every other photo bucket (item-photos, avatar-photos,
-- location-photos, memory-photos) already has this exact pattern; the 25+
-- recipe photos that already exist in this bucket were uploaded via
-- service-role scripts, which bypass RLS entirely -- the browser upload
-- path added to NewRecipeModal.tsx was the first thing to ever exercise
-- this bucket client-side, and it could never have succeeded.
--
-- Path convention matches item-photos: first folder segment is the
-- property_id (see NewRecipeModal.tsx's `${propertyId}/${recipeId}-...jpg`).
create policy "recipe-photos: members can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and exists (
      select 1 from property_members pm
      where pm.property_id::text = (storage.foldername(objects.name))[1]
        and pm.user_id = auth.uid()
    )
  );

create policy "recipe-photos: members can replace"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-photos'
    and exists (
      select 1 from property_members pm
      where pm.property_id::text = (storage.foldername(objects.name))[1]
        and pm.user_id = auth.uid()
    )
  );

create policy "recipe-photos: members can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recipe-photos'
    and exists (
      select 1 from property_members pm
      where pm.property_id::text = (storage.foldername(objects.name))[1]
        and pm.user_id = auth.uid()
    )
  );
