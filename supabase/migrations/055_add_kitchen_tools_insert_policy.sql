-- Missing since the table was created -- RecipeKitchenTools.tsx's
-- self-expanding-dictionary upsert was silently blocked by RLS (no INSERT
-- policy existed at all), confirmed live: a new tool name saved onto a
-- recipe's equipment array but never made it into kitchen_tools. Any
-- authenticated user can propose a new canonical tool name, same
-- permissiveness as the existing read policy -- this is a shared,
-- growing vocabulary (like categories/bracha_categories), not
-- property-scoped data, so it isn't gated by property membership.
create policy "authenticated users can add kitchen_tools" on kitchen_tools
  for insert to authenticated with check (true);
