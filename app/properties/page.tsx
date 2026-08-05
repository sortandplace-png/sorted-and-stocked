// app/properties/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';
import { LogoMark } from '@/components/Logo';
import Footer from '@/components/Footer';
import PropertiesPickerList, { type HouseholdGroup } from '@/components/PropertiesPickerList';
import { isOperatorConsole } from '@/lib/module-flags';

// SS-681: authenticated, per-account, and must never be served from a
// static or revalidated render. Same rule as app/properties/[id]/layout.tsx;
// see the comment there for why this is set explicitly rather than relied
// upon as a side effect of reading cookies.
export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function PropertiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated users to /login, but this
  // guards the page if it's ever reached directly (e.g. during dev).
  if (!user) redirect('/login');

  const { data: memberships, error } = await supabase
    .from('property_members')
    .select('role, properties(id, name, household_id, archived_at, feature_flags, households(name))')
    .eq('user_id', user.id);

  // Archived properties (soft-archived test/throwaway fixtures -- see
  // migration 142) are excluded from every decision this page makes, not
  // just hidden visually: a member whose only real property is archived
  // should still see the picker (and "Add a property"), not get redirected
  // into a fixture that was deliberately taken off the selector.
  const activeMemberships = (memberships ?? []).filter((m) => {
    const property = m.properties as unknown as { archived_at: string | null } | null;
    return property && !property.archived_at;
  });

  // Single-property households shouldn't have to pick — skip straight in.
  // Dashboard, not Inventory -- the universal post-login landing spot,
  // except staff, who land on their dedicated My Day page instead.
  if (activeMemberships.length === 1 && activeMemberships[0].properties) {
    const propertyId = (activeMemberships[0].properties as any).id;
    const destination = activeMemberships[0].role === 'staff' ? 'my-day' : 'dashboard';
    redirect(`/properties/${propertyId}/${destination}`);
  }

  // Grouped by household so multi-property households show one box that
  // expands, instead of every property listed flat -- keyed by household_id
  // where one exists, falling back to the property's own id (its own
  // singleton group) for the rare property not yet assigned to a household,
  // so this never crashes on missing data, just degrades to a flat entry.
  const groupsByKey = new Map<string, HouseholdGroup>();
  for (const m of activeMemberships) {
    const property = m.properties as unknown as {
      id: string;
      name: string;
      household_id: string | null;
      feature_flags: Record<string, unknown> | null;
      households: { name: string } | null;
    } | null;
    if (!property) continue;
    const key = property.household_id ?? `property:${property.id}`;
    const entry = { id: property.id, name: property.name, role: m.role, featureFlags: property.feature_flags };
    const existing = groupsByKey.get(key);
    if (existing) {
      existing.properties.push(entry);
    } else {
      groupsByKey.set(key, {
        key,
        householdName: property.households?.name ?? null,
        properties: [entry],
      });
    }
  }
  // SS-459 ordering, expressed in this page's grouped idiom: the group
  // holding the operator-console property first, the rest alphabetically by
  // their display name (household name, or the property's own name for a
  // null-household singleton like QA Demo -- which sorts with everyone,
  // no null-last case; that it appears at all is SS-512). Properties
  // within a group sort by name, giving the canonical live order
  // Lax, Henderson, Low, Strauss Country, Strauss Main.
  const groups = [...groupsByKey.values()]
    .map((g) => ({ ...g, properties: [...g.properties].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => {
      const aConsole = a.properties.some((p) => isOperatorConsole(p.featureFlags));
      const bConsole = b.properties.some((p) => isOperatorConsole(p.featureFlags));
      if (aConsole !== bConsole) return aConsole ? -1 : 1;
      const aLabel = a.householdName ?? a.properties[0]?.name ?? '';
      const bLabel = b.householdName ?? b.properties[0]?.name ?? '';
      return aLabel.localeCompare(bLabel);
    });

  return (
    <div className="min-h-screen bg-linen px-6 pt-12">
      {/* SS-400: was max-w-sm at every width, so five cards sat in a 384px
          column centred in an empty 1280px page. Widens on desktop and the
          grid gains columns to match -- a wider container alone would just
          have stretched two columns. */}
      <div className="max-w-sm lg:max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <h1 className="font-display text-2xl text-denim leading-tight">Your properties</h1>
          </div>
          <LogoutButton variant="light" />
        </div>

        {error && <p className="text-sm text-rust mb-4">{error.message}</p>}

        {groups.length === 0 && (
          <p className="text-sm text-dusk mb-4">You're not part of any property yet.</p>
        )}

        {/* Renders even with zero groups -- "Add a property" is always its
            trailing grid cell, not a separate element. */}
        <PropertiesPickerList groups={groups} />

        <Footer />
      </div>
    </div>
  );
}