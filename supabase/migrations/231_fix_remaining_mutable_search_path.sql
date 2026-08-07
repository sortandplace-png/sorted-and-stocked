-- 231_fix_remaining_mutable_search_path.sql
-- Applied live 6 Aug 2026.
--
-- Racquel: "Three pre-existing functions plus the new check_security_
-- hardening_on_ddl still have mutable search_path. The checker should
-- pass its own check." Verified live before fixing: the audit query
-- also surfaces ~26 pg_trgm extension functions (gin_extract_query_trgm,
-- gtrgm_*, similarity*, word_similarity*, set_limit, show_limit,
-- show_trgm) -- those are extension-owned, not application code, and
-- are deliberately left untouched here.
--
-- Fixed via lightweight ALTER, no body changes:
--   check_security_hardening_on_ddl -- the checker itself.
--   blog_posts_touch_updated_at -- pre-existing trigger function
--     (migration 185), predates tonight's work, never caught until now.
--   is_inventory_item_low -- pre-existing (migration 158, "single
--     definition of low stock"), same gap.
--   next_work_item_id -- pre-existing register ID generator, same gap.
--
-- Verified after: re-running the same audit query, filtered to exclude
-- the pg_trgm functions, returns zero rows.
alter function public.check_security_hardening_on_ddl() set search_path = public;
alter function public.blog_posts_touch_updated_at() set search_path = public;
alter function public.is_inventory_item_low(inventory_items) set search_path = public;
alter function public.next_work_item_id() set search_path = public;
