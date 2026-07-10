-- Public bucket for profile avatars, one folder per user (path:
-- {user_id}/{uuid}.jpg) so RLS can restrict uploads/replacements to a
-- user's own folder. Public read since avatars render in headers across
-- every property a user belongs to, same as recipe/location photos.
insert into storage.buckets (id, name, public)
values ('avatar-photos', 'avatar-photos', true)
on conflict (id) do nothing;

create policy "avatar-photos: anyone can read"
  on storage.objects for select
  using (bucket_id = 'avatar-photos');

create policy "avatar-photos: users can upload their own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatar-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar-photos: users can replace their own"
  on storage.objects for update
  using (
    bucket_id = 'avatar-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar-photos: users can delete their own"
  on storage.objects for delete
  using (
    bucket_id = 'avatar-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
