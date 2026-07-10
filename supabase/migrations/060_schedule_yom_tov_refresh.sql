-- Monthly cron job that invokes the refresh-yom-tov-dates Edge Function.
-- The service-role key it authenticates with lives in Supabase Vault
-- (created separately, not in any committed file) and is looked up by name
-- at execution time -- this migration never contains the actual secret.
select cron.schedule(
  'refresh-yom-tov-dates-monthly',
  '0 3 1 * *', -- 3am UTC on the 1st of every month
  $$
  select net.http_post(
    url := 'https://jfaaqzrezcrkkidlsbwj.supabase.co/functions/v1/refresh-yom-tov-dates',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
