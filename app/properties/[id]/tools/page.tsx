// app/properties/[id]/tools/page.tsx
import { createClient } from '@/lib/supabase/server';
import ToolsGroupList from '@/components/ToolsGroupList';

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
  {
    slug: 'kitchen-timer',
    icon: '⏱️',
    title: 'Kitchen Timer',
    description: 'Set multiple timers at once.',
  },
  {
    slug: 'knowledge-base',
    icon: '📚',
    title: 'Household Knowledge Base',
    description: 'The answers staff and family keep asking for.',
  },
  {
    slug: 'contacts',
    icon: '📇',
    title: 'Contacts & Vendors',
    description: 'Everyone the household calls on — repairs, deliveries, help.',
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
    slug: 'photo-review',
    icon: '🖼️',
    title: 'Room Photo Review',
    description: 'Bulk-upload house photos and match each to a real room.',
  },
  {
    slug: 'takeout-directory',
    icon: '🥡',
    title: 'Local Takeout Directory',
    description: 'Restaurants and takeout near Lakewood, with hashgacha noted.',
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

// Grouped per the approved Tools Hub redesign. The design brief named ~13
// of the real 17 tools explicitly; the rest (halachic-calendar,
// prep-timeline, memory-timeline, taste-memory) are placed into whichever
// of the 4 named groups fits them best rather than left ungrouped.
// 'tasks' (Staff Task Center) removed from here -- real duplicate entry
// point, same pattern as the Handover fix. The dedicated Staff nav group
// (DesktopNav.tsx) is now the one real way in, not a second generic-grid
// tile pointing at the same /tools/tasks page.
const GROUPS: { key: string; label: string; slugs: string[] }[] = [
  { key: 'scanners', label: 'Scanners', slugs: ['price-scanner', 'ingredient-scanner', 'recipe-stealer'] },
  { key: 'kitchen-ops', label: 'Kitchen Ops', slugs: ['kitchen-timer', 'guest-scaler', 'reset-checklist', 'prep-timeline'] },
  { key: 'inventory-ops', label: 'Inventory Ops', slugs: ['pantry-zones', 'borrowed-items', 'duplicate-ingredients', 'needs-linking', 'photo-review', 'capture-inbox'] },
  {
    key: 'household',
    label: 'Household',
    slugs: ['knowledge-base', 'contacts', 'takeout-directory', 'halachic-calendar', 'memory-timeline', 'taste-memory', 'blog'],
  },
];

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('feature_flags')
    .eq('id', id)
    .single();
  const flags = (property?.feature_flags ?? {}) as Record<string, boolean>;

  const tools = flags.guest_taste_memory ? [...TOOLS, TASTE_MEMORY_TOOL] : TOOLS;
  const bySlug = new Map(tools.map((t) => [t.slug, t]));

  const groups = GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    tools: group.slugs.map((slug) => bySlug.get(slug)).filter((t): t is (typeof TOOLS)[number] => !!t),
  })).filter((group) => group.tools.length > 0);

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-4">Tools</h1>
      <ToolsGroupList propertyId={id} groups={groups} />
    </div>
  );
}
