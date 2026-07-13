-- Marks recipe photos sourced via AI generation rather than a real photo of
-- the dish (manual upload, e.g. family photo or licensed source). Kept as
-- its own column rather than folded into notes, since notes already carries
-- multiple unrelated signals (raw-instructions leftovers, source citations,
-- content-provenance markers) and photo provenance is a distinct axis from
-- recipe-content provenance.
alter table recipes add column if not exists photo_is_ai_generated boolean not null default false;
