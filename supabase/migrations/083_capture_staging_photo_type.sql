-- Redesigned capture flow: staff take a photo with zero form/matching at
-- capture time (open camera, snap, done) -- the "which room/item is this"
-- decision moves entirely to a later review pass (Admin Cleanup's new Link
-- Captured Photos tool). The existing 'inventory' capture type's Approve
-- path creates a brand-new inventory_items row from a name/category
-- payload -- wrong behavior for a photo meant to attach to an EXISTING
-- item, hence a real new type rather than overloading 'inventory'.
alter table public.capture_staging drop constraint capture_staging_capture_type_check;
alter table public.capture_staging add constraint capture_staging_capture_type_check
  check (capture_type = any (array['recipe', 'inventory', 'meal_plan', 'photo']::text[]));
