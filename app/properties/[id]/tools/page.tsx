// app/properties/[id]/tools/page.tsx
import { createClient } from '@/lib/supabase/server';
import ToolsGroupList from '@/components/ToolsGroupList';
import { isJewishObservant, resolveToolForObservance } from '@/lib/observance-gating';

const TOOLS = [
  {
    slug: 'price-scanner',
    icon: '💲',
    title: 'Price Scanner',
    description: 'Photograph a product, find a cheaper equivalent.',
  },
  {
    slug: 'ingredient-scanner',
    icon: '🔬',
    title: 'Ingredient Scanner',
    description: "Photograph a label, get a plain-language, evidence-based read.",
  },
  {
    slug: 'recipe-stealer',
    icon: '🍽️',
    title: 'Recipe Scanner',
    description: 'Photograph a dish, get a home-cookable recipe.',
  },
  // SS-271: Kitchen Timer tile removed from this grid. It belongs where it
  // is used -- Recipe Detail already opens it inline as one of the Kitchen
  // Ops quick actions, so a tile here was a second door to a tool nobody
  // walks to Tools to find.
  //
  // The /tools/kitchen-timer ROUTE is untouched (R21) and still listed on
  // the Sitemap, which is the complete index rather than a curated grid.
  {
    slug: 'knowledge-base',
    icon: '📚',
    title: 'House Manual',
    description: 'The answers staff and family keep asking for.',
  },
  {
    slug: 'tasks',
    icon: '✅',
    title: 'Staff Task Center',
    description: 'What needs doing, and by whom.',
  },
  {
    slug: 'contacts',
    icon: '📇',
    title: 'Contacts & Vendors',
    description: 'Everyone the household calls on — repairs, deliveries, help.',
  },
  {
    // SS-025. Sits next to Contacts deliberately: both answer "who do we get
    // this from" -- one for people, one for stores.
    slug: 'suppliers',
    icon: '🏪',
    title: 'Suppliers',
    description: 'Every store this property buys from, and what to reorder where.',
  },
  {
    // SS-092. Owner-only (see MIN_ROLE below) -- a full data export is a
    // different class of action than the other Admin Cleanup tools it sits
    // alongside, all of which are manager-level.
    slug: 'backup',
    icon: '💾',
    title: 'Full Backup',
    description: 'Download every table this property owns as a zip.',
  },
  {
    slug: 'pantry-zones',
    icon: '🗺️',
    title: 'Pantry Zone Map',
    description: 'Where things live within each storage location.',
  },
  {
    slug: 'borrowed-items',
    icon: '🔄',
    title: 'Borrowed & Lent',
    description: "Keep track of what's out and who has it.",
  },
  {
    slug: 'reset-checklist',
    icon: '🧹',
    title: 'Reset for Next',
    description: 'Clear checklists & start fresh.',
  },
  {
    slug: 'guest-scaler',
    icon: '🎉',
    title: 'Scale Servings',
    description: 'Adjust for guests or batch size.',
  },
  {
    slug: 'needs-linking',
    icon: '🔗',
    title: 'Needs Linking',
    description: 'Ingredients that still need a real inventory link.',
  },
  {
    slug: 'duplicate-ingredients',
    icon: '🧩',
    title: 'Duplicate Ingredients',
    description: 'Same ingredient, spelled differently — merge them.',
  },
  {
    slug: 'capture-inbox',
    icon: '📥',
    title: 'Capture Inbox',
    description: 'Review submitted recipe, inventory, and meal plan captures before they go live.',
  },
  {
    slug: 'photo-worklist',
    icon: '📷',
    title: 'Photo Worklist',
    description: "Items a web search couldn't confirm — photograph what's actually on the shelf.",
  },
  {
    slug: 'takeout-directory',
    icon: '🥡',
    title: 'Local Takeout Directory',
    // Placeholder only -- replaced per property below (generated from
    // properties.city + observance; never a hardcoded town).
    description: 'Restaurants and takeout near this house.',
  },
  {
    slug: 'halachic-calendar',
    icon: '📅',
    title: 'Halachic Calendar',
    description: 'Sefiras HaOmer, Erev Pesach countdown, Bedikas Tolaim reference.',
  },
  {
    slug: 'prep-timeline',
    icon: '⏳',
    title: 'Prep Timeline',
    description: 'Working backward from when you want dinner ready.',
  },
  {
    slug: 'memory-timeline',
    icon: '🕰️',
    title: 'Home Memory Timeline',
    description: 'A running record of photos, milestones, and moments.',
  },
  {
    slug: 'yom-tov-year-view',
    icon: '🗓️',
    title: 'Yom Tov Year View',
    description: 'Every Yom Tov date on the calendar, at a glance.',
  },
  {
    slug: 'capture-photo',
    icon: '📸',
    title: 'Capture Photo',
    description: 'Snap a photo — match it to a room or item later.',
  },
  {
    slug: 'identify-item',
    icon: '🆕',
    title: 'Identify New Item',
    description: "Photograph something new — AI suggests a name, you confirm before it's added.",
  },
  {
    slug: 'link-captured-photos',
    icon: '🔗',
    title: 'Link Captured Photos',
    description: 'Match photos staff took to a real inventory item or room.',
  },
  {
    // Observance gating amendment: Jewish-only, shown IN ADDITION to the
    // universal Allergen Verification below -- not what it swaps to.
    slug: 'hechsher-verification',
    icon: '✅',
    title: 'Hechsher Verification',
    description: 'Confirm hechsher against OU/OK for every item missing one.',
  },
  {
    // Observance gating amendment: Jewish-only, shown IN ADDITION to the
    // universal Dietary Tagging below -- not what it swaps to.
    slug: 'kosher-type-tagging',
    icon: '🏷️',
    title: 'Kosher Type Tagging',
    description: 'Bulk-tag Meat/Dairy/Parve by category for items missing one.',
  },
  {
    // Universal -- all properties, always on (observance gating amendment).
    slug: 'allergen-verification',
    icon: '🛡️',
    title: 'Allergen Verification',
    description: 'Confirm the allergen list for every food item missing a reviewed one.',
  },
  {
    // Universal -- all properties, always on (observance gating amendment).
    slug: 'dietary-tagging',
    icon: '🥗',
    title: 'Dietary Tagging',
    description: 'Bulk-tag Vegan/Vegetarian/Gluten-Free by category for items missing tags.',
  },
  {
    slug: 'translation-worklist',
    icon: '🌐',
    title: 'Translation Worklist',
    description: 'Recipes, ingredients, and items still missing a Spanish name.',
  },
  {
    slug: 'digest',
    icon: '📰',
    title: 'Household Digest',
    description: "A preview of what's low and what's coming up this week.",
  },
  {
    slug: 'blog',
    icon: '📖',
    title: 'Blog & Articles',
    description: 'Household management tips, recipes, and insights.',
  },
];

