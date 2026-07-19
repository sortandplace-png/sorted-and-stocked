-- staff_tasks.completed has been dead since migration 052's one-time
-- backfill to `status` -- confirmed via a full-codebase audit that no
-- write site anywhere sets it, and status is the real, fully-wired
-- source of truth for every task workflow (Staff Task Center board, its
-- add-task form and status dropdown, staff's own My Day list/dropdown).
-- The only remaining reader was the Dashboard's Readiness widget
-- ("X tasks done, Y left today"), which is being rewired to read
-- `status` directly in this same change (see app/properties/[id]/
-- dashboard/page.tsx's getReadinessSummary).
--
-- home_pulse_score depended on staff_tasks.completed for its task_score
-- component. That widget was already removed from the UI on 2026-07-16
-- (its scoring formula was found unreliable) -- confirmed zero remaining
-- app-code consumers of this view before dropping it (the one hit in a
-- repo-wide grep was a historical code comment, not a query).
--
-- completed_at is a separate, also-dead column (nothing writes it either
-- -- the weekly-digest edge function's "tasks completed this week" count
-- reads it but is likely always near-zero as a result). Deliberately left
-- untouched here pending a decision on whether to trigger-populate it or
-- drop it too.
drop view if exists home_pulse_score;

alter table staff_tasks drop column completed;
