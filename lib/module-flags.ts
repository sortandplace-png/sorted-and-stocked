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

/** Operator-level surfaces -- the cross-house console and the Suppliers
 *  directory -- belong to ONE property that acts as the operator's console,
 *  not to every house. Showing a cross-house view inside an individual
 *  house is conceptually wrong, and becomes visibly wrong once white-label
 *  clients each have their own single house.
 *
 *  Opt-IN, unlike the module_* flags: absent means OFF here. A module flag
 *  defaults on because every house should have inventory unless told
 *  otherwise; a console defaults off because only one property should ever
 *  be one, and a new client's property must never silently become an
 *  operator console. */
export function isOperatorConsole(flags: Record<string, unknown> | null | undefined): boolean {
  return flags?.operator_console === true;
}

// Longest-prefix-wins route -> module map, so a route nested under a more
// generic segment (tools/tasks under tools/) can still resolve to a more
// specific module than its parent. Mirrors how DesktopNav.tsx and
// app/properties/[id]/sitemap/page.tsx already group these same routes
// (Staff Task Center, Duty Roster, Reset for Next and Task Verification all
// live under /tools/* by URL but are presented as Staff destinations, not
// Tools ones) -- this list is the same grouping, not a new one. Room Photo
// Review no longer has an entry here at all -- folded into Inventory as a
// bulk action, no standalone route left to gate.
const ROUTE_MODULES: { prefix: string; module: ModuleKey }[] = [
  { prefix: 'tools/tasks', module: 'module_staff' },
  { prefix: 'tools/duty-roster', module: 'module_staff' },
  { prefix: 'tools/reset-checklist', module: 'module_staff' },
  { prefix: 'tools/task-verification', module: 'module_staff' },
  { prefix: 'tools', module: 'module_tools' },
  { prefix: 'recipes', module: 'module_recipes' },
  { prefix: 'meal-plan', module: 'module_meal_plan' },
  { prefix: 'shopping-list', module: 'module_shopping' },
  { prefix: 'batch-operations', module: 'module_shopping' },
  { prefix: 'inventory', module: 'module_inventory' },
  { prefix: 'all-houses', module: 'module_inventory' },
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

// SS-856, supersedes SS-410. SS-410 gated these one page at a time and
// closed after ONE of five surfaces actually shipped -- four were lost for
// eight days because nothing forced a route added later to remember the
// check. This is the rule stated once, centrally: a surface is an OPERATOR
// surface (renders only on the one property carrying
// feature_flags.operator_console -- Lax today) or a RESIDENCE surface
// (renders on every property, client houses included). Enforced in
// app/properties/[id]/layout.tsx, which runs before every nested page --
// a route added tomorrow inherits the gate without anyone remembering to
// add it. The per-page isOperatorConsole checks already on these routes
// (console, register, tools/tasks, tools/suppliers, tools/translation-
// worklist, tools/needs-linking, tools/duplicate-ingredients, all-houses,
// staff/clip-review) are left in place as belt-and-braces, same pattern as
// SS-681's force-dynamic -- this list is what makes the guarantee
// EXPLICIT and closes the gap for whatever forgets its own check next.
//
// Prefix match, same convention as ROUTE_MODULES above: 'tools/tasks'
// matches before the (absent) bare 'tools' prefix, since Tools itself is a
// residence surface -- individual per-house tools (House Manual, Pantry
// Zone Map, Reset for Next, and the rest) stay reachable on client houses;
// only the operator-only tiles inside that grid are the leak.
export const OPERATOR_ONLY_SEGMENTS = [
  'console',
  'register',
  'staff/clip-review',
  'tools/tasks',
  // NOT tools/duty-roster -- that's DutyRosterEditor.tsx, the per-property
  // staff_duty_templates admin table (each house's own duties, no cross-
  // house content, no gate today, correctly ungated). staff/duty-roster
  // below is the unrelated bookmark-compat mount of the cross-house Task
  // Center (DutyRosterClient.tsx via /tools/tasks) -- same component,
  // same gate, different route someone might still have saved.
  'staff/duty-roster',
  'tools/suppliers',
  'tools/translation-worklist',
  'tools/needs-linking',
  'tools/duplicate-ingredients',
  'all-houses',
] as const;

export function isOperatorOnlySegment(segment: string): boolean {
  return OPERATOR_ONLY_SEGMENTS.some((s) => segment === s || segment.startsWith(`${s}/`));
}
