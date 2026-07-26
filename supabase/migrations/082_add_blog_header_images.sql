-- 082_add_blog_header_images.sql
-- Add header images to existing 7 blog posts (Unsplash CC0 licensed)
-- Updates by slug to match posts regardless of ID or creation order

update public.blog_posts
set
  header_image_url = case
    when slug = 'common-mistakes' then 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop'
    when slug = 'inventory-shopping' then 'https://images.unsplash.com/photo-1488224401892-8e15fed60ccb?w=400&h=300&fit=crop'
    when slug = 'shabbos-yom-tov' then 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
    when slug = 'staff-training' then 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop'
    when slug = 'multi-property' then 'https://images.unsplash.com/photo-1576574270253-e3ded0b7e09d?w=400&h=300&fit=crop'
    when slug = 'staff-permissions' then 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop'
    when slug = 'recipes-inventory' then 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
    else header_image_url
  end,
  header_image_alt = case
    when slug = 'common-mistakes' then 'Organized kitchen pantry with labeled containers'
    when slug = 'inventory-shopping' then 'Shopping list and groceries organized on a kitchen counter'
    when slug = 'shabbos-yom-tov' then 'Beautiful Shabbos table set with challah and candles'
    when slug = 'staff-training' then 'Kitchen staff working together in a professional kitchen'
    when slug = 'multi-property' then 'Multiple residential properties viewed from above'
    when slug = 'staff-permissions' then 'Diverse team members collaborating in a modern workspace'
    when slug = 'recipes-inventory' then 'Recipe cards with fresh ingredients arranged on a kitchen counter'
    else header_image_alt
  end
where slug in ('common-mistakes', 'inventory-shopping', 'shabbos-yom-tov', 'staff-training', 'multi-property', 'staff-permissions', 'recipes-inventory');
