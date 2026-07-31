-- 134_work_items_service_role_only.sql
-- SS-302: work_items had a single ALL policy checking "is this user
-- owner/manager on ANY property", with no property_id column to scope by
-- (it is a cross-property internal ops register, not property-scoped app
-- data). Confirmed live: an owner/manager on ONE property -- including a
-- brand-new property anyone can create via signup, which auto-grants
-- owner -- could read and write every row, across every household. With
-- three people this was harmless; it breaks outright the moment a second,
-- unrelated client household exists.
--
-- work_items is not read by any application code (confirmed by grep across
-- app/ and components/ -- the only hits are comment citations of ticket
-- numbers, not queries), so there is no in-app feature to preserve here.
-- It is written and read exclusively via direct/service-role tooling
-- (the Supabase MCP connection used by Code and by Racquel's own Claude
-- session), which bypasses RLS entirely and is unaffected by this change.
--
-- Fix: remove the authenticated/anon path altogether rather than try to
-- scope the policy -- there is no property_id to scope by, and nothing in
-- the app is meant to read this table anyway.
--
-- SUPERSEDED IN PART, 30 Jul (SS-418): "no client-facing policy at all" no
-- longer describes the live database. A SELECT policy scoped to the two
-- operator accounts now exists -- see
-- 147_reconcile_work_items_select_operator.sql for what replaced this and
-- why. The revokes below still hold and were not reversed.
drop policy if exists work_items_owner_manager on work_items;

revoke all on work_items from authenticated;
revoke all on work_items from anon;

-- design_rules is a different risk class -- global, read-only, app-wide
-- design tokens (not property-specific operational history) -- and is left
-- untouched here.
