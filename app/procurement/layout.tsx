// app/procurement/layout.tsx
// SS-126 proof case. Procurement is genuinely cross-property -- it stitches
// every property the viewer manages into one view -- so it has no propertyId
// and cannot live under app/properties/[id]/. That is precisely why it
// rendered with no header and stranded anyone who followed the More menu here.
//
// AppHeader with no propertyId: the switcher reads "All Properties", and
// search is hidden rather than silently scoped to one property (SS-249).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/ui/AppHeader';
import { getNextObservance } from '@/lib/get-next-observance';
import { formatPropertyLabel } from '@/lib/property-display';

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: allMemberships } = await supabase
    .from('property_members')
    .select('properties(id, name, household_id, households(name))')
    .eq('user_id', user.id);

  // Household size counted against the whole table, not just this user's
  // own memberships -- see app/properties/[id]/layout.tsx for why.
  const { data: allHouseholdIds } = await supabase.from('properties').select('household_id').not('household_id', 'is', null);
  const householdCounts = new Map<string, number>();
  for (const row of allHouseholdIds ?? []) {
    const hid = row.household_id as string;
    householdCounts.set(hid, (householdCounts.get(hid) ?? 0) + 1);
  }

  const switcherProperties = (allMemberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          household_id: string | null;
          households: { name: string } | null;
        } | null
    )
    .filter(
      (p): p is { id: string; name: string; household_id: string | null; households: { name: string } | null } =>
        p !== null
    )
    .sort((a, b) => {
      const aHousehold = a.households?.name ?? null;
      const bHousehold = b.households?.name ?? null;
      if (aHousehold !== bHousehold) {
        if (aHousehold === null) return 1;
        if (bHousehold === null) return -1;
        return aHousehold.localeCompare(bHousehold);
      }
      return a.name.localeCompare(b.name);
    })
    .map((p) => {
      const household =
        p.household_id && p.households?.name
          ? { name: p.households.name, propertyCount: householdCounts.get(p.household_id) ?? 1 }
          : null;
      return { id: p.id, label: formatPropertyLabel(p.name, household) };
    });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const nextObservance = await getNextObservance();

  return (
    <div className="min-h-screen bg-linen">
      <AppHeader
        properties={switcherProperties}
        userId={user.id}
        userEmail={user.email}
        fullName={profile?.full_name}
        avatarUrl={profile?.avatar_url}
        observance={nextObservance}
      />
      {/* No DesktopNav or MobileBottomNav: both are property-scoped and take a
          propertyId. The switcher is the way back into a property from here. */}
      <main className="pb-20 md:pb-0">{children}</main>
    </div>
  );
}