const TASTE_MEMORY_TOOL = {
  slug: 'taste-memory',
  icon: '👥',
  title: 'Guest & Family Taste Memory',
  description: 'Likes, dislikes, allergies, and sensitivities — kept with the person.',
};

// Minimum role required to SEE a tile. Kept as one reviewable block rather
// than a field repeated across 29 entries -- the whole point is that someone
// can check the access rules at a glance.
//
// Anything not listed is 'staff' (visible to everyone). Filtering happens
// server-side below, so a staff member never receives manager tile data at
// all; the tile list is not merely hidden in the browser. Tile filtering is
// still only half the job -- each manager-only ROUTE needs its own guard,
// since RLS does not block most of these (Translation Worklist, for example,
// reads recipes a staff member can legitimately select).
const MIN_ROLE: Record<string, 'staff' | 'manager' | 'owner'> = {
  // Named manager-only in the spec.
  tasks: 'manager',
  'capture-inbox': 'manager',
  'needs-linking': 'manager',
  'translation-worklist': 'manager',
  'photo-worklist': 'manager',
  'duplicate-ingredients': 'manager',
  // Admin Cleanup remainder -- already hidden from staff by the subgroup's
  // lockIcon + canManage() check, listed here so the rule is stated once and
  // does not depend on that subgroup never being restructured.
  'link-captured-photos': 'manager',
  'hechsher-verification': 'manager',
  'kosher-type-tagging': 'manager',
  // The universal pair sits in the same Admin Cleanup subgroup as its
  // Jewish-only siblings, so it carries the same tier.
  'allergen-verification': 'manager',
  'dietary-tagging': 'manager',
  // Household-wide operational summary, not a shift tool.
  digest: 'manager',
  // SS-025 fix: the page itself already redirects staff away
  // (app/properties/[id]/tools/suppliers/page.tsx), but this tile-visibility
  // list is separate from that page-level gate -- without an entry here the
  // tile still showed for staff, who would then click through to a redirect.
  suppliers: 'manager',
  // Third-party health data (guest allergies and sensitivities) and family
  // photos/milestones. Neither is a work tool -- confirmed by the owner.
  'taste-memory': 'manager',
  'memory-timeline': 'manager',
  // SS-092. A stricter third tier than 'manager' -- a full data export is a
  // different class of action than assigning a task, and the page/route
  // both enforce role === 'owner' exactly, not manager. Without a real
  // 'owner' tier here, a manager would have seen this tile and hit the same
  // dead-click-then-redirect the Suppliers fix above exists to prevent.
  backup: 'owner',
};

