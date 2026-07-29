// app/procurement/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProcurementClient from '@/components/ProcurementClient';
import { formatPropertyLabel } from '@/lib/property-display';

export default async function ProcurementPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Only owner/manager memberships — staff shop for one property at a time
  // from that property's own shopping list, they don't need the stitched
  // multi-property view.
  const { data: memberships, error } = await supabase
    .from('property_members')
    .select('role, properties(id, name, household_id, households(name))')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager']);

  const rawProperties = (memberships ?? [])
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
    );

  // Household size counted against the whole table, not just this user's
  // own memberships -- see app/properties/[id]/layout.tsx for why.
  const { data: allHouseholdIds } = await supabase.from('properties').select('household_id').not('household_id', 'is', null);
  const householdCounts = new Map<string, number>();
  for (const row of allHouseholdIds ?? []) {
    const hid = row.household_id as string;
    householdCounts.set(hid, (householdCounts.get(hid) ?? 0) + 1);
  }

  const properties = rawProperties.map((p) => {
    const household =
      p.household_id && p.households?.name
        ? { name: p.households.name, propertyCount: householdCounts.get(p.household_id) ?? 1 }
        : null;
    return { id: p.id, label: formatPropertyLabel(p.name, household) };
  });

  if (properties.length === 0) redirect('/properties');

  return <ProcurementClient properties={properties} errorMessage={error?.message} />;
}
