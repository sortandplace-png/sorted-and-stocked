// lib/recipe-icons.ts
// Icon fallback for recipes with no photo_url — reuses the real per-course
// icon names already in the `course_icons` table (same lucide-react library,
// not a second icon system) rather than a generic plate/fork placeholder.
// Small, stable reference table (7 rows) — hardcoded here the same way
// lib/item-icons.ts hardcodes the equally-small `categories.icon_name` set,
// rather than an extra query on every recipe list render.
import { IceCreamCone, Beef, Salad, Soup, Wheat, Carrot, Apple, UtensilsCrossed, type LucideIcon } from 'lucide-react';

const COURSE_ICONS: Record<string, LucideIcon> = {
  dessert: IceCreamCone,
  protein: Beef,
  salad: Salad,
  soup: Soup,
  starch: Wheat,
  vege: Carrot,
  kids_platter: Apple,
};

export function getRecipeIcon(course: string | null | undefined): LucideIcon {
  if (!course) return UtensilsCrossed;
  return COURSE_ICONS[course] ?? UtensilsCrossed;
}
