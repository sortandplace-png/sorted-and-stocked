// app/properties/[id]/sitemap/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Pin from '@/components/PinAccent';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  ShoppingCart,
  Package,
  Tag,
  Users,
  RotateCcw,
  Scan,
  ChefHat,
  Timer,
  Scale,
  ListChecks,
  MapPin,
  ArrowLeftRight,
  Copy,
  Link2,
  Inbox,
  BookMarked,
  ClipboardList,
  Contact,
  UtensilsCrossed,
  Heart,
  ImagePlus,
  Layers,
  CalendarRange,
  ListTodo,
  Store,
  DatabaseBackup,
  CheckCircle2,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';

type Entry = { href: string; label: string; subtitle: string; icon: LucideIcon };
type Section = { label: string; entries: Entry[] };

// Mirrors the real nav structure this app already uses -- Dashboard / Plan
// / Shop / Staff (see components/nav/DesktopNav.tsx) plus the 4 real Tools
// Hub groups (see app/properties/[id]/tools/page.tsx's GROUPS) -- rather
// than inventing a new organization scheme for this page alone.
//
// Halachic Calendar was dropped from the "Tools — Household" group here --
// confirmed via a full app/ route inventory that /tools/halachic-calendar
// has no page.tsx, only the API route behind it (it's opened as a modal
// from elsewhere, not a standalone page). Linking to it from an index page
// whose whole point is "every real page in the app" would be a dead link.
function buildSections(propertyId: string): Section[] {
  const p = (path: string) => `/properties/${propertyId}${path}`;
  return [
    {
      label: 'Dashboard',
      entries: [
        { href: p('/dashboard'), label: 'Dashboard', subtitle: 'Home overview', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Plan',
      entries: [
        { href: p('/recipes'), label: 'Recipes', subtitle: 'Your recipe collection', icon: BookOpen },
        { href: p('/meal-plan'), label: 'Meal Plan', subtitle: "This week's menu", icon: Calendar },
      ],
    },
    {
      label: 'Shop',
      entries: [
        { href: p('/shopping-list'), label: 'Shopping List', subtitle: 'View & edit', icon: ShoppingCart },
        { href: p('/inventory'), label: 'Inventory', subtitle: 'Browse by room', icon: Package },
        { href: p('/print-labels'), label: 'Print Labels', subtitle: 'Label printing', icon: Tag },
      ],
    },
    {
      label: 'Staff',
      entries: [
        { href: p('/my-day'), label: 'My Day', subtitle: "Staff member's home", icon: LayoutDashboard },
        { href: p('/tools/tasks'), label: 'Staff Task Center', subtitle: 'Assigned tasks', icon: ClipboardList },
        { href: p('/staff'), label: 'Staff', subtitle: 'Team & roles', icon: Users },
        { href: p('/shift-handover'), label: 'Shift Handover', subtitle: 'Pass the baton', icon: RotateCcw },
        { href: p('/tools/reset-checklist'), label: 'Reset for Next', subtitle: 'Post-use checklist', icon: RotateCcw },
        { href: p('/tools/duty-roster'), label: 'Duty Roster', subtitle: 'Edit staff duties', icon: ListTodo },
        // SS-269. Owner/manager only, like Duty Roster above -- the page
        // redirects staff, so this line is a signpost for the people who
        // can actually open it.
        { href: p('/tools/task-verification'), label: 'Task Verification', subtitle: 'Review completions & photos', icon: CheckCircle2 },
      ],
    },
    {
      label: 'Tools — Scanners',
      entries: [
        { href: p('/tools/price-scanner'), label: 'Price Scanner', subtitle: 'Compare prices', icon: Scan },
        { href: p('/tools/ingredient-scanner'), label: 'Ingredient Scanner', subtitle: 'Check a label', icon: Scan },
        { href: p('/tools/recipe-stealer'), label: 'Recipe Scanner', subtitle: 'Recreate a dish', icon: ChefHat },
      ],
    },
    {
      label: 'Tools — Kitchen Ops',
      entries: [
        { href: p('/tools/kitchen-timer'), label: 'Kitchen Timer', subtitle: 'Multiple timers', icon: Timer },
        { href: p('/tools/guest-scaler'), label: 'Scale Servings', subtitle: 'Adjust a recipe', icon: Scale },
        { href: p('/tools/prep-timeline'), label: 'Prep Timeline', subtitle: 'Freezer-ahead plan', icon: ListChecks },
      ],
    },
    {
      label: 'Tools — Inventory Ops',
      entries: [
        { href: p('/tools/pantry-zones'), label: 'Pantry Zone Map', subtitle: 'Where things live', icon: MapPin },
        { href: p('/tools/borrowed-items'), label: 'Borrowed & Lent', subtitle: 'Track loaned items', icon: ArrowLeftRight },
        { href: p('/tools/duplicate-ingredients'), label: 'Duplicate Ingredients', subtitle: 'Find overlaps', icon: Copy },
        { href: p('/tools/needs-linking'), label: 'Needs Linking', subtitle: 'Unmatched items', icon: Link2 },
        { href: p('/tools/capture-inbox'), label: 'Capture Inbox', subtitle: 'Pending approvals', icon: Inbox },
        // SS-025. Owner/manager only, like the Duty Roster entry above --
        // the page redirects staff, so this line is a signpost for the
        // people who can actually open it.
        { href: p('/tools/suppliers'), label: 'Suppliers', subtitle: 'Stores & reorder links', icon: Store },
        // SS-092. Owner-only, stricter than the manager gate everything
        // else on this page uses -- the page itself redirects anyone who
        // is not the owner, so this line is a signpost for the one role
        // that can actually open it.
        { href: p('/tools/backup'), label: 'Full Backup', subtitle: 'Export everything, owner only', icon: DatabaseBackup },
      ],
    },
    {
      label: 'Tools — Household',
      // Home Memory Timeline (memory-timeline) hidden pending a
      // build-or-kill decision (SS-318/SS-096) -- no backing table. Don't
      // "restore" this entry without resolving that decision first.
      entries: [
        // SS-143: the slug is still knowledge-base, but every surface that
        // names this thing calls it the House Manual -- the tile on /tools,
        // the page's own h1, staffHandbook.linkHouseManual, nav.kindKnowledge.
        // The sitemap was the last place carrying the old name.
        { href: p('/tools/knowledge-base'), label: 'House Manual', subtitle: 'House know-how', icon: BookMarked },
        { href: p('/tools/contacts'), label: 'Contacts & Vendors', subtitle: 'Who to call', icon: Contact },
        { href: p('/tools/takeout-directory'), label: 'Local Takeout Directory', subtitle: 'Nearby options', icon: UtensilsCrossed },
        { href: p('/tools/taste-memory'), label: 'Guest & Family Taste Memory', subtitle: 'Preferences & allergies', icon: Heart },
        { href: p('/blog'), label: 'Blog & Articles', subtitle: 'Tips and insights', icon: BookOpen },
      ],
    },
    {
      label: 'More',
      entries: [
        { href: p('/scan'), label: 'Scan', subtitle: 'Scan a label', icon: Scan },
        { href: p('/bulk-photos'), label: 'Bulk Photo Upload', subtitle: 'Add many photos', icon: ImagePlus },
        { href: p('/batch-operations'), label: 'Batch Operations', subtitle: 'Bulk edits', icon: Layers },
        { href: p('/yom-tov'), label: 'Yom Tov Year View', subtitle: 'Full year ahead', icon: CalendarRange },
        // Was reachable only by typing the URL -- not in any nav, header,
        // tools page or this index. StaffSlotsEditor lives here.
        { href: p('/settings'), label: 'Settings', subtitle: 'Staff slots & preferences', icon: SettingsIcon },
      ],
    },
  ];
}

// This page was already 100% hardcoded English before this redesign (no
// useTranslations/getTranslations usage anywhere in the original file) --
// kept that way here rather than silently taking on a full EN/ES pass as
// an unrequested addition to a visual-redesign ask. Flagging since the
// standing rule is bilingual client-facing content and this page still
// isn't; a real gap, just not one this task asked to close.
// Manager-only destinations, mirroring MIN_ROLE in tools/page.tsx. Listed by
// href suffix because this page is a flat link index, not the tile config.
// Settings is included here for the first time -- it was reachable only by
// typing the URL, which is why StaffSlotsEditor was effectively unreachable.
const MANAGER_ONLY_HREFS = [
  '/tools/tasks',
  '/tools/capture-inbox',
  '/tools/needs-linking',
  '/tools/translation-worklist',
  '/tools/photo-worklist',
  '/tools/duplicate-ingredients',
  '/tools/link-captured-photos',
  '/tools/hechsher-verification',
  '/tools/kosher-type-tagging',
  '/tools/digest',
  '/tools/taste-memory',
  '/tools/memory-timeline',
  '/tools/duty-roster',
  '/tools/task-verification',
  '/tools/suppliers',
  '/tools/backup',
  '/print-labels',
  '/settings',
];

export default async function SitemapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase
        .from('property_members')
        .select('role')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };
  const canManage = membership?.role === 'owner' || membership?.role === 'manager';

  const sections = buildSections(propertyId)
    .map((section) => ({
      ...section,
      entries: section.entries.filter(
        (e) => canManage || !MANAGER_ONLY_HREFS.some((suffix) => e.href.endsWith(suffix))
      ),
    }))
    .filter((section) => section.entries.length > 0);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Sitemap</h1>
      <p className="text-sm text-dusk mb-6">Every page in Sorted &amp; Stocked, organized by section.</p>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.label} className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
            <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
              {section.label}
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-[10px]">
                {section.entries.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      className="relative min-h-[80px] flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[10px] px-[14px] shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
                    >
                      <Pin size="sm" />
                      <span className="text-[8px] tracking-[0.2em] uppercase font-semibold text-brass">{section.label}</span>
                      <Icon size={20} className="text-denim" aria-hidden="true" />
                      <span className="font-display font-normal text-[14px] text-denim text-center">{entry.label}</span>
                      <span className="text-[9px] text-dusk text-center">{entry.subtitle}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
