-- 152_help_articles_active_flag.sql
-- Racquel 31 Jul (via the coordinating session): help_articles gets an
-- active flag, and the ten articles Claude tagged SUPERSEDED-DUPLICATE in
-- keywords go inactive -- Staff & Permissions drops from 38 listed articles
-- to 28 with zero content lost. R21: never delete; this is the soft path.
-- The three help read paths (public /help, property /help, staff handbook)
-- filter on active = true in the same commit -- the column does nothing by
-- itself.

alter table help_articles add column active boolean not null default true;

update help_articles set active = false where 'SUPERSEDED-DUPLICATE' = any(keywords);
