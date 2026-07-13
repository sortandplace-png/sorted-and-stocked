// lib/icon-maps.ts
// Small shared lookup tables so icon choices are consistent everywhere
// instead of ad-hoc per component. Matches the real category names in the
// live `categories` table (19 as of July 2026) and the real kosher_type
// values in `recipes`.

export const CATEGORY_ICONS: Record<string, string> = {
  Baby: '🍼',
  Baking: '🧁',
  Bathroom: '🧻',
  Beverages: '🥤',
  Cleaning: '🧴',
  Electronics: '🔌',
  Freezer: '🧊',
  Holiday: '🎉',
  Kitchen: '🍳',
  Laundry: '🧺',
  Medicine: '💊',
  Office: '🖇️',
  Pantry: '🥫',
  'Paper Goods': '🧻',
  'Pet Supplies': '🐾',
  Refrigerator: '🧀',
  Snacks: '🍪',
  Storage: '📦',
  Tools: '🔧',
};

export function categoryIcon(category: string | null | undefined): string {
  if (!category) return '📦';
  return CATEGORY_ICONS[category] ?? '📦';
}

export const KOSHER_ICONS: Record<string, string> = {
  Meat: '🥩',
  Dairy: '🧀',
  Parve: '🌿',
};

export function kosherIcon(kosherType: string | null | undefined): string {
  if (!kosherType) return '';
  return KOSHER_ICONS[kosherType] ?? '';
}
