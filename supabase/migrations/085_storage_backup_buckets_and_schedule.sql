-- Private backup buckets, one per real photo bucket -- only ever written by
-- the storage-backup Edge Function's service-role client (RLS on
-- storage.objects has no policies for these, so no authenticated/anon role
-- can read or write them at all; service role bypasses RLS regardless).
insert into storage.buckets (id, name, public) values
  ('avatar-photos-backup', 'avatar-photos-backup', false),
  ('ingredient-photos-backup', 'ingredient-photos-backup', false),
  ('inventory-photos-backup', 'inventory-photos-backup', false),
  ('item-photos-backup', 'item-photos-backup', false),
  ('location-photos-backup', 'location-photos-backup', false),
  ('memory-photos-backup', 'memory-photos-backup', false),
  ('recipe-photos-backup', 'recipe-photos-backup', false)
on conflict (id) do nothing;

-- Daily, same cadence as Supabase's own Postgres backups -- Storage content
-- (photo uploads) changes often enough in this app that a weekly cadence
-- would risk losing up to 6 days of new/replaced photos before they're
-- ever backed up.
select cron.schedule(
  'storage-backup-daily',
  '0 4 * * *', -- 4am UTC daily -- after the low-stock/digest-style jobs, low-traffic window
  $$
  select net.http_post(
    url := 'https://jfaaqzrezcrkkidlsbwj.supabase.co/functions/v1/storage-backup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
