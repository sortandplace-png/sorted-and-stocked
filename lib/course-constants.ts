// lib/course-constants.ts
// Shared between MealPlanClient and NewRecipeModal so both course pickers
// stay in sync — this is the definitive list of course values recipes can
// carry (matches the `course` column's actual values).
export type Course = 'soup' | 'protein' | 'starch' | 'vege' | 'salad' | 'dessert' | 'kids_platter' | 'dip';

export const COURSES: { key: Course; label: string; icon: string }[] = [
  { key: 'soup', label: 'Soup', icon: '🥣' },
  { key: 'protein', label: 'Protein', icon: '🍗' },
  { key: 'starch', label: 'Starch', icon: '🍚' },
  { key: 'vege', label: 'Vege', icon: '🥦' },
  { key: 'salad', label: 'Salad', icon: '🥗' },
  { key: 'dessert', label: 'Dessert', icon: '🍰' },
  { key: 'kids_platter', label: 'Kids Platter', icon: '🍎' },
  { key: 'dip', label: 'Dip', icon: '🫙' },
];
