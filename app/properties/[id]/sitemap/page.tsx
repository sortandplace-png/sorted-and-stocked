// app/properties/[id]/sitemap/page.tsx
import Link from 'next/link';

type Entry = { href: string; label: string };
type Section = { label: string; entries: Entry[] };

// Mirrors the real nav structure this app already uses -- Dashboard / Plan
// / Shop / Staff (see components/nav/DesktopNav.tsx) plus the 4 real Tools
// Hub groups (see app/properties/[id]/tools/page.tsx's GROUPS) -- rather
// than inventing a new organization scheme for this page alone.
function buildSections(propertyId: string): Section[] {
  const p = (path: string) => `/properties/${propertyId}${path}`;
  return [
    {
      label: 'Dashboard',
      entries: [{ href: p('/dashboard'), label: 'Dashboard' }],
    },
    {
      label: 'Plan',
      entries: [
        { href: p('/recipes'), label: 'Recipes' },
        { href: p('/meal-plan'), label: 'Meal Plan' },
      ],
    },
    {
      label: 'Shop',
      entries: [
        { href: p('/shopping-list'), label: 'Shopping List' },
        { href: p('/inventory'), label: 'Inventory' },
        { href: p('/print-labels'), label: 'Print Labels' },
      ],
    },
    {
      label: 'Staff',
      entries: [
        { href: p('/staff'), label: 'Staff' },
        { href: p('/shift-handover'), label: 'Shift Handover' },
      ],
    },
    {
      label: 'Tools — Scanners',
      entries: [
        { href: p('/tools/price-scanner'), label: 'Price Scanner' },
        { href: p('/tools/ingredient-scanner'), label: 'Ingredient Scanner' },
        { href: p('/tools/recipe-stealer'), label: 'Recipe Scanner' },
      ],
    },
    {
      label: 'Tools — Kitchen Ops',
      entries: [
        { href: p('/tools/kitchen-timer'), label: 'Kitchen Timer' },
        { href: p('/tools/guest-scaler'), label: 'Scale Servings' },
        { href: p('/tools/reset-checklist'), label: 'Reset for Next' },
        { href: p('/tools/prep-timeline'), label: 'Prep Timeline' },
      ],
    },
    {
      label: 'Tools — Inventory Ops',
      entries: [
        { href: p('/tools/pantry-zones'), label: 'Pantry Zone Map' },
        { href: p('/tools/borrowed-items'), label: 'Borrowed & Lent' },
        { href: p('/tools/duplicate-ingredients'), label: 'Duplicate Ingredients' },
        { href: p('/tools/needs-linking'), label: 'Needs Linking' },
        { href: p('/tools/photo-review'), label: 'Room Photo Review' },
        { href: p('/tools/capture-inbox'), label: 'Capture Inbox' },
      ],
    },
    {
      label: 'Tools — Household',
      entries: [
        { href: p('/tools/knowledge-base'), label: 'Household Knowledge Base' },
        { href: p('/tools/tasks'), label: 'Staff Task Center' },
        { href: p('/tools/contacts'), label: 'Contacts & Vendors' },
        { href: p('/tools/takeout-directory'), label: 'Local Takeout Directory' },
        { href: p('/tools/halachic-calendar'), label: 'Halachic Calendar' },
        { href: p('/tools/memory-timeline'), label: 'Home Memory Timeline' },
        { href: p('/tools/taste-memory'), label: 'Guest & Family Taste Memory' },
      ],
    },
    {
      label: 'More',
      entries: [
        { href: p('/scan'), label: 'Scan' },
        { href: p('/bulk-photos'), label: 'Bulk Photo Upload' },
        { href: p('/batch-operations'), label: 'Batch Operations' },
        { href: p('/yom-tov'), label: 'Yom Tov Year View' },
      ],
    },
  ];
}

export default async function SitemapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params;
  const sections = buildSections(propertyId);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Sitemap</h1>
      <p className="text-sm text-charcoal/50 mb-6">Every page in Sorted &amp; Stocked, organized by section.</p>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">{section.label}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {section.entries.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className="block bg-white rounded-xl border border-gold-light/40 shadow-sm shadow-charcoal/5 px-4 py-2.5 text-sm text-charcoal hover:border-gold hover:bg-gold-light/10 transition-colors"
                  >
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
