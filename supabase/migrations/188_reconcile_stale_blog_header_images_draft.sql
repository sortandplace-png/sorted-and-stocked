-- 188_reconcile_stale_blog_header_images_draft.sql
-- Reconciliation, not a functional change. A file named
-- 124_blog_header_images.sql existed only on one laptop's disk (a stale
-- checkout at C:\dev\sorted-and-stocked-files, last committed 23 Jul,
-- never pushed) -- 404 on origin/main, one disk failure from gone. R21
-- says preserve rather than discard, so its intent is recorded here even
-- though its effect is not needed.
--
-- That file's job -- backfill header_image_url on the 7 original blog
-- posts by slug -- was already done, better, by two real committed
-- migrations three days before this reconciliation was written:
--   082_add_blog_header_images.sql (20260726111026, the original backfill,
--     old short-slug scheme: common-mistakes, inventory-shopping, etc.)
--   124_fix_blog_header_images_modesty_and_dead_link.sql (20260726133756,
--     same day, replaced 4 of those 7 images for a real modesty concern
--     found on direct visual inspection, plus one dead Unsplash link --
--     this is the origin of the hands-only/people-free standing rule for
--     all header imagery on this project).
--
-- The stale draft's own image picks are not merely redundant, they include
-- at least one (blog-03-training-household-staff) that the modesty fix
-- above deliberately moved away from. Applying the stale draft's URLs today
-- would not just be a no-op, it would regress a considered image choice.
--
-- `where header_image_url is null` makes this a true no-op against the
-- live database (all 7 rows have had a real header_image_url since 26
-- Jul) and keeps it inert if ever replayed against a fresh environment
-- seeded before 082/124 ran, without being able to undo either of them.
update public.blog_posts
set header_image_url = case
  when slug = 'blog-01-household-management-mistakes' then 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop'
  when slug = 'blog-02-shabbos-yom-tov-preparation' then 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
  when slug = 'blog-03-training-household-staff' then 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop'
  when slug = 'blog-04-multi-property-management' then 'https://images.unsplash.com/photo-1576574270253-e3ded0b7e09d?w=400&h=300&fit=crop'
  when slug = 'blog-05-staff-access-and-permissions' then 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop'
  when slug = 'blog-06-recipes-connected-to-inventory' then 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
  when slug = 'blog-07-inventory-and-shopping' then 'https://images.unsplash.com/photo-1488224401892-8e15fed60ccb?w=400&h=300&fit=crop'
  else header_image_url
end
where slug in (
  'blog-01-household-management-mistakes',
  'blog-02-shabbos-yom-tov-preparation',
  'blog-03-training-household-staff',
  'blog-04-multi-property-management',
  'blog-05-staff-access-and-permissions',
  'blog-06-recipes-connected-to-inventory',
  'blog-07-inventory-and-shopping'
)
and header_image_url is null;
