-- 190_create_printables_bucket.sql
--
-- NUMBERING: SS-686 specified this as 189. 189 was already taken by
-- 189_seed_low_staff_slots.sql, assigned earlier the same day by the Task
-- Center ticket and already applied. Two files cannot both be 189, so this
-- took the next free number. Nothing else changed.
--
-- WHY A BUCKET AND NOT A ROUTE GUARD: a file in public/ is served as a
-- static asset before any route, middleware or session runs. There is no
-- request lifecycle to hang a check on, so a printable in public/downloads
-- cannot be gated by anything, in front of it or otherwise. The fix has to
-- move the bytes. This bucket is where the gated ones live; the 24
-- ReportLab stubs in public/downloads STAY PUBLIC and are untouched
-- (phase C, not due until 1 September).
--
-- public = false, and deliberately NO read policy of any kind. The only
-- way to the bytes is a short-lived signed URL minted server-side by
-- app/api/download/[slug]/route.ts after it has verified a signed token.
-- Adding a SELECT policy here, even one scoped to authenticated, would
-- reopen exactly the hole this migration closes: subscribers do not have
-- accounts.
insert into storage.buckets (id, name, public)
values ('printables', 'printables', false)
on conflict (id) do update set public = false;
