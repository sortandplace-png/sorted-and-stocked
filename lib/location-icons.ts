// lib/location-icons.ts
// Icon per storage location, gold (#C5A46D), for the inventory room grid.
//
// Matching order matters: exact name first (case-insensitive), then a
// keyword fallback list ordered MOST SPECIFIC FIRST — e.g. "master bath"
// must be checked before the generic "bath" rule, or every bathroom would
// resolve to whichever bath-related entry happens to appear first.
import {
  Archive,
  Bath,
  Bed,
  Briefcase,
  Building2,
  Carrot,
  ChefHat,
  Home,
  Package,
  Refrigerator,
  Snowflake,
  WashingMachine,
  Wine,
  type LucideIcon,
} from 'lucide-react';

const EXACT_MATCHES: Record<string, LucideIcon> = {
  'basement': Building2,
  'basement bath 1': Bath,
  'basement bath 2': Bath,
  'basement bath 3': Bath,
  'beverage bin': Package,
  'beverage drawer': Archive,
  'beverage fridge': Refrigerator,
  'wine fridge': Wine,
  'main floor': Home,
  'main floor bath': Bath,
  'office / supply': Briefcase,
  'kitchen': ChefHat,
  'kitchen cabinet': Archive,
  'kitchen drawer': Archive,
  'kitchen pantry': Package,
  'refrigerator': Refrigerator,
  'produce bin': Carrot,
  'freezer - kitchen': Snowflake,
  'pesach kitchen': ChefHat,
  'freezer - pesach': Snowflake,
  'supply cabinet': Archive,
  'upstairs': Building2,
  'master bath': Bath,
  'boys bath': Bath,
  'girls bath': Bath,
  'laundry room': WashingMachine,
  'bedroom': Bed,
  'master bedroom': Bed,
  'basement bedroom': Bed,
  "racheli's room": Bed,
};

// Most specific phrase first — checked in this exact order.
const KEYWORD_FALLBACKS: [string, LucideIcon][] = [
  ['master bath', Bath],
  ['boys bath', Bath],
  ['girls bath', Bath],
  ['main floor bath', Bath],
  ['basement bath', Bath],
  ['wine fridge', Wine],
  ['wine', Wine],
  ['freezer', Snowflake],
  ['fridge', Refrigerator],
  ['refrigerator', Refrigerator],
  ['produce', Carrot],
  ['pantry', Package],
  ['cabinet', Archive],
  ['drawer', Archive],
  ['laundry', WashingMachine],
  ['office', Briefcase],
  ['supply', Archive],
  ['kitchen', ChefHat],
  ['bath', Bath],
  ['basement', Building2],
  ['upstairs', Building2],
  ['floor', Home],
];

export function getLocationIcon(name: string): LucideIcon {
  const key = name.trim().toLowerCase();
  if (EXACT_MATCHES[key]) return EXACT_MATCHES[key];
  for (const [keyword, icon] of KEYWORD_FALLBACKS) {
    if (key.includes(keyword)) return icon;
  }
  return Package;
}
