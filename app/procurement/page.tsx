// app/procurement/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProcurementClient from '@/components/ProcurementClient';
import { formatPropertyLabel } from '@/lib/property-display';
import { isModuleEnabled, isOperatorConsole } from '@/lib/module-flags';

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
    .select('role, properties(id, name, household_id, feature_flags, archived_at, households(name))')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager']);

  // SS-410: this is an OPERATOR surface — cross-house shopping belongs to
  // the operator console (Lax), not to any client residence. A client who
  // owns their own property is an owner/manager and passed the role check
  // above, but they must never see a stitched multi-house view. Same
  // opt-in flag the cross-house inventory console and Suppliers already
  // gate on (230b2b0).
  const isOperator = (memberships ?? []).some((m) => {
    const p = m.properties as unknown as { feature_flags: Record<string, unknown> | null } | null;
    return p !== null && isOperatorConsole(p.feature_flags);
  });
  if (!isOperator) redirect('/properties');

  const rawProperties = (memberships ?? [])
    .map(
      (m) =>
        m.properties as unknown as {
          id: string;
          name: string;
          household_id: string | null;
          feature_flags: Record<string, unknown> | null;
          archived_at: string | null;
          households: { name: string } | null;
        } | null
    )
    .filter(
      (p): p is { id: string; name: string; household_id: string | null; feature_flags: Record<string, unknown> | null; archived_at: string | null; households: { name: string } | null } =>
        p !== null
    )
    // SS-373 follow-up: this is a cross-property surface, which the
    // per-property module gate in app/properties/[id]/layout.tsx never
    // reaches -- confirmed live, Low (module_shopping: false) still showed
    // up here, stitched into a combined shopping trip that property's own
    // nav no longer offers a way to reach directly.
    .filter((p) => isModuleEnabled(p.feature_flags, 'module_shopping'))
    // Archived test/throwaway properties (migration 142) stay out of every
    // cross-property surface, not just the picker.
    .filter((p) => !p.archived_at);

  // Household size counted against the whole table, not just this user's
  // own memberships -- see app/properties/[id]/layout.tsx for why.
  // SS-519 audit: archived test properties must not inflate the per-
  // household counts (decorative since SS-459, but wrong is wrong).
  const { data: allHouseholdIds } = await supabase.from('properties').select('household_id').not('household_id', 'is', null).is('archived_at', null);
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
