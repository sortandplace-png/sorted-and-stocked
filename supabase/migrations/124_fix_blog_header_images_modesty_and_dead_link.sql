-- 124_fix_blog_header_images_modesty_and_dead_link.sql
-- Replaces 4 header images: two for a real modesty-standards concern
-- (mixed-gender closeness / uncovered hair prominent, confirmed by direct
-- visual inspection of the actual live images), one because it was an
-- exact duplicate of another post's image, and one because its Unsplash
-- URL was a dead 404 link (confirmed via direct fetch), unrelated to the
-- modesty issue. All 4 replacements are hands-only or people-free,
-- verified by direct visual inspection before use -- new standing rule
-- for all future header images on this project.
update blog_posts
set header_image_url = case
  when slug = 'blog-06-recipes-connected-to-inventory'
    then 'https://images.unsplash.com/photo-1645567454567-901dc409551b?w=400&h=300&fit=crop'
  when slug = 'blog-05-staff-access-and-permissions'
    then 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=400&h=300&fit=crop'
  when slug = 'blog-03-training-household-staff'
    then 'https://images.unsplash.com/photo-1632180807550-5a46d458b5a9?w=400&h=300&fit=crop'
  when slug = 'blog-04-multi-property-management'
    then 'https://images.unsplash.com/photo-1743487014165-c26c868b8186?w=400&h=300&fit=crop'
  else header_image_url
end
where slug in (
  'blog-06-recipes-connected-to-inventory',
  'blog-05-staff-access-and-permissions',
  'blog-03-training-household-staff',
  'blog-04-multi-property-management'
);
