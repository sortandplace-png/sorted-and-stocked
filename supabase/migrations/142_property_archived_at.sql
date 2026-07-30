-- 142_property_archived_at.sql
-- SS-369/SS-370/SS-371 verification left four throwaway test properties
-- behind (QA RPC Test, SS-370 Join Test, SS-370 New Household Test,
-- SS-371 Post Revoke Test) -- the prevent_last_owner_removal trigger blocks
-- deleting any of them, and per R21 that's the right outcome: archive
-- rather than remove, not force the trigger.
--
-- Nullable timestamp, not a boolean -- matches the existing
-- square_payment_link_sent_at convention (state + a free "when," not just
-- a flag) and reads naturally in a `where archived_at is null` filter.
-- Soft-archive only affects the property selector (/properties) and the
-- "join an existing household" picker (NewPropertyForm.tsx) -- an archived
-- property stays fully reachable and functional by direct URL, since
-- these remain useful as disposable test fixtures for future verification
-- work, just no longer offered as real destinations.
alter table properties add column archived_at timestamptz;

-- QA Demo is deliberately NOT included here despite being named in the
-- same cleanup request -- it's the only property demo@sortedandstocked.com
-- (the real Apple App Review login, confirmed live: it's a member of all
-- five properties named, manager not owner on QA Demo) has any access to.
-- Archiving it would leave that account's property selector empty. Flagged
-- back rather than silently included.
update properties
set archived_at = now()
where id in (
  '28c090af-67db-4624-a640-64c4cf91bc80', -- QA RPC Test
  '60c0d06d-4354-430f-a5e7-04270ab964b2', -- SS-370 Join Test
  '8f5c0a56-0e1e-4434-892f-c866d022ddc6', -- SS-370 New Household Test
  'fdddf49d-de13-4e65-8437-96ac2bc56c3a'  -- SS-371 Post Revoke Test
);
