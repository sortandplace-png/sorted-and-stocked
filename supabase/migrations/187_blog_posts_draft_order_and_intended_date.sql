-- 187_blog_posts_draft_order_and_intended_date.sql
-- Applied live 4 Aug 2026; repo copy written after the fact.

-- SS-667: the Drafts page needs to say what a draft is DRAFTED FOR.
-- published_at is null on every draft by definition, so it cannot answer
-- that, and no existing column can.
--
-- Racquel's ruling: order, with a manual override. Two columns, because
-- they answer two different questions and collapsing them loses one:
--
--   draft_order            where this draft sits in the queue. Cheap to
--                          change -- reordering is the common operation.
--   intended_publish_date  a date PINNED by hand. When set it wins, and
--                          the derived dates flow around it.
--
-- Both nullable. A draft with neither is unscheduled, which is a real and
-- common state, not an error -- 32 drafts exist today and none has ever
-- carried a date.
--
-- The derived date is deliberately NOT stored. A stored derivation goes
-- stale the moment anything above it moves, and then two columns disagree
-- about the same fact. The queue position and the pins are the inputs; the
-- date a reader sees is computed at render.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS draft_order integer,
  ADD COLUMN IF NOT EXISTS intended_publish_date date;

COMMENT ON COLUMN public.blog_posts.draft_order IS
  'SS-667: position in the drafting queue. NULL = unscheduled. Derived dates are computed from this at render, never stored.';
COMMENT ON COLUMN public.blog_posts.intended_publish_date IS
  'SS-667: a hand-pinned intended date. When set it overrides the date derived from draft_order.';

-- Partial index: the Drafts page only ever orders the unpublished rows.
CREATE INDEX IF NOT EXISTS blog_posts_draft_order_idx
  ON public.blog_posts (draft_order)
  WHERE published_at IS NULL;
