// lib/item-icons.ts
// Per-item-type icon fallback for when photo_url is null — one step more
// specific than the coarse per-category icon, using the same lucide-react
// library that already powers `categories.icon_name` (not a second icon
// system). Pilot: Personal Care only. If this works well, extend the same
// keyword-list pattern to other categories in a follow-up pass rather than
// building all of them at once.
//
// Same convention as lib/location-icons.ts: keyword list ordered MOST
// SPECIFIC FIRST, first match wins. Falls back to the item's category icon
// (from the real `categories.icon_name` column) when nothing matches, and to
// Package if even that's unknown.
import {
  Bandage,
  Brush,
  Droplet,
  FlaskConical,
  Glasses,
  Pill,
  Scissors,
  Sparkles,
  SprayCan,
  Sun,
  Thermometer,
  CircleDot,
  SoapDispenserDroplet,
  Package,
  Baby,
  Croissant,
  CupSoda,
  Milk,
  Snowflake,
  HeartPulse,
  Wrench,
  WashingMachine,
  Beef,
  FileText,
  Carrot,
  Flame,
  Candy,
  type LucideIcon,
} from 'lucide-react';

// Real values from the `categories.icon_name` column (16 categories as of
// July 2026) — resolves the DB's icon-name string to the actual component.
const CATEGORY_ICON_COMPONENTS: Record<string, LucideIcon> = {
  Baby,
  Croissant,
  CupSoda,
  SprayCan,
  Milk,
  Snowflake,
  HeartPulse,
  Wrench,
  WashingMachine,
  Beef,
  Package,
  FileText,
  Droplet,
  Carrot,
  Flame,
  Candy,
};

export function categoryIconComponent(categoryIconName: string | null | undefined): LucideIcon {
  if (!categoryIconName) return Package;
  return CATEGORY_ICON_COMPONENTS[categoryIconName] ?? Package;
}

// Most-specific-phrase-first — checked in this exact order against the
// lowercased item name. Branded product names (e.g. "BIC Silky Touch
// Women's Disposable Razors") are matched by the generic keyword ("razor"),
// not an exact-name dictionary, since real inventory names are too varied.
const PERSONAL_CARE_KEYWORDS: [string, LucideIcon][] = [
  ['bandage', Bandage],
  ['band-aid', Bandage],
  ['gauze', Bandage],
  ['adhesive', Bandage],
  ['thermometer', Thermometer],
  ['alcohol', FlaskConical],
  ['peroxide', FlaskConical],
  ['pill', Pill],
  ['vitamin', Pill],
  ['tablet', Pill],
  ['medicine', Pill],
  ['razor', Scissors],
  ['clipper', Scissors],
  ['contact lens', Glasses],
  ['cotton', CircleDot],
  ['swab', CircleDot],
  ['q-tip', CircleDot],
  ['soap', SoapDispenserDroplet],
  ['sunscreen', Sun],
  ['deodorant', SprayCan],
  ['antiperspirant', SprayCan],
  ['spray', SprayCan],
  ['bobby pin', Brush],
  ['hair elastic', Brush],
  ['hair tie', Brush],
  ['hairbrush', Brush],
  ['comb', Brush],
  ['towelette', Sparkles],
  ['wipe', Sparkles],
  ['makeup remover', Sparkles],
  ['toothbrush', Sparkles],
  ['toothpaste', Sparkles],
  ['dental', Sparkles],
  ['floss', Sparkles],
  ['mouthwash', Droplet],
  ['shampoo', Droplet],
  ['conditioner', Droplet],
  ['body wash', Droplet],
  ['lotion', Droplet],
  ['hand cream', Droplet],
  ['hand wash', Droplet],
  ['pad', Droplet],
  ['tampon', Droplet],
];

const KEYWORD_SETS: Record<string, [string, LucideIcon][]> = {
  'Personal Care': PERSONAL_CARE_KEYWORDS,
};

export function getItemIcon(
  name: string,
  category: string | null | undefined,
  categoryIconName: string | null | undefined
): LucideIcon {
  const keywords = category ? KEYWORD_SETS[category] : undefined;
  if (keywords) {
    const key = name.trim().toLowerCase();
    for (const [keyword, icon] of keywords) {
      if (key.includes(keyword)) return icon;
    }
  }
  return categoryIconComponent(categoryIconName);
}
