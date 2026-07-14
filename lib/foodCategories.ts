// lib/foodCategories.ts
// The 16 inventory category buckets (see 027_validate_category_mapping.sql)
// split cleanly into 8 food and 8 non-food groups. Bracha and Pesach status
// are both halachic food concepts and don't apply to non-food categories
// (e.g. a Bracha field on medical tape, or a Pesach review flag on bar
// soap) — this is the single shared list both concerns key off of, no
// existing food/non-food list was found to reuse (recipe_ingredients.is_food
// is a different, per-recipe-line concept, not category-based).

export const NON_FOOD_CATEGORIES = [
  'Baby',
  'Cleaners',
  'Health & First Aid',
  'Household & Tools',
  'Laundry',
  'Paper Goods',
  'Personal Care',
  'Ritual/Judaica',
] as const;

export function isFoodCategory(category: string | null | undefined): boolean {
  return !!category && !NON_FOOD_CATEGORIES.includes(category as (typeof NON_FOOD_CATEGORIES)[number]);
}
