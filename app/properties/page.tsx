// app/properties/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';
import { LogoMark } from '@/components/Logo';
import Footer from '@/components/Footer';
import PropertiesPickerList, { type HouseholdGroup } from '@/components/PropertiesPickerList';

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
    .select('role, properties(id, name, household_id, households(name))')
    .eq('user_id', user.id);

  // Single-property households shouldn't have to pick — skip straight in.
  // Dashboard, not Inventory -- the universal post-login landing spot,
  // except staff, who land on their dedicated My Day page instead.
  if (memberships && memberships.length === 1 && memberships[0].properties) {
    const propertyId = (memberships[0].properties as any).id;
    const destination = memberships[0].role === 'staff' ? 'my-day' : 'dashboard';
    redirect(`/properties/${propertyId}/${destination}`);
  }

  // Grouped by household so multi-property households show one box that
  // expands, instead of every property listed flat -- keyed by household_id
  // where one exists, falling back to the property's own id (its own
  // singleton group) for the rare property not yet assigned to a household,
  // so this never crashes on missing data, just degrades to a flat entry.
  const groupsByKey = new Map<string, HouseholdGroup>();
  for (const m of memberships ?? []) {
    const property = m.properties as unknown as {
      id: string;
      name: string;
      household_id: string | null;
      households: { name: string } | null;
    } | null;
    if (!property) continue;
    const key = property.household_id ?? `property:${property.id}`;
    const entry = { id: property.id, name: property.name, role: m.role };
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
  const groups = [...groupsByKey.values()];

  return (
    <div className="min-h-screen bg-linen px-6 pt-12">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <h1 className="font-display text-2xl text-denim leading-tight">Your properties</h1>
          </div>
          <LogoutButton variant="light" />
        </div>

        {error && <p className="text-sm text-rust mb-4">{error.message}</p>}

        {groups.length > 0 ? (
          <PropertiesPickerList groups={groups} />
        ) : (
          <p className="text-sm text-dusk mb-6">
            You're not part of any property yet.
          </p>
        )}

        {memberships && memberships.length > 1 && (
          <Link
            href="/procurement"
            className="block text-center py-2.5 rounded-full bg-brass text-white text-sm font-medium mb-2"
          >
            Shop for multiple properties at once
          </Link>
        )}

        <Link
          href="/properties/new"
          className="block text-center py-2.5 rounded-full border border-brass/30 text-denim text-sm font-medium"
        >
          + Add a property
        </Link>

        <Footer />
      </div>
    </div>
  );
}
