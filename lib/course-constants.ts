// lib/course-constants.ts
// Shared between MealPlanClient and NewRecipeModal so both course pickers
// stay in sync — this is the definitive list of course values recipes can
// carry (matches the `course` column's actual values).
export type Course = 'soup' | 'protein' | 'starch' | 'vege' | 'salad' | 'dessert' | 'kids_platter' | 'dip';

// Order is deliberate, not alphabetical/schema order: Dip first (served
// before everything else at the table), then Kids Platter, then the
// everyday courses, with Dessert last since it skews Shabbos-associated
// rather than everyday-meal.
export const COURSES: { key: Course; label: string; icon: string }[] = [
  { key: 'dip', label: 'Dip', icon: '🫙' },
  { key: 'kids_platter', label: 'Kids Platter', icon: '🍎' },
  { key: 'soup', label: 'Soup', icon: '🥣' },
  { key: 'protein', label: 'Protein', icon: '🍗' },
  { key: 'starch', label: 'Starch', icon: '🌾' },
  { key: 'vege', label: 'Vege', icon: '🥕' },
  { key: 'salad', label: 'Salad', icon: '🥗' },
  { key: 'dessert', label: 'Dessert', icon: '🧁' },
];