function canSeeTile(slug: string, role: string): boolean {
  const need = MIN_ROLE[slug];
  if (need === 'owner') return role === 'owner';
  if (need === 'manager') return role === 'owner' || role === 'manager';
  return true;
}

// Grouped per the finalized nav restructure spec (2026-07-14): Kitchen and
// House each keep their existing loose items and gain named subgroups so
// the previously-unplaced pages (Prep Timeline, Yom Tov Year View, Pantry
// Zone Map, Borrowed & Lent, Duplicate Ingredients, Needs Linking, Room
// Photo Review, Bulk Photo Upload) all get a real home. Inventory Ops fully
// dissolves into House's three new subgroups — every one of its items moved,
// none left loose. Halachic Calendar moved out of Household into Kitchen's
// new Calendar subgroup, next to the new Yom Tov Year View entry.
const GROUPS: {
  key: string;
  label: string;
  slugs: string[];
  subgroups?: { key: string; label: string; slugs: string[]; lockIcon?: boolean }[];
}[] = [
  { key: 'scanners', label: 'Scanners', slugs: ['price-scanner', 'ingredient-scanner', 'recipe-stealer'] },
  {
    key: 'kitchen',
    label: 'Kitchen',
    slugs: ['kitchen-timer', 'guest-scaler'],
    subgroups: [
      { key: 'prep-reset', label: 'Prep & Reset', slugs: ['prep-timeline', 'reset-checklist'] },
      { key: 'calendar', label: 'Calendar', slugs: ['halachic-calendar', 'yom-tov-year-view'] },
    ],
  },
  {
    key: 'house',
    label: 'House',
    // memory-timeline hidden pending a build-or-kill decision (SS-037/
    // SS-096) -- no backing table, currently live/clickable but goes
    // nowhere. Route and component left in place; don't "restore" this
    // without resolving that decision first.
    //
    // 'tasks' (Staff Task Center) removed from this group per the ONE
    // Task Center ruling: the Staff sheet's Task Center entry is the
    // single door; this card was the duplicate. Route, TOOLS entry and
    // MIN_ROLE line all stay -- only the House tile is gone.
    slugs: ['takeout-directory', 'taste-memory', 'blog'],
    subgroups: [
      // Location-based pair first (House Manual, Pantry Zone Map), then the
      // people/contact-based pair (Contacts & Vendors, Borrowed & Lent).
      {
        key: 'reference',
        label: 'Reference',
        // SS-025 fix: 'suppliers' existed in the flat TOOLS list (and
        // passed canSeeTile) but was in no GROUPS slugs array anywhere --
        // groups is built by mapping THIS array, so a slug absent from
        // every subgroup here never renders a tile regardless of whether
        // it exists in TOOLS. Placed next to 'contacts' per that entry's
        // own comment: both answer "who do we get this from," one for
        // people, one for stores.
        slugs: ['knowledge-base', 'pantry-zones', 'contacts', 'suppliers', 'borrowed-items', 'digest'],
      },
      { key: 'capture-tools', label: 'Capture Tools', slugs: ['capture-inbox', 'capture-photo', 'identify-item', 'photo-worklist'] },
      {
        key: 'admin-cleanup',
        label: 'Admin Cleanup',
        // hechsher-verification / kosher-type-tagging are Jewish-only
        // (filtered out below on a property without the jewish calendar
        // layer); allergen-verification / dietary-tagging are universal
        // and sit beside them, each pair adjacent so the kashrut tool and
        // its everyone-equivalent read as siblings, not alternatives.
        slugs: ['duplicate-ingredients', 'needs-linking', 'link-captured-photos', 'hechsher-verification', 'allergen-verification', 'kosher-type-tagging', 'dietary-tagging', 'translation-worklist', 'backup'],
        lockIcon: true,
      },
    ],
  },
];

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase
        .from('property_members')
        .select('role')
        .eq('property_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };
  // Unknown role is treated as the least privileged, not the most.
  const role = membership?.role ?? 'staff';

  const { data: property } = await supabase
    .from('properties')
    // calendar_layers is the observance axis (SS-469) -- the same one the
    // month grid and Yom Tov Year View already key off, not a second flag.
    // city feeds the generated Local Takeout Directory subtitle.
    .select('feature_flags, calendar_layers, city')
    .eq('id', id)
    .single();
  const flags = (property?.feature_flags ?? {}) as Record<string, boolean>;
  const jewish = isJewishObservant(property?.calendar_layers as string[] | null | undefined);

  const { count: knowledgeCount } = await supabase
    .from('household_knowledge')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', id)
    // Must match what the page actually renders (SS-240). Counting all rows
    // here while the page filters to audience='staff' would put "36" on the
    // tile and show 17 inside it.
    .eq('audience', 'staff');

  const tools = (flags.guest_taste_memory ? [...TOOLS, TASTE_MEMORY_TOOL] : TOOLS)
    .filter((t) => canSeeTile(t.slug, role))
    // Suppliers is operator-level, not per-house (Racquel, 30 Jul): who the
    // operation buys from is one business-wide directory, not a copy each
    // client's house keeps. Its own route enforces the same gate.
    .filter((t) => t.slug !== 'suppliers' || flags.operator_console === true)
    .map((t) => (t.slug === 'knowledge-base' ? { ...t, count: knowledgeCount ?? 0 } : t))
    // Generated, never hardcoded: the directory tile names the property's
    // own city, mentions hashgacha only for an observant household, and
    // turns into the add-your-places CTA when no city is on file.
    .map((t) =>
      t.slug === 'takeout-directory'
        ? {
            ...t,
            description: property?.city
              ? `Restaurants and takeout near ${property.city}${jewish ? ', with hashgacha noted.' : '.'}`
              : 'Add the places this house orders from.',
          }
        : t
    );
  // Observance gating (amended table -- lib/observance-gating.ts is the
  // one place the rules live). Keyed by the ORIGINAL slug so the static
  // GROUPS arrays keep resolving even when the stored tile is the neutral
  // swap (halachic-calendar's grid position holds Seasonal & Home Prep on
  // a non-Jewish property). A Jewish-only tool on a non-Jewish property
  // resolves to null and never lands in the map, so the existing
  // filter(!!t) below drops it exactly like a role-filtered tile.
  const bySlug = new Map(
    tools.flatMap((t) => {
      const resolved = resolveToolForObservance(t, jewish);
      return resolved ? ([[t.slug, resolved]] as const) : [];
    })
  );

  const groups = GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    tools: group.slugs.map((slug) => bySlug.get(slug)).filter((t): t is (typeof TOOLS)[number] => !!t),
    subgroups: (group.subgroups ?? [])
      .map((sg) => ({
        key: sg.key,
        label: sg.label,
        lockIcon: !!sg.lockIcon,
        tools: sg.slugs.map((slug) => bySlug.get(slug)).filter((t): t is (typeof TOOLS)[number] => !!t),
      }))
      .filter((sg) => sg.tools.length > 0),
  })).filter((group) => group.tools.length > 0 || group.subgroups.length > 0);

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-4">Tools</h1>
      <ToolsGroupList propertyId={id} groups={groups} />
    </div>
  );
}
