// app/properties/[id]/tools/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

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
    title: 'Copycat Recipe',
    description: 'Photograph a dish, get a home-cookable recipe.',
  },
  {
    slug: 'kitchen-timer',
    icon: '⏱️',
    title: 'Kitchen Timer',
    description: 'Quick presets and a clear alarm for what\'s on the stove.',
  },
  {
    slug: 'knowledge-base',
    icon: '📚',
    title: 'Household Knowledge Base',
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
    title: 'Reset Checklists',
    description: 'Run through after Shabbos or Yom Tov.',
  },
  {
    slug: 'guest-scaler',
    icon: '🎉',
    title: 'Simcha Guest Scaler',
    description: 'Scale any recipe to how many people are actually coming.',
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
];

const TASTE_MEMORY_TOOL = {
  slug: 'taste-memory',
  icon: '👥',
  title: 'Guest & Family Taste Memory',
  description: 'Likes, dislikes, allergies, and sensitivities — kept with the person.',
};

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

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-4">Tools</h1>
      <ul className="space-y-3">
        {tools.map((tool) => (
          <li key={tool.slug}>
            <Link
              href={`/properties/${id}/tools/${tool.slug}`}
              className="flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-charcoal/5 px-4 py-3 hover:bg-gold-light/15 transition-colors"
            >
              <span className="text-2xl">{tool.icon}</span>
              <span>
                <span className="block font-display text-lg text-charcoal">{tool.title}</span>
                <span className="block text-sm text-charcoal/50">{tool.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
