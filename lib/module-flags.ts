// lib/module-flags.ts
// Property-level "turn off this whole area of the app" switches -- reuses
// the same properties.feature_flags jsonb column already holding
// prep_ahead_assistant/pesach_mode/auto_restock_eligible (see
// app/properties/[id]/dashboard/page.tsx's getPrepAheadEnabled and
// app/properties/[id]/tools/page.tsx), not a new column. Same default-true
// convention as those: an absent key means "on," only an explicit `false`
// turns a module off, so every existing property (none of which have ever
// set any of these six keys) is unaffected until someone opts in to hiding
// something.
export type ModuleKey =
  | 'module_inventory'
  | 'module_shopping'
  | 'module_recipes'
  | 'module_meal_plan'
  | 'module_staff'
  | 'module_tools';

export const MODULE_KEYS: ModuleKey[] = [
  'module_inventory',
  'module_shopping',
  'module_recipes',
  'module_meal_plan',
  'module_staff',
  'module_tools',
];

export function isModuleEnabled(flags: Record<string, unknown> | null | undefined, module: ModuleKey): boolean {
  return flags?.[module] !== false;
}

// Longest-prefix-wins route -> module map, so a route nested under a more
// generic segment (tools/tasks under tools/) can still resolve to a more
// specific module than its parent. Mirrors how DesktopNav.tsx and
// app/properties/[id]/sitemap/page.tsx already group these same routes
// (Staff Task Center, Duty Roster, Reset for Next and Task Verification all
// live under /tools/* by URL but are presented as Staff destinations, not
// Tools ones; Room Photo Review is presented as an Inventory-ops tool, not
// a generic Tools one) -- this list is the same grouping, not a new one.
const ROUTE_MODULES: { prefix: string; module: ModuleKey }[] = [
  { prefix: 'tools/tasks', module: 'module_staff' },
  { prefix: 'tools/duty-roster', module: 'module_staff' },
  { prefix: 'tools/reset-checklist', module: 'module_staff' },
  { prefix: 'tools/task-verification', module: 'module_staff' },
  { prefix: 'tools/photo-review', module: 'module_inventory' },
  { prefix: 'tools', module: 'module_tools' },
  { prefix: 'recipes', module: 'module_recipes' },
  { prefix: 'meal-plan', module: 'module_meal_plan' },
  { prefix: 'shopping-list', module: 'module_shopping' },
  { prefix: 'batch-operations', module: 'module_shopping' },
  { prefix: 'inventory', module: 'module_inventory' },
  { prefix: 'print-labels', module: 'module_inventory' },
  { prefix: 'scan', module: 'module_inventory' },
  { prefix: 'bulk-photos', module: 'module_inventory' },
  { prefix: 'my-day', module: 'module_staff' },
  { prefix: 'shift-handover', module: 'module_staff' },
  { prefix: 'staff', module: 'module_staff' },
];
ROUTE_MODULES.sort((a, b) => b.prefix.length - a.prefix.length);

// dashboard, settings, help, sitemap, blog, yom-tov and the property root
// itself are deliberately absent -- always reachable regardless of module
// flags, same as the nav treats them (never gated in DesktopNav/
// MobileBottomNav either).
export function moduleForSegment(segment: string): ModuleKey | null {
  const match = ROUTE_MODULES.find((r) => segment === r.prefix || segment.startsWith(`${r.prefix}/`));
  return match?.module ?? null;
}
