// app/procurement/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProcurementClient from '@/components/ProcurementClient';
import { formatPropertyLabel } from '@/lib/property-display';
import { isModuleEnabled } from '@/lib/module-flags';

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
    .select('role, properties(id, name, household_id, feature_flags, households(name))')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager']);

  const rawProperties = (memberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          household_id: string | null;
          feature_flags: Record<string, unknown> | null;
          households: { name: string } | null;
        } | null
    )
    .filter(
      (p): p is { id: string; name: string; household_id: string | null; feature_flags: Record<string, unknown> | null; households: { name: string } | null } =>
        p !== null
    )
    // SS-373 follow-up: this is a cross-property surface, which the
    // per-property module gate in app/properties/[id]/layout.tsx never
    // reaches -- confirmed live, Low (module_shopping: false) still showed
    // up here, stitched into a combined shopping trip that property's own
    // nav no longer offers a way to reach directly.
    .filter((p) => isModuleEnabled(p.feature_flags, 'module_shopping'));

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
